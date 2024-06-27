const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Emailer, Encryption, Logger } = require('../../services');
require('dotenv').config();

// Function to check if the username is unique across all tables
async function isUniqueUsername(username) {
    const usernameExists = await Guest.findOne({ where: { username } }) ||
        await Host.findOne({ where: { username } }) ||
        await Admin.findOne({ where: { username } });
    return !usernameExists;
}

// Function to check if the email is unique across all tables
async function isUniqueEmail(email) {
    const emailExists = await Guest.findOne({ where: { email } }) ||
        await Host.findOne({ where: { email } }) ||
        await Admin.findOne({ where: { email } });
    return !emailExists;
}

// Function to check if the contact number is unique across Host and Admin tables
async function isUniqueContactNum(contactNum) {
    const contactNumExists = await Host.findOne({ where: { contactNum } }) ||
        await Admin.findOne({ where: { contactNum } });
    return !contactNumExists;
}

router.post("/", async (req, res) => {
    console.log("received at CreateAccount");
    const { username, email, password, contactNum, address, isHostAccount } = req.body;
    console.log(req.body);

    try {
        // Check username
        if (!await isUniqueUsername(username)) {
            return res.status(400).send( "UERROR: Username already exists." );
        }

        // Check email
        if (!await isUniqueEmail(email)) {
            return res.status(400).send("UERROR: Email already exists.");
        }

        // Generate a unique userID
        const userID = Universal.generateUniqueID();

        // Hash password
        const hashedPassword = await Encryption.hash(password);

        // Email verification link generation
        const emailVeriToken = Universal.generateUniqueID(6);

        // Determine account type and validate necessary fields
        let accountData = {
            userID,
            username,
            email,
            password: hashedPassword
        };

        if (isHostAccount) {
            // Check contact number and address
            if (!contactNum || !address) {
                return res.status(400).send("UERROR: Contact number and address are required for host accounts.");
            }

            // Check contact number uniqueness
            if (!await isUniqueContactNum(contactNum)) {
                return res.status(400).send("UERROR: Contact number already exists." );
            }

            accountData = {
                ...accountData,
                contactNum: parseInt(contactNum),
                address
            };

            // Create host
            await Host.create(accountData);
        } else {
            // Create guest
            await Guest.create(accountData);
        }

        // Send verification email

        // Success message to redirect user to EmailVerification page
        Logger.log(`IDENTITY CREATEACCOUNT: ${isHostAccount ? 'Host' : 'Guest'} account with userID ${userID} created`)
        res.send("SUCCESS: Account created. Please verify your email.");
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Internal server error." );
    }
});

module.exports = router;