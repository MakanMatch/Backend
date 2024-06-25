require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid')
const { FoodListing } = require('./models')
require('dotenv').config()

const env = process.env.DB_CONFIG || 'development';
const config = require('./config/config.json')[env];

const SEQUELIZE_ACTIVE = true;

// Set up services
const Universal = require('./services/Universal')
const FileOps = require('./services/FileOps')

const Logger = require('./services/Logger')
Logger.setup()

const Emailer = require('./services/Emailer')
Emailer.checkContext()

const Cache = require('./services/Cache')
Cache.load();

const FileManager = require('./services/FileManager');
FileManager.setup().catch(err => { Logger.logAndThrow(err) })

const startWebSocketServer = require('./routes/chat/WebSocketServer');
startWebSocketServer();

// Import middleware
const checkHeaders = require('./middleware/headersCheck');
const logRoutes = require('./middleware/logRoutes');

// Configure express app
const app = express();
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// app.use(express.static('public'))
app.set("view engine", "ejs");

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
app.use("/misc", require("./routes/misc"));
app.use("/cdn", require("./routes/cdn/contentDelivery"));
app.use("/cdn", require("./routes/cdn/coreData"));
app.use("/reviews", require("./routes/reviews/reviews"));
app.use("/createAccount", require('./routes/identity/createAccount'));
app.use("/loginAccount", require('./routes/identity/loginAccount'));
app.use("/accountRecovery", require('./routes/identity/accountRecovery'));
app.use("/listings", require("./routes/listings/listings"));
app.use("/", require("./routes/orders/reservation"));
// app.use("/chats", require("./routes/chat/Chat"));

async function onDBSynchronise() {
    const currentDatetime = new Date()
    const datetime = new Date(currentDatetime.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const listings = await FoodListing.findAll()
    if (listings.length > 0) {
        Universal.data["DUMMY_LISTING_ID"] = listings[0].listingID
        console.log(`Found existing listing, using as dummy. Listing ID: ${listings[0].listingID}`)
    } else {
        const newListing = await FoodListing.create({
            listingID: uuidv4(),
            title: "Chili Crab for Dinner",
            images: "sample3.jpg",
            shortDescription: "Making chili crab for dinner again! Come join!",
            longDescription: "Seeing that chili crab last time was a hit, cooking some again! Bought fresh groceries from the market today for it too. Come join me for dinner!",
            portionPrice: "5.00",
            approxAddress: "Near Tampines West Community Centre, Singapore",
            address: "Block 67, Tampines Avenue 10, Singapore 520678",
            totalSlots: "5",
            datetime: datetime,
            published: false
        })
        Universal.data["DUMMY_LISTING_ID"] = newListing.listingID
        console.log(`Created dummy listing with ID: ${newListing.listingID}`)
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
    db.sequelize.sync({ alter: true })
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
        })
}