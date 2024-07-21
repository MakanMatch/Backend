const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Emailer, Universal, Encryption, Logger } = require('../../services');
const axios = require('axios');
require('dotenv').config();

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
    // console.log("Received at CreateAccount");
    const { username, fname, lname,  email, password, contactNum, blkNo, street, postalCode, unitNum, isHostAccount } = req.body;

    const address = `Block ${blkNo} ${street} ${postalCode} #${unitNum}`;
    const nameRegex = /^[a-zA-Z]+$/;

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
        const emailVeriToken = Universal.generateUniqueID(6);
        const emailVeriTokenExpiration = new Date(Date.now() + 86400000).toISOString();
        const accountData = {
            userID,
            fname,
            lname,
            username,
            email,
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
            console.log(encodedAddress);
            const apiKey = process.env.GMAPS_API_KEY;
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedAddress}"&key=${apiKey}`;
            const response = await axios.get(url);
            console.log(response.data);
            const location = response.data.results[0];
            console.log(location);
            if (!location) {
                return res.status(400).send("UERROR: Invalid address.");
            }

            accountData.contactNum = parseInt(contactNum);
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
        var emailSent = await Emailer.sendEmail(
            email,
            'Email Verification',
            `Click the link to verify your email: ${verificationLink}`,
            `<p>Click the link to verify your email: <a href="${verificationLink}">${verificationLink}</a></p>`
        );

        if (!emailSent) {
            user.emailVerificationToken = null;
            user.emailVerificationTokenExpiration = null;
            await user.save();

            Logger.log(`IDENTITY CREATEACCOUNT: ${isHostAccount ? 'Host' : 'Guest'} account with userID ${userID} created. Verification email couldn't be auto-dispatched.`);
            return res.send('SUCCESS RESENDVERIFICATION: Account created. Verification email could not be dispatched, retry.');
        }

        Logger.log(`IDENTITY CREATEACCOUNT: ${isHostAccount ? 'Host' : 'Guest'} account with userID ${userID} created. Verification email auto-dispatched.`);
        res.send("SUCCESS: Account created. Please verify your email.");
    } catch (err) {
        console.log(err);
        Logger.log(`IDENTITY CREATEACCOUNT: Fail to create ${isHostAccount ? 'Host' : 'Guest'} account for user email ${email}.`);
        res.status(500).send("ERROR: Internal server error.");
    }
});

module.exports = { router, at: '/createAccount' };