const express = require("express");
const { Admin, ChatHistory, ChatMessage, FavouriteListing, FoodListing, Guest, Host, ListingAnalytics, RequestAnalytics, Reservation, Review, ReviewLike, SystemAnalytics, UserRecord, Warning } = require('../../../models');
const Logger = require("../../../services/Logger");
const Universal = require("../../../services/Universal");
const Extensions = require("../../../services/Extensions");
const Cache = require("../../../services/Cache");
const Analytics = require("../../../services/Analytics");
const Encryption = require("../../../services/Encryption");
const FileManager = require("../../../services/FileManager");
const { validateSuperuser, validateSuperuserSensitive } = require("../../../middleware/auth");
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

router.post("/authenticate", validateSuperuser, (req, res) => {
    return res.send("SUCCESS: Authentication successful.")
})

router.post("/accountInfo", validateSuperuser, async (req, res) => {
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

router.post("/getAnalytics", validateSuperuser, async (req, res) => {
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

router.post("/toggleAnalytics", validateSuperuser, (req, res) => {
    const { newStatus } = req.body;
    if (newStatus && typeof newStatus !== "boolean") {
        return res.status(400).send("ERROR: Invalid payload provided.");
    }

    if (newStatus == undefined || newStatus == null) {
        const saveResult = Cache.set("analyticsEnabled", !(Cache.get("analyticsEnabled") === true));
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEANALYTICS ERROR: Failed to toggle analytics service; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle analytics.`);
        }

        Logger.log(`SUPERUSERAPI TOGGLEANALYTICS: Analytics service toggled to ${Cache.get("analyticsEnabled")}.`);

        return res.status(200).send(`SUCCESS: Analytics service toggled to ${Cache.get("analyticsEnabled")}`);
    } else {
        const saveResult = Cache.set("analyticsEnabled", newStatus);
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEANALYTICS ERROR: Failed to toggle analytics service; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle analytics.`);
        }

        return res.status(200).send(`SUCCESS: Analytics service toggled to ${newStatus}`);
    }
})

router.post("/createAdmin", validateSuperuser, async (req, res) => {
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
            password: await Encryption.hash(password),
            role
        });
        return res.status(200).send(`SUCCESS: Admin created successfully. ID: ${admin.userID}`)
    } catch (err) {
        Logger.log(`SUPERUSERAPI CREATEADMIN ERROR: Failed to create new admin; error: ${err}`);
        return res.status(500).send("ERROR: Failed to create new admin.")
    }
})

router.post("/deleteAdmin", validateSuperuser, async (req, res) => {
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

router.post("/toggleUsageLock", validateSuperuser, (req, res) => {
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

        Logger.log(`SUPERUSERAPI TOGGLEUSAGELOCK: Usage lock toggled to ${Cache.get("usageLock")}.`);

        return res.status(200).send(`SUCCESS: Usage lock toggled to ${Cache.get("usageLock")}`);
    } else {
        const saveResult = Cache.set("usageLock", newStatus);
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEUSAGELOCK ERROR: Failed to toggle usage lock; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle usage lock.`);
        }

        Logger.log(`SUPERUSERAPI TOGGLEUSAGELOCK: Usage lock toggled to ${newStatus}.`);

        return res.status(200).send(`SUCCESS: Usage lock toggled to ${newStatus}`);
    }
})

router.post("/toggleMakanBot", validateSuperuser, (req, res) => {
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

        Logger.log(`SUPERUSERAPI TOGGLEMAKANBOT: MakanBot toggled to ${Cache.get("openaiChatEnabled")}.`);

        return res.status(200).send(`SUCCESS: MakanBot toggled to ${Cache.get("openaiChatEnabled")}`);
    } else {
        const saveResult = Cache.set("openaiChatEnabled", newStatus);
        if (saveResult !== true) {
            Logger.log(`SUPERUSERAPI TOGGLEMAKANBOT ERROR: Failed to toggle MakanBot; error: ${saveResult}`);
            return res.status(500).send(`ERROR: Failed to toggle MakanBot.`);
        }

        Logger.log(`SUPERUSERAPI TOGGLEMAKANBOT: MakanBot toggled to ${newStatus}.`);

        return res.status(200).send(`SUCCESS: OpenAIChat toggled to ${newStatus}`);
    }
})

router.post("/getLogs", validateSuperuser, async (req, res) => {
    if (!Logger.checkPermission()) {
        return res.status(400).send("ERROR: Logging service is not enabled.");
    }

    try {
        const logs = Logger.readLogs();
        if (typeof logs == "string") {
            Logger.log(`SUPERUSERAPI GETLOGS ERROR: Failed to retrieve logs; error: ${logs}`);
            return res.status(500).send("ERROR: Failed to retrieve logs.");
        }

        return res.status(200).json(logs);
    } catch (err) {
        return res.status(500).send("ERROR: Failed to retrieve logs.");
    }
});

router.get("/getFileManagerContext", validateSuperuser, async (req, res) => {
    try {
        const context = FileManager.getContext();
        if (typeof context == "string") {
            return res.status(500).send(context)
        } else {
            return res.send(context)
        }
    } catch (err) {
        return res.status(500).send("ERROR: Failed to retrieve file manager context.")
    }
})

router.post("/toggleSuperuserSensitive", validateSuperuser, async (req, res) => {
    if (process.env.SUPERUSER_SENSITIVE_ACTIONS_ENABLED !== "True") {
        return res.status(403).send("ERROR: Superuser sensitive actions are denied.")
    }

    const saveResult = Cache.set("superuserSensitiveActive", !(Cache.get("superuserSensitiveActive") === true));
    if (saveResult !== true) {
        Logger.log(`SUPERUSERAPI TOGGLESUPERUSERSENSITIVE ERROR: Failed to toggle superuser sensitive; error: ${saveResult}`);
        return res.status(500).send(`ERROR: Failed to toggle superuser sensitive.`);
    }

    Logger.log(`SUPERUSERAPI TOGGLESUPERUSERSENSITIVE: Superuser sensitive actions toggled to ${Cache.get("superuserSensitiveActive")}.`);

    return res.status(200).send(`SUCCESS: Superuser sensitive actions toggled to ${Cache.get("superuserSensitiveActive")}`);
})

router.post("/clearFM", validateSuperuser, validateSuperuserSensitive, async (req, res) => {
    try {
        const clearResult = await FileManager.deleteAll();
        if (clearResult !== true) {
            return res.status(500).send(`ERROR: Failed to clear file manager; error: ${clearResult}`);
        }

        return res.status(200).send("SUCCESS: File manager files cleared.");
    } catch (err) {
        return res.status(500).send("ERROR: Failed to clear file manager files.");
    }
})

router.post("/softReset", validateSuperuser, validateSuperuserSensitive, async (req, res) => {
    try {
        await Admin.destroy({ where: {} });
        await ChatHistory.destroy({ where: {} });
        await ChatMessage.destroy({ where: {} });
        await FavouriteListing.destroy({ where: {} });
        await FoodListing.destroy({ where: {} });
        await Guest.destroy({ where: {} });
        await Host.destroy({ where: {} });
        await ListingAnalytics.destroy({ where: {} });
        await RequestAnalytics.destroy({ where: {} });
        await Reservation.destroy({ where: {} });
        await Review.destroy({ where: {} });
        await ReviewLike.destroy({ where: {} });
        await SystemAnalytics.destroy({ where: {} });
        await UserRecord.destroy({ where: {} });
        await Warning.destroy({ where: {} });

        await Analytics.createRecordIfNotExist("system");

        Logger.log(`SUPERUSERAPI SOFTRESET: Database soft reset successful.`);
        console.log("SUPERUSERAPI PRESENTATIONTRANSFORM: Database soft reset successful.");
        return res.status(200).send("SUCCESS: Database soft reset successful.");
    } catch (err) {
        Logger.log(`SUPERUSERAPI SOFTRESET ERROR: Failed to soft reset database; error: ${err}`);
        return res.status(500).send("ERROR: Failed to soft reset database. This could critically cripple the system. Please run checks.")
    }
})

router.post("/presentationTransform", validateSuperuser, validateSuperuserSensitive, async (req, res) => {
    // Soft reset first
    try {
        await Admin.destroy({ where: {} });
        await ChatHistory.destroy({ where: {} });
        await ChatMessage.destroy({ where: {} });
        await FavouriteListing.destroy({ where: {} });
        await FoodListing.destroy({ where: {} });
        await Guest.destroy({ where: {} });
        await Host.destroy({ where: {} });
        await ListingAnalytics.destroy({ where: {} });
        await RequestAnalytics.destroy({ where: {} });
        await Reservation.destroy({ where: {} });
        await Review.destroy({ where: {} });
        await ReviewLike.destroy({ where: {} });
        await SystemAnalytics.destroy({ where: {} });
        await UserRecord.destroy({ where: {} });
        await Warning.destroy({ where: {} });

        Logger.log(`SUPERUSERAPI PRESENTATIONTRANSFORM: Database soft reset successful.`);
        console.log("SUPERUSERAPI PRESENTATIONTRANSFORM: Database soft reset successful.");
    } catch (err) {
        Logger.log(`SUPERUSERAPI PRESENTATIONTRANSFORM ERROR: Failed to soft reset database; error: ${err}`);
        return res.status(500).send("ERROR: Failed to soft reset database. This could critically cripple the system. Please run checks.")
    }

    // Create presentation data
    try {
        // Create Jamie Oliver
        const jamie = await Host.create({
            userID: Universal.generateUniqueID(),
            fname: "Jamie",
            lname: "Oliver",
            email: "jamieoliver@example.com",
            username: "jamieoliver",
            password: await Encryption.hash("123456"),
            contactNum: "12345678",
            approxAddress: "Jalan Arnap Road, Singapore",
            address: "10 Jalan Arnap, Singapore 249316",
            approxCoordinates: "1.3016989, 103.8284868",
            coordinates: "1.3016989, 103.8284868",
            emailVerified: true,
            foodRating: 3.5,
            hygieneGrade: 3,
            reviewsCount: 2,
        })

        // Create John Appleseed
        const john = await Admin.create({
            userID: Universal.generateUniqueID(),
            fname: "John",
            lname: "Appleseed",
            username: "johnappleseed",
            email: "johnappleseed@example.com",
            password: await Encryption.hash("123456"),
            emailVerified: true,
            role: "Manager"
        })

        // Create Susie Jones
        const susie = await Guest.create({
            userID: Universal.generateUniqueID(),
            fname: "Susie",
            lname: "Jones",
            username: "susiejones",
            email: "susiejones@example.com",
            password: await Encryption.hash("123456"),
            address: "Block 310A Anchorvale Lane Singapore 542310",
            mealsMatched: 1,
            emailVerified: true
        });

        // Create Samantha Hopkins
        const samantha = await Guest.create({
            userID: Universal.generateUniqueID(),
            fname: "Samantha",
            lname: "Hopkins",
            username: "sammyhops",
            email: "samanthahopkins@example.com",
            password: await Encryption.hash("123456"),
            contactNum: "12344567",
            address: "86 Edgedale Plains Singapore 828738",
            mealsMatched: 0,
            emailVerified: true
        })

        // Create 1 Listing for Jamie, 1 Listing (7 days ago datetime) for Jamie
        const jamiesListing = await FoodListing.create({
            listingID: Universal.generateUniqueID(),
            title: "Pani Puri",
            shortDescription: "Indian street food!",
            longDescription: "Burst of flavours every time! Join me for a tantalising meal mixed with spicy and tangy flavours!",
            images: "panipuri.jpg",
            portionPrice: 5.0,
            approxAddress: "Jalan Arnap Road, Singapore",
            address: "10 Jalan Arnap, Singapore 249316",
            totalSlots: 5,
            datetime: new Date(Date.now() + 21600000).toISOString(),
            published: true,
            approxCoordinates: "1.3016989, 103.8284868",
            hostID: jamie.userID
        })

        const jamiesPastListing = await FoodListing.create({
            listingID: Universal.generateUniqueID(),
            title: "Chips and Avocado",
            shortDescription: "Delicious burst of green flavour!",
            longDescription: "Just bought some fresh avocados from the market! Can't wait for a fresh meal with you all!",
            images: "avocado.jpg",
            portionPrice: 3.0,
            approxAddress: "Jalan Arnap Road, Singapore",
            address: "10 Jalan Arnap, Singapore 249316",
            totalSlots: 6,
            datetime: new Date(Date.now() - 604800000).toISOString(),
            published: true,
            approxCoordinates: "1.3016989, 103.8284868",
            hostID: jamie.userID
        })

        // Create Susie's active reservation for Jamie
        const susieActiveReservation = await Reservation.create({
            guestID: susie.userID,
            listingID: jamiesListing.listingID,
            referenceNum: Universal.generateUniqueID(6).toUpperCase(),
            datetime: new Date(Date.now() - 604850000).toISOString(),
            portions: 2,
            totalPrice: 10.0,
            markedPaid: true,
            paidAndPresent: true,
            chargeableCancelActive: false
        })

        // Create Susie's past reservation for Jamie
        const susiePastReservation = await Reservation.create({
            guestID: susie.userID,
            listingID: jamiesPastListing.listingID,
            referenceNum: Universal.generateUniqueID(6, [susieActiveReservation.referenceNum]).toUpperCase(),
            datetime: new Date(Date.now() - 604850000).toISOString(),
            portions: 1,
            totalPrice: 3.0,
            markedPaid: true,
            paidAndPresent: true,
            chargeableCancelActive: false
        })

        // Create Samantha's reservation with Jamie
        const samanthasActiveReservation = await Reservation.create({
            guestID: samantha.userID,
            listingID: jamiesListing.listingID,
            referenceNum: Universal.generateUniqueID(6, [susieActiveReservation.referenceNum, susiePastReservation.referenceNum]).toUpperCase(),
            datetime: new Date(Date.now() - 604850000).toISOString(),
            portions: 1,
            totalPrice: 5.0,
            markedPaid: true,
            paidAndPresent: true,
            chargeableCancelActive: false
        })

        // Create Reviews
        const review1 = await Review.create({
            reviewID: Universal.generateUniqueID(),
            foodRating: 4,
            hygieneRating: 3,
            comments: "Nice and tasty food, but cleanliness of the kitchen can be improved, saw some ants in the bowl.",
            dateCreated: new Date().toISOString(),
            guestID: samantha.userID,
            hostID: jamie.userID
        })

        const review2 = await Review.create({
            reviewID: Universal.generateUniqueID(),
            foodRating: 3,
            hygieneRating: 3,
            comments: "Food is okay. But the bowl and utensils is oily, should improve on that!",
            dateCreated: new Date().toISOString(),
            guestID: samantha.userID,
            hostID: jamie.userID
        })

        // Create Chat History between Samantha and Jamie
        const chatHistory = await ChatHistory.create({
            chatID: Universal.generateUniqueID(),
            user1ID: jamie.userID,
            user2ID: samantha.userID,
            datetime: new Date(Date.now() - 36000000).toISOString(),
        })

        // Create > 6 hour prior Chat Message in Chat History by Samantha to Jamie
        const chatMessage = await ChatMessage.create({
            messageID: Universal.generateUniqueID(),
            message: "Hi Jamie, how are you?",
            senderID: samantha.userID,
            datetime: new Date(Date.now() - 25200000).toISOString(),
            chatID: chatHistory.chatID
        })

        // Create system metrics
        const systemMetricsInstance = await Analytics.createRecordIfNotExist("system")
        if (typeof systemMetricsInstance !== "string") {
            systemMetricsInstance.set({
                lastBoot: new Date().toISOString(),
                accountCreations: 7,
                listingCreations: 4,
                emailDispatches: 8,
                fileUploads: 4,
                logins: 6
            })
            await systemMetricsInstance.save();
        }

        // Create listing analytics record
        const listingAnalyticsInstance = await Analytics.createRecordIfNotExist("listing", jamiesListing.listingID)
        if (typeof listingAnalyticsInstance !== "string") {
            listingAnalyticsInstance.set({
                impressions: 10,
                clicks: 6
            })
            await listingAnalyticsInstance.save();
        }

        const messages = [
            `Created host ${jamie.username} with user ID: ${jamie.userID}`,
            `Created admin ${john.username} with user ID: ${john.userID}`,
            `Created guest ${susie.username} with user ID: ${susie.userID}`,
            `Created guest ${samantha.username} with user ID: ${samantha.userID}`,
            `Created a listing by host ${jamie.username} (Datetime: ${new Date(jamiesListing.datetime).toString()}) with listing ID: ${jamiesListing.listingID}`,
            `Created listing by host ${jamie.username} (Datetime: ${new Date(jamiesPastListing.datetime).toString()}) with listing ID: ${jamiesPastListing.listingID}`,
            `Created Susie's active reservation (Datetime: ${new Date(susieActiveReservation.datetime).toString()}) with reference num: ${susieActiveReservation.referenceNum}`,
            `Created Susie's past reservation (Datetime: ${new Date(susiePastReservation.datetime).toString()}) with reference num: ${susiePastReservation.referenceNum}`,
            `Created Samantha's active reservation (Datetime: ${new Date(samanthasActiveReservation.datetime).toString()}) with reference num: ${samanthasActiveReservation.referenceNum}`,
            `Created Review1 with review ID for Jamie by Samantha: ${review1.reviewID}`,
            `Created Review2 with review ID for Jamie by Samantha: ${review2.reviewID}`,
            `Chat History with ID ${chatHistory.chatID} for ${chatHistory.user1ID} (Jamie) and ${chatHistory.user2ID} (Samantha)`,
            `Chat Message with ID ${chatMessage.messageID} (Datetime: ${new Date(chatMessage.datetime).toString()}) created for ${chatMessage.senderID}`
        ]

        return res.json({ messages: messages })
    } catch (err) {
        Logger.log(`SUPERUSERAPI PRESENTATIONTRANSFORM ERROR: Failed to create presentation data; error: ${err}`);
        return res.status(500).send("ERROR: Failed to create presentation data. This could critically cripple the system. Please run checks.")
    }
})

module.exports = { router, at: '/admin/super' };