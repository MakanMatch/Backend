const express = require("express");
const { Admin, Host, Guest } = require('../../../models');
const Logger = require("../../../services/Logger");
const Universal = require("../../../services/Universal");
const router = express.Router();

async function isUniqueUsername(username) {
    const usernameExists = await Guest.findOne({ where: { username } }) ||
        await Host.findOne({ where: { username } }) ||
        await Admin.findOne({ where: { username } });
    return !usernameExists;
}

async function isUniqueEmail(email) {
    const emailExists = await Guest.findOne({ where: { email } }) ||
        await Host.findOne({ where: { email } }) ||
        await Admin.findOne({ where: { email } });
    return !emailExists;
}

router.get("/", (req, res) => {
    return res.send("SUCCESS: Superuser API is healthy!");
})

router.use((req, res, next) => {
    if (req.headers["AccessKey"] !== process.env.SUPERUSER_KEY && req.headers["accesskey"] !== process.env.SUPERUSER_KEY) {
        return res.status(403).send("ERROR: Access Unauthorised.")
    }
    next();
})

router.post("/authenticate", (req, res) => {
    return res.send("SUCCESS: Authentication successful.")
})

// userID
// fname
// lname
// username
// email
// password
// contactNum
// address
// emailVerified
// role
// profilePicture
// resetKey
// resetKeyExpiration

router.post("/createAdmin", async (req, res) => {
    const { fname, lname, username, email, password, role } = req.body;
    if (!fname || !lname || !username || !email || !password || !role) {
        return res.status(400).send("ERROR: One or more required payloads were not provided.");
    }

    // Check email validity with regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send("UERROR: Invalid email address provided.");
    } else if (password.length < 6) {
        return res.status(400).send("UERROR: Password must be at least 6 characters long.");
    }

    if (!await isUniqueUsername(username)) {
        return res.status(400).send("UERROR: Username already exists.");
    } else if (!await isUniqueEmail(email)) {
        return res.status(400).send("UERROR: Email already exists.");
    }

    try {
        const admin = await Admin.create({
            userID: Universal.generateUniqueID(),
            fname,
            lname,
            username,
            email,
            password,
            role
        });
        return res.status(200).send(`SUCCESS: Admin created successfully. ID: ${admin.userID}`)
    } catch (err) {
        Logger.log(`SUPERUSERAPI CREATEADMIN ERROR: Failed to create new admin; error: ${err}`);
        return res.status(500).send("ERROR: Failed to create new admin.")
    }
})

module.exports = { router, at: '/admin/super' };