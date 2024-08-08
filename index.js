require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const util = require('util');
const { FoodListing, Guest, Host, Reservation } = require('./models')
const Encryption = require("./services/Encryption")
const prompt = require("prompt-sync")({ sigint: true });
require('dotenv').config()

const env = process.env.DB_CONFIG || 'development';
const config = require('./config/config.json')[env];

const SEQUELIZE_ACTIVE = true;

// Set up services
const Universal = require('./services/Universal')

const Logger = require('./services/Logger')
Logger.setup()

const Emailer = require('./services/Emailer')
Emailer.checkContext()

const Cache = require('./services/Cache')
Cache.load();

const FileManager = require('./services/FileManager');
FileManager.setup().catch(err => { Logger.logAndThrow(err) })

const OpenAIChat = require('./services/OpenAIChat');
if (OpenAIChat.checkPermission()) {
    console.log("MAIN: OpenAI Chat service is enabled.")
    const initialisation = OpenAIChat.initialise();
    if (initialisation !== true) {
        console.log(`MAIN: OpenAI Chat service failed to initialise. Error: ${initialisation}`)
    }
}

// Import middleware
const checkHeaders = require('./middleware/headersCheck');
const logRoutes = require('./middleware/logRoutes');

// Configure express app and chat web socket server
const app = express();
app.use(cors({ exposedHeaders: ['refreshedtoken'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs");
app.set('trust proxy', true);
const startWebSocketServer = require('./routes/chat/WebSocketServer');
const { Analytics } = require('./services');
startWebSocketServer(app);

// Top-level middleware
if (config["routeLogging"] !== false) { app.use(logRoutes) }

// Main routes
app.get("/", (req, res) => {
    res.render("index", {
        currentTime: new Date().toString()
    });
});

// Register routers
app.use(checkHeaders) // Middleware to check Content-Type and API key headers
if (config["routerRegistration"] != "automated") {
    console.log("MAIN: Route registration mode: MANUAL")
    app.use(require("./routes/misc").at || '/', require("./routes/misc").router);
    app.use(require("./routes/cdn/contentDelivery").at || '/', require("./routes/cdn/contentDelivery").router);
    app.use(require("./routes/cdn/coreData").at || '/', require("./routes/cdn/coreData").router);
    app.use(require("./routes/reviews/submitReview").at || '/', require("./routes/reviews/submitReview").router);
    app.use(require("./routes/reviews/likeReview").at || '/', require("./routes/reviews/likeReview").router);
    app.use(require("./routes/reviews/manageReviews").at || '/', require("./routes/reviews/manageReviews").router);
    app.use(require('./routes/identity/createAccount').at || '/', require('./routes/identity/createAccount').router);
    app.use(require('./routes/identity/LoginAccount').at || '/', require('./routes/identity/LoginAccount').router);
    app.use(require('./routes/identity/AccountRecovery').at || '/', require('./routes/identity/AccountRecovery').router);
    app.use(require('./routes/identity/emailVerification').at || '/', require('./routes/identity/emailVerification').router);
    app.use(require("./routes/identity/myAccount").at || '/', require("./routes/identity/myAccount").router);
    app.use(require("./routes/identity/Admin/UserManagement").at || '/', require("./routes/identity/Admin/UserManagement").router);
    app.use(require("./routes/identity/Admin/HygieneReports").at || '/', require("./routes/identity/Admin/HygieneReports").router);
    app.use(require("./routes/listings/listings").at || '/', require("./routes/listings/listings").router);
    app.use(require("./routes/orders/listingDetails").at || '/', require("./routes/orders/listingDetails").router);
    app.use(require("./routes/chat/manageChat").at || '/', require("./routes/chat/manageChat").router);
} else {
    console.log("MAIN: Route registration mode: AUTOMATED")
    require('./routes').forEach(({ router, at, name }) => {
        try {
            app.use(at, router)
        } catch (err) {
            Logger.logAndThrow(`MAIN: Failed to register router auto-loaded from ${name} at '${at}'. Error: ${err}`)
        }
    })
}

async function onDBSynchronise() {
    (async () => {
        console.log(await Analytics.setup())
    
        prompt("Continue? ")
    
        console.log(await Analytics.supplementSystemMetricUpdate({
            lastBoot: new Date().toISOString(),
            totalRequests: 2
        }))

        prompt("Continue? ")

        console.log(await Analytics.supplementSystemMetricUpdate({
            logins: 4
        }))

        prompt("Continue? ")

        console.log(await Analytics.supplementSystemMetricUpdate({
            emailDispatches: 4,
            accountCreations: 3
        }))

        prompt("Continue? ")

        // console.log(await Analytics.supplementSystemMetricUpdate({
        //     totalRequests: 2
        // }))

        // console.log(await Analytics.supplementSystemMetricUpdate({
        //     totalRequests: 2
        // }))
    
        console.log(Analytics.cacheData);
    })()
    return;

    const guests = await Guest.findAll()
    var guestRecord;
    if (guests.length > 0) {
        guestRecord = guests[0]
        console.log(`Found existing guest, using as dummy. Guest User ID: ${guests[0].userID}`)
    } else {
        const newGuest = await Guest.create({
            userID: "47f4497b-1331-4b8a-97a4-095a79a1fd48",
            fname: "Susie",
            lname: "Jones",
            username: "susiejones",
            email: "susie_jones@example.com",
            password: await Encryption.hash("SusieJones123"),
            contactNum: "82228111",
            address: "Block 321, Hougang Avenue 10, #10-567",
            emailVerified: false,
            favCuisine: "",
            mealsMatched: 0,
            resetKey: "265c18",
            resetKeyExpiration: "2024-06-22T14:30:00.000Z"
        })
        if (!newGuest) {
            console.log("WARNING: Failed to create dummy guest.")
        } else {
            guestRecord = newGuest
            console.log(`Created dummy guest with User ID: ${newGuest.userID}`)
        }
    }

    const sampleHost = await Host.findByPk("272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4")
    if (!sampleHost) {
        const newHost = await Host.create({
            "userID": "272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4",
            "fname": "Jamie",
            "lname": "Oliver",
            "username": "jamieoliver",
            "email": "jamie_oliver@example.com",
            "password": await Encryption.hash("123456789"),
            "contactNum": "81118222",
            "approxAddress": "Anchorvale Lane, Singapore 542310",
            "address": "Block 310A Anchorvale Lane Singapore 542310 #10-10",
            "approxCoordinates": "1.3919526, 103.8843019",
            "coordinates": "1.3914412,103.8839746",
            "emailVerified": false,
            "favCuisine": "Mexican",
            "mealsMatched": "0",
            // "foodRating": "4",
            // "hygieneGrade": "5",
            // "paymentImage": "https://savh.org.sg/wp-content/uploads/2020/05/QRCodeS61SS0119JDBS.png"
        })

        if (!newHost) {
            console.log("WARNING: Failed to create dummy host.")
        } else {
            console.log("Created dummy host with ID: " + newHost.userID)
        }
    } else {
        console.log("Found dummy host existing already; ID: " + sampleHost.userID)
    }
}

// Start server
if (!SEQUELIZE_ACTIVE) {
    app.listen(process.env.SERVER_PORT, () => {
        console.log(`Server is running on port ${process.env.SERVER_PORT}`)
    })
} else {
    // Server initialisation with sequelize
    const db = require("./models");
    db.sequelize.sync()
        .then(() => {
            // Create sample FoodListing
            onDBSynchronise()
            console.log("SEQUELIZE: Database synchronised.")
            console.log()
            app.listen(process.env.SERVER_PORT, () => {
                console.log(`Server is running on port ${process.env.SERVER_PORT}`)
                Universal.booted = true;
            })
        })
        .catch(err => {
            console.log(err)
            console.log(`MAIN: Failed to setup sequelize. Terminating boot.`)
            process.exit(1)
        })
}