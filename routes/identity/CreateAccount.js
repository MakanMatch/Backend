const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Emailer, Universal, Encryption, Logger, HTMLRenderer } = require('../../services');
const axios = require('axios');
require('dotenv').config();
const path = require("path");

async function isUniqueUsername(username) {
    const usernameExists = await Guest.findOne({ where: { username } }) ||
        await Host.findOne({ where: { username } }) ||
        await Admin.findOne({ where: { username } });
    return !usernameExists;
}

async function isUniqueEmail(email) {
    const emailExists = await Guest.findOne({ where: { email } }) ||
        await Host.findOne({ where: { email } }) ||
        await Admin.findOne({ where: { email } });
    return !emailExists;
}

async function isUniqueContactNum(contactNum) {
    const contactNumExists = await Guest.findOne({ where: { contactNum } }) ||
        await Host.findOne({ where: { contactNum } }) ||
        await Admin.findOne({ where: { contactNum } });
    return !contactNumExists;
}

router.post("/", async (req, res) => {
    const { username, fname, lname,  email, password, contactNum, blkNo, street, postalCode, unitNum, isHostAccount } = req.body;

    // const address = `Block ${blkNo} ${street} ${postalCode} #${unitNum}`;
    let address = '';
    if (blkNo && unitNum) {
        address = `Block ${blkNo} ${street} ${postalCode} #${unitNum}`;
    } else if (blkNo) {
        address = `Block ${blkNo} ${street} ${postalCode}`;
    } else if (unitNum) {
        address = `${street} ${postalCode} #${unitNum}`;
    } else {
        address = `${street} ${postalCode}`;
    }
    const nameRegex = /^[a-zA-Z\s]+$/;
    
    try {
        if (!nameRegex.test(fname) || !nameRegex.test(lname)) {
            return res.status(400).send("UERROR: First name and last name cannot contain numbers.");
        }
        
        if (!await isUniqueUsername(username)) {
            return res.status(400).send("UERROR: Username already exists.");
        }

        if (!await isUniqueEmail(email)) {
            return res.status(400).send("UERROR: Email already exists.");
        }

        const userID = Universal.generateUniqueID();
        const hashedPassword = await Encryption.hash(password);
        const emailVerificationTime = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString();
        const emailVeriToken = Universal.generateUniqueID(6);
        const emailVeriTokenExpiration = new Date(Date.now() + 86400000).toISOString();
        const accountData = {
            userID,
            fname,
            lname,
            username,
            email,
            emailVerificationTime: emailVerificationTime,
            password: hashedPassword,
            emailVerificationToken: emailVeriToken,
            emailVerificationTokenExpiration: emailVeriTokenExpiration
        };

        var user;
        if (isHostAccount) {
            if (!contactNum || !address) {
                return res.status(400).send("UERROR: Contact number and address are required for host accounts.");
            }

            if (!await isUniqueContactNum(contactNum)) {
                return res.status(400).send("UERROR: Contact number already exists.");
            }

            const encodedAddress = encodeURIComponent(String(address));
            const apiKey = process.env.GMAPS_API_KEY;
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedAddress}"&key=${apiKey}`;
            const response = await axios.get(url);
            const location = response.data.results[0];
            if (!location) {
                return res.status(400).send("UERROR: Invalid address.");
            } else {
                const fullCoordinates = `${location.geometry.location.lat},${location.geometry.location.lng}`;
                components = location.address_components;
                let street = '';
                let city = '';
                let state = '';

                components.forEach(component => {
                    if (component.types.includes('route')) {
                        street = component.long_name;
                    }
                    if (component.types.includes('locality')) {
                        city = component.long_name;
                    }
                    if (component.types.includes('administrative_area_level_1')) {
                        state = component.long_name;
                    }
                });
                
                let approximateAddress = '';
                if (street) {
                    approximateAddress += street;
                }
                if (city) {
                    if (approximateAddress) approximateAddress += ', ';
                    approximateAddress += city;
                }
                if (state) {
                    if (approximateAddress) approximateAddress += `, ${state}`;
                }

                const encodedApproximateAddress = encodeURIComponent(String(approximateAddress));
                const approxUrl = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedApproximateAddress}"&key=${apiKey}`;
                const approxResponse = await axios.get(approxUrl);
                const approxLocation = approxResponse.data.results[0].geometry.location;
                if (!approxLocation) {
                    return res.status(400).send("UERROR: Invalid address.");
                } else {
                    const approxCoordinates = `${approxLocation.lat},${approxLocation.lng}`;
                    accountData.coordinates = fullCoordinates;
                    accountData.approxCoordinates = approxCoordinates
                    accountData.approxAddress = approximateAddress;
                }
            }

            accountData.contactNum = contactNum;
            accountData.address = address;

            user = await Host.create(accountData);
        } else {
            user = await Guest.create(accountData);
        }

        if (!user) {
            return res.status(500).send("ERROR: Failed to create user.");
        }

        const origin = req.headers.origin;
        const verificationLink = `${origin}/auth/verifyToken?userID=${userID}&token=${emailVeriToken}`;

        // Send email with verification link using the Emailer service
        const emailText = `
    Welcome to MakanMatch!
    Hello {{ userName }},
    Thank you for joining MakanMatch! We are thrilled to have you on board. Your account has been successfully created, and you can now start exploring food listings, making reservations, and more!
    To complete your registraiton process, please verify your email using this link: 
    ${verificationLink}

    If you have any questions or need assistance, feel free to reach out to our support team.
    We hope you enjoy your experience with MakanMatch!
    
    Best regards,
    MakanMatch Team
    `
        Emailer.sendEmail(
            email,
            "Welcome to MakanMatch!",
            emailText,
            HTMLRenderer.render(
                path.join("emails", "WelcomeMessage.html"),
                {
                    username: user.username,
                    emailVerificationLink: verificationLink
                }
            )
        )
        .catch (err => {
            user.emailVerificationToken = null;
            user.emailVerificationTokenExpiration = null;
            Logger.log(`IDENTITY CREATEACCOUNT ERROR: Failed to send verification email to ${user.email}. Error: ${err}`)
        })

        Logger.log(`IDENTITY CREATEACCOUNT: ${isHostAccount ? 'Host' : 'Guest'} account with userID ${userID} created. Verification email auto-dispatched.`);
        res.send("SUCCESS: Account created. Please verify your email.");
    } catch (err) {
        Logger.log(`IDENTITY CREATEACCOUNT ERROR: Failed to create ${isHostAccount ? 'Host' : 'Guest'} account for user email ${email}. Error: ${err}`);
        res.status(500).send("ERROR: Internal server error.");
    }
});

module.exports = { router, at: '/createAccount' };