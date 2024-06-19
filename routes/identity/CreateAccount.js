const express = require('express');
const router = express.Router();
const { Guest } = require('../../models');
const Universal = require('../../services/Universal');
require('dotenv').config();

router.post("/", async (req, res) => {
    console.log("received")
    let data = req.body;
    console.log(data)

    try {
        // Check email
        let guest = await Guest.findOne({
            where: { email: data.email }
        });
        if (guest) {
            res.status(400).json({ message: "Email already exists." });
            return;
        }

        // Generate a unique userID
        let userID = Universal.generateUniqueID();

        // Add the userID to the data
        data.userID = userID;

        // Hash password
        // data.password = await bcrypt.hash(data.password, 10);

        // Create guest
        let result = await Guest.create(data);
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