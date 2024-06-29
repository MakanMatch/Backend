const { v4: uuidv4 } = require('uuid')
const { Admin, ChatHistory, ChatMessage, FoodListing, Guest, Host, Reservation, Review, Warning, sequelize } = require('./models')
require('dotenv').config()

async function resetDB() {
    console.log("Dropping tables...")
    try {
        await sequelize.drop()
        console.log("Tables dropped!")
    } catch (err) {
        console.error(err)
    }
}

async function clearFiles() {
    console.log("Clearing files...")
    const FileManager = require("./services/FileManager")
    const setupResult = await FileManager.setup();
    if (setupResult !== true) {
        console.error(setupResult)
        process.exit()
    }

    const deleteAllResult = await FileManager.deleteAll();
    if (deleteAllResult !== true) {
        console.error(deleteAllResult)
        process.exit()
    }
    console.log("Files cleared!")
}

sequelize.sync({ alter: true })
    .then(() => {
        const tools = process.argv.slice(2)
        if (tools.length == 0) {
            console.log("No tool activated.")
            return
        }
        console.log(`Tools activated: ${tools.join(", ")}`)
        console.log()

        if (tools.includes("reset")) {
            resetDB()
        }
        
        if (tools.includes("clearfiles")) {
            clearFiles()
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })