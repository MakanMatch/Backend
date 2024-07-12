const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Emailer, Logger } = require('../../services');
require('dotenv').config();

router.post("/send", async (req, res) => {
    let { email } = req.body;

    try {
        let user = await Guest.findOne({ where: { email } }) ||
            await Host.findOne({ where: { email } }) ||
            await Admin.findOne({ where: { email } });

        if (!user) {
            res.status(400).send("UERROR: Email doesn't exist.");
            return;
        }

        const verificationToken = Universal.generateUniqueID(6);
        const verificationTokenExpiration = new Date(Date.now() + 86400000).toISOString();

        // Save verificationToken and expiration to user record
        user.emailVerificationToken = verificationToken;
        user.emailVerificationTokenExpiration = verificationTokenExpiration;
        
        const saveUser = await user.save();

        if (!saveUser) {
            res.status(500).send("ERROR: Failed to save verification token.")
            return
        }

        const origin = req.headers.origin
        const verificationLink = `${origin}/auth/verifyToken?userID=${user.userID}&token=${verificationToken}`;

        // Send email with verification link using the Emailer service
        const emailSent = await Emailer.sendEmail(
            user.email,
            'Email Verification',
            `Click the link to verify your email: ${verificationLink}`,
            `<p>Click the link to verify your email: <a href="${verificationLink}">${verificationLink}</a></p>`
        );

        if (emailSent) {
            res.send('SUCCESS: Verification email sent.');
            return
        } else {
            res.status(500).send("ERROR: Failed to send verification email.");
            return
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("ERROR: Internal server error.");
        return
    }
});

router.post("/verify", async (req, res) => {
    // console.log("received at EmailVerification verifyEmail");
    let { userID, token } = req.body;

    if (!token || !userID) {
        return res.status(400).send("ERROR: One or more parameters missing.");
    }

    try {
        let user = await Guest.findOne({ where: { userID: userID } }) ||
            await Host.findOne({ where: { userID: userID } }) ||
            await Admin.findOne({ where: { userID: userID } });
        if (!user) {
            return res.status(400).send("UERROR: Invalid or expired verification token.");
        } else if (user.emailVerified === true) {
            return res.status(400).send("UERROR: Email already verified.")
        } else if (user.emailVerificationToken != token) {
            return res.status(400).send("UERROR: Invalid email verification token.")
        }
        
        const expirationDate = new Date(user.emailVerificationTokenExpiration)
        if (expirationDate < Date.now()) {
            // TODO: Remove email verification token and expiration from db and return token expired response
            user.emailVerificationToken = null;
            user.emailVerificationTokenExpiration = null;
            const saveUser = await user.save();
            if (saveUser) {
                Logger.log(`IDENTITY EMAILVERIFICATION: Verification token for userID ${user.userID} expired.`)
                return res.status(400).send("UERROR: Email verification token expired.")
            } else {
                Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Failed to remove expired verification token for userID ${user.userID}`)
                return res.status(500).send("ERROR: Failed to remove expired verification token.")
            }
        }

        // Set user as verified (assuming you have an emailVerified attribute)
        user.emailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationTokenExpiration = null;

        const saveUser = await user.save();
        if (saveUser) {
            Logger.log(`IDENTITY EMAILVERIFICATION: Email verification for userID ${user.userID} successful.`);
            res.send("SUCCESS: Email verification successful. You can now log in with your verified email.");
        } else {
            return res.status(500).send("ERROR: Failed to remove verification token.")
        }
    } catch (err) {
        console.error(err);
        Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Email verification for userID ${user.userID} unsuccessful.`)
        res.status(500).send("ERROR: Internal server error.");
    }
});

module.exports = { router, at: '/identity/emailVerification' };
