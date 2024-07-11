const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Encryption, Logger } = require('../../services');
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
    const contactNumExists = await Host.findOne({ where: { contactNum } }) ||
        await Admin.findOne({ where: { contactNum } });
    return !contactNumExists;
}

router.post("/", async (req, res) => {
    // console.log("Received at CreateAccount");
    const { username, email, password, contactNum, address, isHostAccount } = req.body;
    console.log(req.body);

    try {
        if (!await isUniqueUsername(username)) {
            return res.status(400).send("UERROR: Username already exists.");
        }

        if (!await isUniqueEmail(email)) {
            return res.status(400).send("UERROR: Email already exists.");
        }

        const userID = Universal.generateUniqueID();
        const hashedPassword = await Encryption.hash(password);
        const emailVeriToken = Universal.generateUniqueID(6);
        const accountData = {
            userID,
            username,
            email,
            password: hashedPassword,
            emailVeriToken
        };

        if (isHostAccount) {
            if (!contactNum || !address) {
                return res.status(400).send("UERROR: Contact number and address are required for host accounts.");
            }

            if (!await isUniqueContactNum(contactNum)) {
                return res.status(400).send("UERROR: Contact number already exists.");
            }

            accountData.contactNum = parseInt(contactNum);
            accountData.address = address;

            await Host.create(accountData);
        } else {
            await Guest.create(accountData);
        }
        Logger.log(`IDENTITY CREATEACCOUNT: ${isHostAccount ? 'Host' : 'Guest'} account with userID ${userID} created`);
        res.send("SUCCESS: Account created. Please verify your email.");
    } catch (err) {
        Logger.log(`IDENTITY CREATEACCOUNT: Fail to create ${isHostAccount ? 'Host' : 'Guest'} account for user email ${email}.`)
        res.status(500).send("Internal server error.");
    }
});

module.exports = { router, at: '/createAccount' };
