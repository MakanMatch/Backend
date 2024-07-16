const { v4: uuidv4 } = require('uuid')
const prompt = require("prompt-sync")({ sigint: true });
const { Admin, ChatHistory, ChatMessage, FoodListing, Guest, Host, Reservation, Review, Warning, sequelize } = require('./models');
const Encryption = require('./services/Encryption');
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

async function createHost() {
    var creating = true;
    var createdHostIDs = []
    while (creating) {
        console.log("")
        console.log("Creating a new host...")

        const userID = uuidv4()
        try {
            const host = await Host.create({
                userID: userID,
                email: prompt("Email (must be unique): "),
                password: await Encryption.hash(prompt("Password: ")),
                username: prompt("Username (must be unique): "),
                contactNum: prompt("Phone number (must be unique): "),
                address: prompt("Address: "),
                emailVerified: prompt("Email verified? (y/n): ").toLowerCase() !== 'n',
                favCuisine: prompt("Favourite cuisine (optional): ") || null,
                mealsMatched: parseInt(prompt("Meals matched (optional): ")) || 0,
                foodRating: parseFloat(prompt("Food rating (optional): ")) || null,
                hygieneGrade: parseFloat(prompt("Hygiene grade (optional): ")) || null,
                paymentImage: prompt("Payment image (optional): ") || null
            })
        } catch (err) {
            console.log("Failed to create host; error: " + err)
            creating = prompt("Try again? (y/n) ") == "y"
            console.log("")
            continue
        }

        console.log("Host created!")
        console.log(`Host ID: ${userID}`)
        console.log("")
        createdHostIDs.push(userID)

        if (prompt("Create another host? (y/n): ").toLowerCase() !== 'y') {
            creating = false;
            console.log("")
        }
    }

    console.log(createdHostIDs.length + " hosts created successfully.")
}

async function createGuest() {
    var creating = true;
    var createdGuestIDs = []
    while (creating) {
        console.log("")
        console.log("Creating a new guest...")

        const userID = uuidv4()
        try {
            const guest = await Guest.create({
                userID: userID,
                email: prompt("Email (must be unique): "),
                password: await Encryption.hash(prompt("Password: ")),
                username: prompt("Username (must be unique): "),
                contactNum: prompt("Phone number (must be unique) (optional): ") || null,
                address: prompt("Address (optional): ") || null,
                emailVerified: prompt("Email verified? (y/n): ").toLowerCase() !== 'n',
                favCuisine: prompt("Favourite cuisine (optional): ") || null,
                mealsMatched: parseInt(prompt("Meals matched (optional): ")) || 0
            })
        } catch (err) {
            console.log("Failed to create guest; error: " + err)
            creating = prompt("Try again? (y/n) ") == "y"
            console.log("")
            continue
        }

        console.log("Guest created!")
        console.log(`Guest ID: ${userID}`)
        console.log("")
        createdGuestIDs.push(userID)

        if (prompt("Create another guest? (y/n): ").toLowerCase() !== 'y') {
            creating = false;
            console.log("")
        }
    }

    console.log(createdGuestIDs.length + " guests created successfully.")
}

sequelize.sync({ alter: true })
    .then(async () => {
        const tools = (process.argv.slice(2)).map(t => t.toLowerCase())
        if (tools.length == 0) {
            console.log("No tool activated.")
            return
        }
        console.log(`Tools activated: ${tools.join(", ")}`)
        console.log()

        if (tools.includes("reset")) {
            await resetDB()
        }

        if (tools.includes("clearfiles")) {
            await clearFiles()
        }

        if (tools.includes("createhost")) {
            await createHost()
        }

        if (tools.includes("createguest")) {
            await createGuest()
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })