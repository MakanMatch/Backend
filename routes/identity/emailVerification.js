const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Emailer, Logger, HTMLRenderer } = require('../../services');
require('dotenv').config();
const path = require('path');

function dispatchVerificationEmail(destinationEmail, verificationLink) {
    // Send email with verification link using the Emailer service
    const emailText = `
    Email Verification
    
    Please verify your email using this link:
    ${verificationLink}
    
    If you did not request this, please ignore this email.
    
    Best regards,
    MakanMatch Team
    `

    Emailer.sendEmail(
        destinationEmail,
        "Email Verification | MakanMatch",
        emailText,
        HTMLRenderer.render(
            path.join("emails", "ResendEmailVerification.html"),
            {
                verificationLink: verificationLink
            }
        )
    )
        .catch(err => {
            Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Failed to send verification email to ${destinationEmail}. Error: ${err}`)
        })
}

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
        if (user.emailVerified === true) {
            res.status(400).send("UERROR: Email already verified.")
            return;
        }

        const now = Date.now();
        const thirtySeconds = 30000;

        // Check if the last verification token was sent less than 30 seconds ago
        if (user.emailVerificationTokenExpiration) {
            const lastSentTime = new Date(user.emailVerificationTokenExpiration).getTime() - 86400000;
            if (now - lastSentTime < thirtySeconds) {
                res.status(400).send("UERROR: Please wait 30 seconds before requesting a new verification email.");
                return;
            }
        }

        const verificationToken = Universal.generateUniqueID(6);
        const verificationTokenExpiration = new Date(Date.now() + 86400000).toISOString();

        // Save verificationToken and expiration to user record
        user.emailVerified = false;
        user.emailVerificationToken = verificationToken;
        user.emailVerificationTokenExpiration = verificationTokenExpiration;
        user.emailVerificationTime = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString();

        const saveUser = await user.save();

        if (!saveUser) {
            res.status(500).send("ERROR: Failed to save verification token.")
            return
        }

        const origin = req.headers.origin
        const verificationLink = `${origin}/auth/verifyToken?userID=${user.userID}&token=${verificationToken}`;

        dispatchVerificationEmail(email, verificationLink);

        res.send('SUCCESS: Verification email sent.');
    } catch (err) {
        console.error(err);
        res.status(500).send("ERROR: Internal server error.");
        return
    }
});

router.post("/verify", async (req, res) => {
    let { userID, token } = req.body;

    if (!token || !userID) {
        return res.status(400).send("ERROR: One or more parameters missing.");
    }

    try {
        let user = await Guest.findByPk(userID) ||
            await Host.findByPk(userID) ||
            await Admin.findByPk(userID);
        
        if (!user) {
            return res.status(400).send("UERROR: Invalid or expired verification token.");
        } else if (user.emailVerified === true) {
            return res.status(400).send("UERROR: Email already verified.")
        } else if (user.emailVerificationToken != token) {
            return res.status(400).send("UERROR: Invalid email verification token.")
        }

        const expirationDate = new Date(user.emailVerificationTokenExpiration)
        if (expirationDate < Date.now()) {
            user.emailVerificationToken = null;
            user.emailVerificationTokenExpiration = null;
            user.emailVerificationTime = null;

            const saveUser = await user.save();
            if (saveUser) {
                Logger.log(`IDENTITY EMAILVERIFICATION: Verification token for userID ${user.userID} expired.`)
                return res.status(400).send("UERROR: Email verification token expired.")
            } else {
                Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Failed to remove expired verification token for user ${user.userID}`)
                return res.status(500).send("ERROR: Failed to process request.")
            }
        }

        // Set user as verified
        user.emailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationTokenExpiration = null;
        user.emailVerificationTime = null;

        const saveUser = await user.save();
        if (saveUser) {
            Logger.log(`IDENTITY EMAILVERIFICATION: Email verification for userID ${user.userID} successful.`);
            return res.send("SUCCESS: Email verification successful. You can now log in with your verified email.");
        } else {
            Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Failed to remove verification token for userID ${user.userID}`)
            return res.status(500).send("ERROR: Failed to remove verification token.")
        }
    } catch (err) {
        console.error(err);
        Logger.log(`IDENTITY EMAILVERIFICATION ERROR: Email verification for userID ${user.userID} unsuccessful.`)
        res.status(500).send("ERROR: Internal server error.");
    }
});

module.exports = { router, at: '/identity/emailVerification', dispatchVerificationEmail };
