const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const Universal = require('../../services/Universal');
const Encryption = require('../../services/Encryption');
const sendVerificationEmail = require('../../services/Emailer'); 
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

router.post("/guest", async (req, res) => {
    console.log("received at CreateAccount");
    let data = req.body;
    console.log(data);

    try {
        // Check username
        if (!await isUniqueUsername(data.username)) {
            res.status(400).json({ message: "Username already exists." });
            return;
        }

        // Check email
        if (!await isUniqueEmail(data.email)) {
            res.status(400).json({ message: "Email already exists." });
            return;
        }

        // Generate a unique userID
        let userID = Universal.generateUniqueID();

        // Add the userID to the data
        data.userID = userID;

        // Hash password
        data.password = await Encryption.hash(data.password);

        // Create guest
        let result = await Guest.create({
            userID: data.userID,
            username: data.username,
            email: data.email,
            password: data.password,
        });

        // Send verification email
        // await sendVerificationEmail(data.email);

        // Redirect to EmailVerification page
        res.json({
            redirectUrl: `/EmailVerification?email=${data.email}`
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// Endpoint to send verification email after host account creation
router.post("/host", async (req, res) => {
    console.log("received");
    let data = req.body;
    console.log(data);

    try {
        // Check username
        if (!await isUniqueUsername(data.username)) {
            res.status(400).json({ message: "Username already exists." });
            return;
        }

        // Check email
        if (!await isUniqueEmail(data.email)) {
            res.status(400).json({ message: "Email already exists." });
            return;
        }

        // Check contact number and address
        if (!data.contactNum || !data.address) {
            res.status(400).json({ message: "Contact number and address are required." });
            return;
        }

        // Check contact number
        if (!await isUniqueContactNum(data.contactNum)) {
            res.status(400).json({ message: "Contact number already exists." });
            return;
        }

        // Generate a unique userID
        let userID = Universal.generateUniqueID();

        // Add the userID to the data
        data.userID = userID;

        // Hash password
        data.password = await Encryption.hash(data.password);

        // Create host
        let result = await Host.create({
            userID: data.userID,
            username: data.username,
            email: data.email,
            password: data.password,
            contactNum: parseInt(data.contactNum),
            address: data.address
        });

        // Send verification email
        // await sendVerificationEmail(data.email);

        // Redirect to EmailVerification page
        res.json({
            redirectUrl: `/EmailVerification?email=${data.email}`
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error." });
    }
});

module.exports = router;