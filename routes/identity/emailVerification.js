const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Emailer, Logger } = require('../../services');
require('dotenv').config();

router.post("/sendVerificationEmail", async (req, res) => {
    console.log("received at EmailVerification sendVerificationEmail");
    let data = req.body;
    console.log(data);
    let { email } = req.body;

    try {
        let user = await Guest.findOne({ where: { email } }) ||
            await Host.findOne({ where: { email } }) ||
            await Admin.findOne({ where: { email } });

        if (!user) {
            res.status(400).send("Email doesn't exist.");
            return;
        }

        const verificationToken = Universal.generateUniqueID(6); // You can use a longer token for better security
        console.log(verificationToken);

        // Save verificationToken and expiration to user record
        user.verificationToken = verificationToken;
        user.verificationTokenExpiration = Date.now() + 86400000; // 24 hours expiration
        await user.save();

        const verificationLink = `${process.env.FRONTEND_URL}/verifyEmail?token=${verificationToken}`;

        // Send email with verification link using the Emailer service
        const emailSent = await Emailer.sendEmail(
            user.email,
            'Email Verification',
            `Click the link to verify your email: ${verificationLink}`,
            `<p>Click the link to verify your email: <a href="${verificationLink}">${verificationLink}</a></p>`
        );

        if (emailSent) {
            res.send('SUCCESS: Verification email sent.');
        } else {
            res.status(500).send("Failed to send verification email.");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal server error.");
    }
});

router.get("/verifyEmail", async (req, res) => {
    console.log("received at EmailVerification verifyEmail");
    let { token } = req.query;

    try {
        let user = await Guest.findOne({ where: { verificationToken: token } }) ||
            await Host.findOne({ where: { verificationToken: token } }) ||
            await Admin.findOne({ where: { verificationToken: token } });

        if (!user || user.verificationTokenExpiration < Date.now()) {
            res.status(400).send("Invalid or expired verification token.");
            return;
        }

        user.isVerified = true; // Add this field to your model if it doesn't exist
        user.verificationToken = null;
        user.verificationTokenExpiration = null;
        await user.save();

        Logger.log(`IDENTITY EMAILVERIFICATION: Email verification for userID ${user.userID} successful.`);
        res.send("SUCCESS: Email verification successful. You can now log in with your verified email.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal server error.");
    }
});

module.exports = router;
