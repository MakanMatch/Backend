const { v4: uuidv4 } = require('uuid')
const prompt = require("prompt-sync")({ sigint: true });
const jwt = require('jsonwebtoken');
const { Admin, ChatHistory, ChatMessage, FoodListing, Guest, Host, Reservation, Review, Warning, sequelize } = require('./models');
const Encryption = require('./services/Encryption');
const Universal = require('./services/Universal');
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

async function signJWT() {
    console.log("")
    if (!process.env.JWT_KEY) { console.log("JWT_KEY not found in .env; aborting..."); return; }
    var signMore = true;
    while (signMore) {
        var username = prompt("Username of account for JWT: ")
        var user = null;
        var userType = null;

        while (user == null) {
            console.log("Locating user...")
            // Check in Guest
            user = await Guest.findOne({ where: { username: username } })
            userType = 'Guest';

            // Check in Host if not found in Guest
            if (!user) {
                user = await Host.findOne({ where: { username: username } });
                userType = 'Host';
            }

            // Check in Admin if not found in Guest or Host
            if (!user) {
                user = await Admin.findOne({ where: { username: username } })
                userType = 'Admin';
            }

            if (!user) {
                console.log("User not found. Please try again.")
                username = prompt("Account username: ")
            }
            console.log("")
        }

        console.log("Signing JWT...")
        const accessToken = jwt.sign(
            {
                userID: user.userID,
                username: user.username,
                userType: userType
            },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );
        console.log("Signed JWT: " + accessToken)
        console.log("")
        signMore = prompt("Sign another? (y/n): ").toLowerCase() === 'y'
    }
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
  
        if (tools.includes("signjwt")) {
            await signJWT()
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })