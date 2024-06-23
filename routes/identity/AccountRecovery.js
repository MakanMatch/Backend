const express = require('express');
const router = express.Router();
const { Guest, Host, Admin } = require('../../models');
const { Universal, Emailer, Encryption } = require('../../services')
require('dotenv').config();

router.post("/resetKey", async (req, res) => {
    console.log("received at AccountRecovery ResetKey");
    let data = req.body;
    console.log(data);
    let { usernameOrEmail } = req.body;

    try {
        let user = await Guest.findOne({ where: { username: usernameOrEmail } }) ||
            await Guest.findOne({ where: { email: usernameOrEmail } }) ||
            await Host.findOne({ where: { username: usernameOrEmail } }) ||
            await Host.findOne({ where: { email: usernameOrEmail } }) ||
            await Admin.findOne({ where: { username: usernameOrEmail } }) ||
            await Admin.findOne({ where: { email: usernameOrEmail } });

        if (!user) {
            res.status(400).json({ message: "Username or email doesn't exist." });
            return;
        }

        const resetKey = Universal.generateUniqueID(6);
        console.log(resetKey);

        // Save resetKey and expiration to user record
        user.resetKey = resetKey;
        user.resetKeyExpiration = Date.now() + 900000; // 15 mins expiration
        await user.save();

        // Send email with reset key using the Emailer service
        const emailSent = await Emailer.sendEmail(
            user.email,
            'Password Reset Key',
            `Your password reset key is ${resetKey}`,
            `<p>Your password reset key is <strong>${resetKey}</strong></p>`
        );

        if (emailSent) {
            res.json({ message: 'SUCCESS: Reset key sent.' });
        } else {
            res.status(500).json({ message: "Failed to send reset key." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/resetPassword', async (req, res) => {
    console.log("received at AccountRecovery ResetPassword");
    let data = req.body;
    console.log(data);
    const { resetKey, newPassword } = req.body;

    try {
        // Find the user based on the reset key
        let user = await Guest.findOne({ where: { resetKey } }) ||
            await Host.findOne({ where: { resetKey } }) ||
            await Admin.findOne({ where: { resetKey } });

        if (!user || user.resetKeyExpiration < Date.now()) {
            res.status(400).json({ message: "Invalid or expired reset key." });
            return;
        }

        // Reset password
        user.password = await Encryption.hash(newPassword);
        user.resetKey = null;
        user.resetKeyExpiration = null;
        await user.save();

        res.json({ message: "SUCCESS: Password reset successful. You can now log in with your new password." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error." });
    }
});

module.exports = router;
