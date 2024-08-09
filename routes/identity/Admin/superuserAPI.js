const express = require("express");
const { Admin, Host, Guest } = require('../../../models');
const Logger = require("../../../services/Logger");
const Universal = require("../../../services/Universal");
const Extensions = require("../../../services/Extensions");
const Cache = require("../../../services/Cache");
const Analytics = require("../../../services/Analytics");
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

router.post("/accountInfo", async (req, res) => {
    const { userID, username, email } = req.body;
    if (!userID && !username && !email) {
        return res.status(400).send("ERROR: One or more required payloads were not provided.");
    }

    try {
        var account;
        if (userID) {
            account = await Guest.findByPk(userID) || await Host.findByPk(userID) || await Admin.findByPk(userID);
        } else if (username) {
            account = await Guest.findOne({ where: { username } }) || await Host.findOne({ where: { username } }) || await Admin.findOne({ where: { username } });
        } else if (email) {
            account = await Guest.findOne({ where: { email } }) || await Host.findOne({ where: { email } }) || await Admin.findOne({ where: { email } });
        }

        if (!account) {
            return res.status(404).send("ERROR: Account not found.");
        }

        const processedData = account.toJSON();
        if (processedData.password) {
            delete processedData.password;
        }

        return res.status(200).json(processedData);
    } catch (err) {
        Logger.log(`SUPERUSERAPI ACCOUNTINFO ERROR: Failed to retrieve account info; error: ${err}`);
        return res.status(500).send("ERROR: Failed to retrieve account info.")
    }
})

router.post("/getAnalytics", async (req, res) => {
    if (!Analytics.checkPermission()) {
        return res.status(400).send("ERROR: Analytics service is not enabled.");
    }

    try {
        const persistResult = await Analytics.persistData();
        if (persistResult !== true) {
            Logger.log(`SUPERUSERAPI GETANALYTICS ERROR: Failed to persist analytics data; error: ${persistResult}`);
            return res.status(500).send("ERROR: Failed to persist and retrieve analytics data.");
        }

        const allData = await Analytics.getAllMetrics();
        if (typeof allData == "string") {
            Logger.log(`SUPERUSERAPI GETANALYTICS ERROR: Failed to retrieve analytics data; error: ${allData}`);
            return res.status(500).send("ERROR: Failed to persist and retrieve analytics data.");
        }

        return res.status(200).json(allData);
    } catch (err) {
        Logger.log(`SUPERUSERAPI GETANALYTICS ERROR: Failed to persist and retrieve analytics data; error: ${err}`);
        return res.status(500).send("ERROR: Failed to persist and retrieve analytics data.");
    }
})

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

router.post("/deleteAdmin", async (req, res) => {
    const { username, email, userID } = req.body;
    if (!username && !email && !userID) {
        return res.status(400).send("ERROR: One or more required payloads were not provided.");
    }

    try {
        var targetAdmin;
        if (userID) {
            targetAdmin = await Admin.findByPk(userID);
        } else if (username) {
            targetAdmin = await Admin.findOne({ where: { username } });
        } else {
            targetAdmin = await Admin.findOne({ where: { email } });
        }

        if (!targetAdmin) {
            return res.status(404).send("UERROR: Admin not found.");
        }

        await targetAdmin.destroy();
        return res.status(200).send("SUCCESS: Admin deleted successfully.");
    } catch (err) {
        Logger.log(`SUPERUSERAPI DELETEADMIN ERROR: Failed to identify and delete admin; error: ${err}`);
        return res.status(500).send("ERROR: Failed to identify and delete admin.")
    }
})

router.post("/toggleUsageLock", (req, res) => {
    const { newStatus } = req.body;
    if (newStatus && typeof newStatus !== "boolean") {
        return res.status(400).send("ERROR: Invalid payload provided.");
    }

    if (newStatus == undefined || newStatus == null) {
        const saveResult = Cache.set("usageLock", !(Cache.get("usageLock") === true));
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEUSAGELOCK ERROR: Failed to toggle usage lock; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle usage lock.`);
        }

        return res.status(200).send(`SUCCESS: Usage lock toggled to ${Cache.get("usageLock")}`);
    } else {
        const saveResult = Cache.set("usageLock", newStatus);
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEUSAGELOCK ERROR: Failed to toggle usage lock; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle usage lock.`);
        }

        return res.status(200).send(`SUCCESS: Usage lock toggled to ${newStatus}`);
    }
})

router.post("/toggleMakanBot", (req, res) => {
    const { newStatus } = req.body;
    if (newStatus && typeof newStatus !== "boolean") {
        return res.status(400).send("ERROR: Invalid payload provided.");
    }

    if (newStatus == undefined || newStatus == null) {
        const saveResult = Cache.set("openaiChatEnabled", !(Cache.get("openaiChatEnabled") === true));
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEMAKANBOT ERROR: Failed to toggle MakanBot; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle MakanBot.`);
        }

        return res.status(200).send(`SUCCESS: MakanBot toggled to ${Cache.get("openaiChatEnabled")}`);
    } else {
        const saveResult = Cache.set("openaiChatEnabled", newStatus);
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEMAKANBOT ERROR: Failed to toggle MakanBot; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle MakanBot.`);
        }

        return res.status(200).send(`SUCCESS: OpenAIChat toggled to ${newStatus}`);
    }
})

module.exports = { router, at: '/admin/super' };