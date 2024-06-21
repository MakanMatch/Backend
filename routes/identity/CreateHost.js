const express = require('express');
const router = express.Router();
const { Host } = require('../../models');
const Universal = require('../../services/Universal');
const Encryption = require('../../services/Encryption');
require('dotenv').config();

router.post("/", async (req, res) => {
    console.log("received")
    let data = req.body;
    console.log(data)

    try {
        // Check username
        let usernameExists = await Host.findOne({
            where: { username: data.username }
        });
        if (usernameExists) {
            res.status(400).json({ message: "Username already exists." });
            return;
        }

        // Check email
        let host = await Host.findOne({
            where: { email: data.email }
        });
        if (host) {
            res.status(400).json({ message: "Email already exists." });
            return;
        }

        // Check contact number and address
        if (!data.contactNum || !data.address) {
            res.status(400).json({ message: "Contact number and address are required." });
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
        res.json({
            message: `Email ${result.email} was registered successfully.`
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error." });
    }
});

module.exports = router;