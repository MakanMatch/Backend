require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { FoodListing, Guest, Host, Reservation } = require('./models')
const Encryption = require("./services/Encryption")
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



// Import middleware
const checkHeaders = require('./middleware/headersCheck');
const logRoutes = require('./middleware/logRoutes');

// Configure express app and chat web socket server
const app = express();
app.use(cors({ exposedHeaders: ['refreshedtoken'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// app.use(express.static('public'))
app.set("view engine", "ejs");
const startWebSocketServer = require('./routes/chat/WebSocketServer');
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
    app.use(require("./routes/listings/listings").at || '/', require("./routes/listings/listings").router);
    app.use(require("./routes/orders/listingDetails").at || '/', require("./routes/orders/listingDetails").router);
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

    // jwt.sign({
    //     userID: guestRecord.userID,
    //     username: guestRecord.username,
    //     email: guestRecord.email,
    // }, process.env.JWT_KEY, { expiresIn: '24h' }, (err, token) => {
    //     if (err) {
    //         console.log("WARNING: Failed to generate dummy guest JWT.")
    //     } else {
    //         Universal.data["DUMMY_GUEST_TOKEN"] = token
    //         console.log("Generated dummy guest token. Token: " + token)
    //     }
    // })

    // const reservation = await Reservation.create({
    //     datetime: new Date().toISOString(),
    //     portions: 2,
    //     totalPrice: 20.00,
    //     markedPaid: false,
    //     paidAndPresent: false,
    //     listingID: "b77d9661-f118-453e-a9cb-2bed5e787e80",
    //     guestID: "47f4497b-1331-4b8a-97a4-095a79a1fd48",
    //     referenceNum: "abc123"
    // })

    // if (!reservation) {
    //     console.log("WARNING: Failed to create dummy reservation.")
    // } else {
    //     console.log("Created dummy reservation associated to listing with ID: " + reservation.listingID)
    // }
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