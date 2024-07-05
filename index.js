require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid')
const { FoodListing, Guest, Host } = require('./models')
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
app.use(cors())
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
    app.use("/misc", require("./routes/misc"));
    app.use("/cdn", require("./routes/cdn/contentDelivery"));
    app.use("/cdn", require("./routes/cdn/coreData"));
    app.use("/reviews", require("./routes/reviews/reviews"));
    app.use("/createAccount", require('./routes/identity/createAccount'));
    app.use("/loginAccount", require('./routes/identity/LoginAccount'));
    app.use("/accountRecovery", require('./routes/identity/AccountRecovery'));
    app.use("/identity/emailVerification", require('./routes/identity/emailVerification'));
    app.use("/identity/myAccount", require("./routes/identity/myAccount"));
    app.use("/listings", require("./routes/listings/listings"));
    app.use("/", require("./routes/orders/listingDetails"));
} else {
    console.log("MAIN: Route registration mode: AUTOMATED")
    require('./routes').forEach(({ router, at, name }) => {
        try {
            // console.log(`Registering ${name} at '${at}'`)
            app.use(at, router)
        } catch (err) {
            Logger.logAndThrow(`MAIN: Failed to register router auto-loaded from ${name} at '${at}'. Error: ${err}`)
        }
    })
}

async function onDBSynchronise() {
    const guests = await Guest.findAll()
    if (guests.length > 0) {
        Universal.data["DUMMY_GUEST_ID"] = guests[0].userID
        Universal.data["DUMMY_GUEST_USERNAME"] = guests[0].username
        console.log(`Found existing guest, using as dummy. Guest User ID: ${guests[0].userID}`)
    } else {
        const newGuest = await Guest.create({
            userID: "47f4497b-1331-4b8a-97a4-095a79a1fd48",
            username: "Susie Jones",
            email: "susie_jones@gmail.com",
            password: await Encryption.hash("SusieJones123"),
            contactNum: "82228111",
            address: "Block 321, Hougang Avenue 10, #10-567",
            emailVerified: false,
            favCuisine: "",
            mealsMatched: 0,
            resetKey: "265c18",
            resetKeyExpiration: "2024-06-22T14:30:00.000Z"
        })
        Universal.data["DUMMY_GUEST_ID"] = newGuest.userID
        Universal.data["DUMMY_GUEST_USERNAME"] = newGuest.username
        console.log(`Created dummy guest with User ID: ${newGuest.userID}`)
    }

    const joshuasHost = await Host.findByPk("272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4")
    if (!joshuasHost) {
        const newHost = await Host.create({
            "userID": "272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4",
            "username": "Jamie Oliver",
            "email": "jamie_oliver@gmail.com",
            "password": await Encryption.hash("123456789"),
            "contactNum": "81118222",
            "address": "12 Washington Avenue",
            "emailVerified": false,
            "favCuisine": "Mexican",
            "mealsMatched": "0",
            "foodRating": "4",
            "hygieneGrade": "5",
            "paymentImage": "https://savh.org.sg/wp-content/uploads/2020/05/QRCodeS61SS0119JDBS.png"
        })

        if (!newHost) {
            console.log("WARNING: Failed to create dummy host.")
        } else {
            Universal.data["DUMMY_HOST_ID"] = newHost.userID
            Universal.data["DUMMY_HOST_USERNAME"] = newHost.username
            Universal.data["DUMMY_HOST_FOODRATING"] = newHost.foodRating
            console.log("Created dummy host.")
        }
    } else {
        Universal.data["DUMMY_HOST_ID"] = joshuasHost.userID
        Universal.data["DUMMY_HOST_USERNAME"] = joshuasHost.username
        Universal.data["DUMMY_HOST_FOODRATING"] = joshuasHost.foodRating
        console.log("Found dummy host existing already, skipping creation.")
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