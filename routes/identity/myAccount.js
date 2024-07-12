const express = require('express');
const router = express.Router();
const { validateToken } = require('../../middleware/auth');
const { Logger } = require('../../services');
const { Guest, Host, Admin } = require('../../models');


router.put('/updateAccountDetails', async (req, res) => {
    const { userID, username, email, contactNum, address } = req.body;
    console.log("Received at updateAccountDetails")

    try {
        // Find user using userID
        let user = await Guest.findOne({ where: { email } }) ||
            await Host.findOne({ where: { email } }) ||
            await Admin.findOne({ where: { email } });

        if (!user) {
            res.status(400).send("UERROR: Email doesn't exist.");
            return;
        }

        // Update user information
        user.username = username;
        user.email = email;
        user.contactNum = contactNum;
        user.address = address;

        // Save changes to the database
        saveUser = await user.save();

        if (!saveUser) {
            Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to save user details for userID ${userID}`)
            res.status(500).send("ERROR: Failed to update user details")
        }

        Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS: Updated user details for userID ${userID}`)
        res.send("SUCCESS: Account information updated.");
    } catch (err) {
        console.log("catch")
        console.error(err);
        Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to update user details for userID ${userID}`)
        res.status(500).send("ERROR: Internal server error.");
    }
});



module.exports = { router, at: '/identity/myAccount' };