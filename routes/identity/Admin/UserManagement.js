const express = require("express");
const router = express.Router();
const { Guest, Host, Admin, UserRecord } = require("../../../models");
const { validateAdmin } = require("../../../middleware/auth");
const { Op } = require("sequelize");
const { Logger, Universal } = require("../../../services");
const yup = require("yup");
const { dispatchVerificationEmail } = require("../emailVerification");

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
    if (contactNum && contactNum.trim() !== '') {
        const contactNumExists = await Guest.findOne({ where: { contactNum } }) ||
            await Host.findOne({ where: { contactNum } }) ||
            await Admin.findOne({ where: { contactNum } });
    
        return (!contactNumExists) || contactNumExists.userID === currentUser.userID;
    }
}

router.post('/toggleBanUser', validateAdmin, async (req, res) => {
    const { userID } = req.body;

    try {
        // Find the user
        const user = await UserRecord.findOne({
            where: {
                [Op.or]: [
                    { hID: userID },
                    { gID: userID },
                    { aID: userID }
                ]
            }
        })

        user.banned = !user.banned;
        const saveUser = await user.save();

        if (!saveUser) {
            Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to toggle ban status for user with ID ${userID}`)
            return res.status(500).send("ERROR: Failed to ban user");
        }

        Logger.log(`IDENTITY USERMANAGEMENT BANUSER: ${user.banned ? 'Banned' : 'Unbanned'} user with ID ${userID}`);
        res.status(200).json({ message: "SUCCESS: Ban status updated", banned: user.banned });
    } catch (err) {
        Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to toggle ban user with ID ${userID}; error: ${err}`)
        res.status(500).send("ERROR: Failed to update ban status");
    }
});

router.put("/editUserDetails", validateAdmin, async (req, res) => {
    const { userID, userType, fname, lname, username, email, contactNum } = req.body;
    const nameRegex = /^[a-zA-Z\s]+$/;
    const contactNumRegex = /^\d{8}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    var user;
    try {
        
        if (userType === 'Guest') {
            user = await Guest.findByPk(userID);
        } else if (userType === 'Host') {
            user = await Host.findByPk(userID);
        }

        if (!user) {
            Logger.log(`IDENTITY USERMANAGEMENT EDITUSERDETAILS ERROR: User not found with ID ${userID}`);
            return res.status(404).send("ERROR: User not found.");
        }

        if (!fname || !lname) {
            return res.status(400).send("UERROR: First name and last name are required.");
        }

        if (!nameRegex.test(fname) || !nameRegex.test(lname)) {
            return res.status(400).send("UERROR: First name and last name cannot contain numbers.");
        }
        
        if (!await isUniqueUsername(username, user)) {
            return res.status(400).send("UERROR: Username already exists.");
        }

        if (!emailRegex.test(email)) {
            return res.status(400).send("UERROR: Invalid email.");
        }

        if (!await isUniqueEmail(email.replaceAll(" ", ""), user)) {
            return res.status(400).send("UERROR: Email already exists.");
        }

        if (!contactNumRegex.test(contactNum)) {
            return res.status(400).send("UERROR: Contact number must be 8 digits long.");
        }

        if (contactNum !== '' && !await isUniqueContactNum(contactNum, user)) {
            return res.status(400).send("UERROR: Contact number already exists.");
        }

        user.fname = fname;
        user.lname = lname;
        user.username = username;

        user.email = email;
        user.emailVerified = false;
        const verificationToken = Universal.generateUniqueID(6);
        user.emailVerificationToken = verificationToken;
        user.emailVerificationTokenExpiration = new Date(Date.now() + 86400000).toISOString();
        user.emailVerificationTime = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString();
        const verificationLink = `${req.headers.origin}/auth/verifyToken?userID=${user.userID}&token=${verificationToken}`;
        dispatchVerificationEmail(user.email, verificationLink)

        user.contactNum = contactNum;

        const saveUser = await user.save();

        if (!saveUser) {
            Logger.log(`IDENTITY USERMANAGEMENT EDITUSERDETAILS ERROR: Failed to edit user details for user with ID ${userID}`);
            return res.status(500).send("ERROR: Failed to edit user details");
        }

        Logger.log(`IDENTITY USERMANAGEMENT EDITUSERDETAILS: Edited user details for user with ID ${userID}`);
        res.send("SUCCESS: User details updated");
    } catch (err) {
        Logger.log(`IDENTITY USERMANAGEMENT EDITUSERDETAILS ERROR: Failed to edit user details for user with ID ${userID}; error: ${err}`);
        res.status(500).send("ERROR: Failed to edit user details");
    }
});

module.exports = { router, at: '/admin/userManagement' };