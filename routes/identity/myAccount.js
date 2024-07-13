const express = require('express');
const router = express.Router();
const { Logger } = require('../../services');
const { Guest, Host, Admin } = require('../../models');

async function isUniqueUsername(username, currentUser) {
    const usernameExists = await Guest.findOne({ where: { username } }) ||
        await Host.findOne({ where: { username } }) ||
        await Admin.findOne({ where: { username } });

    return !usernameExists || usernameExists.userID === currentUser.userID;
}

async function isUniqueEmail(email, currentUser) {
    const emailExists = await Guest.findOne({ where: { email } }) ||
        await Host.findOne({ where: { email } }) ||
        await Admin.findOne({ where: { email } });

    return !emailExists || emailExists.userID === currentUser.userID;
}

async function isUniqueContactNum(contactNum, currentUser) {
    const contactNumExists = await Guest.findOne({ where: { contactNum } }) ||
        await Host.findOne({ where: { contactNum } }) ||
        await Admin.findOne({ where: { contactNum } });

    return !contactNumExists || contactNumExists.userID === currentUser.userID;
}

router.put('/updateAccountDetails', async (req, res) => {
    const { userID, username, email, contactNum, address } = req.body;

    try {
        // Find user using userID
        let user = await Guest.findOne({ where: { userID } }) ||
            await Host.findOne({ where: { userID } }) ||
            await Admin.findOne({ where: { userID } });

        if (!user) {
            res.status(400).send("UERROR: User doesn't exist.");
            return;
        }

        if (!await isUniqueUsername(username, user)) {
            return res.send("UERROR: Username already exists.");
        }

        if (!await isUniqueEmail(email, user)) {
            return res.send("UERROR: Email already exists.");
        }

        if (!await isUniqueContactNum(contactNum.replaceAll(" ", ""), user)) {
            return res.send("UERROR: Contact number already exists.");
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
        console.error(err);
        Logger.log(`IDENTITY MYACCOUNT UPDATEACCOUNTDETAILS ERROR: Failed to update user details for userID ${userID}`)
        res.status(500).send("ERROR: Error updating user details.");
    }
});

router.delete('/deleteAccount', async (req, res) => {
    const { userID, userType } = req.body;

    try {
        let user;

        // Find the user based on userType
        if (userType === 'Guest') {
            user = await Guest.findOne({ where: { userID } });
        } else if (userType === 'Host') {
            user = await Host.findOne({ where: { userID } });
        } else if (userType === 'Admin') {
            user = await Admin.findOne({ where: { userID } });
        }

        if (!user) {
            return res.status(400).send('UERROR: User not found.');
        }

        deleteUser = await user.destroy();
        
        if (!deleteUser) {
            res.status(500).send(`ERROR: Failed to delete user ${userID}`)
        }

        Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT: ${userType} account ${userID} deleted.`)
        res.send(`SUCCESS: User ${userID} deleted successfully.`);
    } catch (err) {
        console.error('Error deleting user account:', err);
        Logger.log(`IDENTITY MYACCOUNT DELETEACCOUNT ERROR: Failed to delete user ${userID}`)
        res.status(500).send(`ERROR: Failed to delete user ${userID}.`);
    }
});

module.exports = { router, at: '/identity/myAccount' };