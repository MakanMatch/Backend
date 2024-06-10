const express = require('express');
const cors = require('cors');
require('dotenv').config()
require('./services/BootCheck').check()

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

// Register routers
app.use("/misc", require("./routes/misc"));

// Start server
// app.listen(process.env.SERVER_PORT, () => {
//     console.log(`Server is running on port ${process.env.SERVER_PORT}`)
// })

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