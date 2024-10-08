require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const db = require('./models');
const { Guest, Host } = db;
const { Encryption, Analytics } = require('./services');
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

if (Cache.get("usageLock") == undefined) {
    Cache.set("usageLock", false)
}

const FileManager = require('./services/FileManager');
FileManager.setup()
    .then(res => { if (res !== true) { throw new Error(res) } })
    .catch(err => { Logger.logAndThrow(err) })

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
const { newRequest, beforeResponse } = require('./middleware/analytics');

// Configure express app and chat web socket server
const app = express();
app.use(cors({ exposedHeaders: ['refreshedtoken'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs");
if (process.env.PROD_TRUST_PROXY !== undefined && (process.env.PROD_TRUST_PROXY === "True" || parseInt(process.env.PROD_TRUST_PROXY) !== NaN)) {
    const trustProxy = parseInt(process.env.PROD_TRUST_PROXY) || true
    console.log("MAIN: Setting trust proxy to " + trustProxy)
    app.set('trust proxy', trustProxy)
}
const startWebSocketServer = require('./routes/chat/WebSocketServer');
const { default: rateLimit } = require('express-rate-limit');
startWebSocketServer(app);

// Rate limiters
const standardLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false
})

const cdnLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false
})

const gptLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false
})

// Top-level middleware

/// Conditional rate limiter
var conditionalLimiter = (req, res, next) => {
    const requestURLOnly = req.originalUrl.split("?")[0]
    if (requestURLOnly.startsWith("/cdn")) {
        return cdnLimiter(req, res, next)
    } else if (requestURLOnly.startsWith("/makanBot")) {
        return gptLimiter(req, res, next)
    } else {
        return standardLimiter(req, res, next)
    }
};
app.use(conditionalLimiter)

app.use((req, res, next) => {
    if (!req.originalUrl.startsWith("/admin/super")) {
        const usageLock = Cache.get("usageLock") === true;
        if (usageLock) {
            return res.sendStatus(503)
        }
    }
    next()
})
app.use(checkHeaders)
if (config["routeLogging"] !== false) { app.use(logRoutes) }
if (Analytics.checkProcessPermission()) {
    console.log("MAIN: Registering analytics middleware.")
    app.use(newRequest)
    app.use(beforeResponse)
}

// Main routes
app.get("/", (req, res) => {
    res.render("index", {
        currentTime: new Date().toString()
    });
});

app.get('/ip', (request, response) => response.send(request.ip))

// Register routers
if (config["routerRegistration"] != "automated") {
    console.log("MAIN: Route registration mode: MANUAL")
    app.use(require("./routes/misc").at || '/', require("./routes/misc").router);

    app.use(require("./routes/cdn/contentDelivery").at || '/', require("./routes/cdn/contentDelivery").router);
    app.use(require("./routes/cdn/coreData").at || '/', require("./routes/cdn/coreData").router);

    app.use(require("./routes/chat/manageChat").at || '/', require("./routes/chat/manageChat").router);
    app.use(require("./routes/chatbot/MakanBot").at || '/', require("./routes/chatbot/MakanBot").router);

    app.use(require("./routes/identity/Admin/HygieneReports").at || '/', require("./routes/identity/Admin/HygieneReports").router);
    app.use(require("./routes/identity/Admin/superuserAPI").at || '/', require("./routes/identity/Admin/superuserAPI").router);
    app.use(require("./routes/identity/Admin/SystemMetrics").at || '/', require("./routes/identity/Admin/SystemMetrics").router);
    app.use(require("./routes/identity/Admin/UserManagement").at || '/', require("./routes/identity/Admin/UserManagement").router);

    app.use(require('./routes/identity/AccountRecovery').at || '/', require('./routes/identity/AccountRecovery').router);
    app.use(require('./routes/identity/CreateAccount').at || '/', require('./routes/identity/CreateAccount').router);
    app.use(require('./routes/identity/emailVerification').at || '/', require('./routes/identity/emailVerification').router);
    app.use(require('./routes/identity/Favourites').at || '/', require('./routes/identity/Favourites').router);
    app.use(require('./routes/identity/LoginAccount').at || '/', require('./routes/identity/LoginAccount').router);
    app.use(require('./routes/identity/MakanHistory').at || '/', require('./routes/identity/MakanHistory').router);
    app.use(require("./routes/identity/myAccount").at || '/', require("./routes/identity/myAccount").router);

    app.use(require("./routes/listings/getHostListings").at || '/', require("./routes/listings/getHostListings").router);
    app.use(require("./routes/listings/listingAnalytics").at || '/', require("./routes/listings/listingAnalytics").router);
    app.use(require("./routes/listings/listings").at || '/', require("./routes/listings/listings").router);

    app.use(require("./routes/orders/confirmReservation").at || '/', require("./routes/orders/confirmReservation").router);
    app.use(require("./routes/orders/listingDetails").at || '/', require("./routes/orders/listingDetails").router);
    app.use(require("./routes/orders/manageGuests").at || '/', require("./routes/orders/manageGuests").router);

    app.use(require("./routes/reviews/likeReview").at || '/', require("./routes/reviews/likeReview").router);
    app.use(require("./routes/reviews/manageReviews").at || '/', require("./routes/reviews/manageReviews").router);
    app.use(require("./routes/reviews/submitReview").at || '/', require("./routes/reviews/submitReview").router);
} else {
    console.log("MAIN: Route registration mode: AUTOMATED")
    require('./routes').forEach(({ router, at, name }) => {
        try {
            if (at == "/admin/super") {
                console.log("MAIN: Registering superuser API.")
            }
            app.use(at, router)
        } catch (err) {
            Logger.logAndThrow(`MAIN: Failed to register router auto-loaded from ${name} at '${at}'. Error: ${err}`)
        }
    })
}

async function onDBSynchronise() {
    // SQL-reliant service setup
    if (Analytics.checkProcessPermission()) {
        Analytics.setup(true)
            .then(result => {
                if (result !== true) {
                    console.log(`MAIN ANALYTICS SETUP ERROR: Failed to setup Analytics; error: ${result}`)
                    Logger.log(`MAIN ANALYTICS SETUP ERROR: Failed to setup Analytics; error: ${result}`)
                }
            })
            .catch(err => {
                Logger.log(`MAIN ANALYTICS SETUP ERROR: Failed to setup Analytics; error: ${err}`)
            })
    }

    if (process.env.DEBUG_MODE === "True") {
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
                emailVerificationTime: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString(),
                password: await Encryption.hash("SusieJones123"),
                contactNum: "82228111",
                address: "Block 321, Hougang Avenue 10, #10-567",
                emailVerified: true,
                favCuisine: "",
                mealsMatched: 0
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
                "emailVerificationTime": new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString(),
                "password": await Encryption.hash("123456789"),
                "contactNum": "81118222",
                "approxAddress": "Anchorvale Lane, Singapore 542310",
                "address": "Block 310A Anchorvale Lane Singapore 542310 #10-10",
                "approxCoordinates": "1.3919526, 103.8843019",
                "coordinates": "1.3914412,103.8839746",
                "emailVerified": true,
                "favCuisine": "Mexican",
                "mealsMatched": 0
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
}

// Start server
if (!SEQUELIZE_ACTIVE) {
    app.listen(process.env.SERVER_PORT, () => {
        console.log(`MAIN: Server is running on port ${process.env.SERVER_PORT}`)
    })
} else {
    // Server initialisation with sequelize
    db.sequelize.sync()
        .then(() => {
            // Create sample FoodListing
            onDBSynchronise()
            console.log("MAIN SEQUELIZE: Database synchronised.")
            console.log()
            app.listen(process.env.SERVER_PORT, () => {
                console.log(`MAIN: Server is running on port ${process.env.SERVER_PORT}`)
                Universal.booted = true;
            })
        })
        .catch(err => {
            console.log(err)
            console.log(`MAIN: Failed to setup sequelize. Terminating boot.`)
            process.exit(1)
        })
}