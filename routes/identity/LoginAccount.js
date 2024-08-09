const express = require('express');
const router = express.Router();
const { Guest, Host, Admin, UserRecord } = require('../../models');
const { Encryption, Logger, Extensions } = require('../../services');
const TokenManager = require('../../services/TokenManager').default();
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
require('dotenv').config();

router.post("/", async (req, res) => {
    let data = req.body;

    try {
        let user;
        let userType;

        // Function to find user by email or username
        const findUser = async (model, identifier) => {
            if (identifier.includes('@')) {
                return await model.findOne({ where: { email: identifier } });
            } else {
                return await model.findOne({ where: { username: identifier } });
            }
        };

        // Check in Guest
        user = await findUser(Guest, data.usernameOrEmail);
        userType = 'Guest';

        // Check in Host if not found in Guest
        if (!user) {
            user = await findUser(Host, data.usernameOrEmail);
            userType = 'Host';
        }

        // Check in Admin if not found in Guest or Host
        if (!user) {
            user = await findUser(Admin, data.usernameOrEmail);
            userType = 'Admin';
        }

        // If user is not found in any of the models
        if (!user) {
            res.status(400).send("UERROR: Invalid username or email or password.");
            return;
        }

        if (userType !== "Admin") {
            // Check is user is banned
            const userRecord = await UserRecord.findOne({
                where: {
                    [Op.or]: [
                        { hID: user.userID },
                        { gID: user.userID },
                        { aID: user.userID }
                    ]
                }
            })
            if (!userRecord) {
                Logger.log(`IDENTITY LOGINACCOUNT ERROR: No matching user record found for login attempt to account with ID: ${user.userID}`)
                return res.status(500).send("ERROR: Failed to process request. Please try again.")
            }

            if (userRecord.banned) {
                return res.status(404).send("UERROR: Your account has been banned. Contact customer support or the MakanMatch team via email.")
            }

            // Check for 7 days email unverified
            const currentTime = new Date();
            const emailVerificationTime = new Date(user.emailVerificationTime);
            const unverifiedTime = Extensions.timeDiffInSeconds(emailVerificationTime, currentTime)

            if (unverifiedTime > (60 * 60 * 24 * 7) && !user.emailVerified) {
                return res.status(403).send("UERROR: Your account is locked due to failure to verify email within 7 days. Contact customer support or the MakanMatch team via email.");
            }
        }

        // Check password
        let passwordMatch = await Encryption.compare(data.password, user.password);
        if (!passwordMatch) {
            res.status(400).send("UERROR: Invalid username or email or password.");
            return;
        }

        // User info
        let userInfo = {
            userID: user.userID,
            username: user.username,
            userType: userType
        }

        // Generate jwt
        const accessToken = TokenManager.sign(userInfo);

        // Login success
        Logger.log(`IDENTITY LOGINACCOUNT: Account with userID ${user.userID} logged in.`)
        res.json({ message: `SUCCESS: Logged in successfully as ${userType}.`, accessToken, user: userInfo });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal server error.");
    }
});

module.exports = { router, at: '/loginAccount' };