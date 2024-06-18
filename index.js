const express = require('express');
const cors = require('cors');
require('dotenv').config()

const SEQUELIZE_ACTIVE = true;

// Set up services
require('./services/BootCheck').check()
const FileOps = require('./services/FileOps')

const Logger = require('./services/Logger')
Logger.setup()

const Emailer = require('./services/Emailer')
Emailer.checkContext()

const FileManager = require('./services/FileManager')
FileManager.setup().catch(err => { Logger.logAndThrow(err) })

// Configure express app
const app = express();
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// app.use(express.static('public'))
app.set("view engine", "ejs");

// Top-level middleware

// Main routes
app.get("/", (req, res) => {
    res.render("index", {
        currentTime: new Date().toString()
    });
})

const reviewsRouter = require("./routes/reviews/reviews");

app.use("/reviews", reviewsRouter);

// Register routers
app.use("/misc", require("./routes/misc"));
app.use("/orders", require("./routes/orders/preOrder"));
app.use("/reviews", require("./routes/reviews/reviews"));

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
            console.log("SEQUELIZE: Database synchronised.")
            console.log()
            app.listen(process.env.SERVER_PORT, () => {
                console.log(`Server is running on port ${process.env.SERVER_PORT}`)
            })
        })
        .catch(err => {
            console.error(err)
        })
}