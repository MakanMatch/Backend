const { v4: uuidv4 } = require('uuid')
const prompt = require("prompt-sync")({ sigint: true });
const jwt = require('jsonwebtoken');
const { Admin, ChatHistory, ChatMessage, FavouriteListing, FoodListing, Guest, Host, ListingAnalytics, RequestAnalytics, Reservation, Review, ReviewLike, SystemAnalytics, UserRecord, Warning, sequelize } = require('./models');
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

async function createAdmin() {
    var creating = true;
    var createdAdminIDs = []
    while (creating) {
        console.log("")
        console.log("Creating a new admin...")

        const userID = uuidv4()
        try {
            const admin = await Admin.create({
                userID: userID,
                fname: prompt("Enter admin first name: "),
                lname: prompt("Enter admin last name: "),
                username: prompt("Enter admin username: "),
                email: prompt("Email (must be unique): "),
                password: await Encryption.hash(prompt("Password: ")),
                contactNum: prompt("Phone number (must be unique) (optional): ") || null,
                address: prompt("Address (optional): ") || null,
                emailVerified: prompt("Email verified? (y/n): ").toLowerCase() !== 'n',
                role: prompt("Role: ") || "MakanMatchAdmin"
            })
        } catch (err) {
            console.log("Failed to create admin; error: " + err)
            creating = prompt("Try again? (y/n) ") == "y"
            console.log("")
            continue
        }

        console.log("Admin created!")
        console.log(`Admin ID: ${userID}`)
        console.log("")
        createdAdminIDs.push(userID)

        if (prompt("Create another admin? (y/n): ").toLowerCase() !== 'y') {
            creating = false;
            console.log("")
        }
    }

    console.log(createdAdminIDs.length + " admins created successfully.")
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

// New tools: softreset, entityreset, rmimagerefs, presentationtransform

async function softReset() {
    console.log("")
    const choice = prompt("This will destroy all records in the tables. Confirm soft reset? (y/n): ")
    if (choice !== 'y') {
        return
    }

    console.log("")
    console.log("Soft resetting...")
    try {
        await Admin.destroy({ where: {} });
        await ChatHistory.destroy({ where: {} });
        await ChatMessage.destroy({ where: {} });
        await FavouriteListing.destroy({ where: {} });
        await FoodListing.destroy({ where: {} });
        await Guest.destroy({ where: {} });
        await Host.destroy({ where: {} });
        await ListingAnalytics.destroy({ where: {} });
        await RequestAnalytics.destroy({ where: {} });
        await Reservation.destroy({ where: {} });
        await Review.destroy({ where: {} });
        await ReviewLike.destroy({ where: {} });
        await SystemAnalytics.destroy({ where: {} });
        await UserRecord.destroy({ where: {} });
        await Warning.destroy({ where: {} });

        await SystemAnalytics.create({ instanceID: Universal.generateUniqueID() })

        console.log("Tables soft resetted successfully!")
    } catch (err) {
        console.log(`Failed to soft reset tables; error: ${err}`)
    }
}

async function presentationTransform() {
    console.log("")
    const choice = prompt("You will need to soft-reset the database first. Still continue? (y/n): ")
    if (choice.toLowerCase() !== 'y') {
        return
    }

    console.log("")
    await softReset()

    console.log("")
    console.log("Beginning presentation transform...")
    console.log("")

    // Create Jamie Oliver
    const jamie = await Host.create({
        userID: Universal.generateUniqueID(),
        fname: "Jamie",
        lname: "Oliver",
        email: prompt("Enter Jamie Oliver's email: ").trim(),
        username: "jamieoliver",
        password: await Encryption.hash(prompt("Enter Jamie Oliver's password: ").trim()),
        contactNum: "12345678",
        approxAddress: "Jalan Arnap Road, Singapore",
        address: "10 Jalan Arnap, Singapore 249316",
        approxCoordinates: "1.3016989, 103.8284868",
        coordinates: "1.3016989, 103.8284868",
        emailVerified: true,
        foodRating: 3.5,
        hygieneGrade: 3,
        reviewsCount: 2,
    })

    console.log("")
    console.log(`Created host ${jamie.username} with user ID: ${jamie.userID}`);
    console.log("")

    // Create John Appleseed
    const john = await Admin.create({
        userID: Universal.generateUniqueID(),
        fname: "John",
        lname: "Appleseed",
        username: "johnappleseed",
        email: prompt("Enter John Appleseed's email: ").trim(),
        password: await Encryption.hash(prompt("Enter John Appleseed's password: ").trim()),
        emailVerified: true,
        role: "Manager"
    })

    console.log("")
    console.log(`Created admin ${john.username} with user ID: ${john.userID}`);
    console.log("")

    // Create William Atkins
    // const william = await Host.create({
    //     userID: Universal.generateUniqueID(),
    //     fname: "William",
    //     lname: "Atkins",
    //     username: "williamatkins",
    //     email: "williamatkins@example.com",
    //     password: await Encryption.hash(prompt("Enter William Atkins' password: ").trim()),
    //     contactNum: "12345679",
    //     approxAddress: "Yio Chu Kang, Singapore 568059",
    //     address: "9, Yio Chu Kang Gardens, 568059",
    //     approxCoordinates: "1.381102, 103.836716",
    //     coordinates: "1.3811342, 103.8367492",
    //     emailVerified: true
    // })

    // console.log("")
    // console.log(`Created host ${william.username} with user ID: ${william.userID}`);
    // console.log("")

    // Create Susie Jones
    const susie = await Guest.create({
        userID: Universal.generateUniqueID(),
        fname: "Susie",
        lname: "Jones",
        username: "susiejones",
        email: prompt("Enter Susie Jones' email: ").trim(),
        password: await Encryption.hash(prompt("Enter password for Susie Jones: ").trim()),
        address: "Block 310A Anchorvale Lane Singapore 542310",
        mealsMatched: 1,
        emailVerified: true
    });

    console.log("")
    console.log(`Created guest ${susie.username} with user ID: ${susie.userID}`);
    console.log("")

    // Create Samantha Hopkins
    const samantha = await Guest.create({
        userID: Universal.generateUniqueID(),
        fname: "Samantha",
        lname: "Hopkins",
        username: "sammyhops",
        email: prompt("Enter Samantha Hopkins' email: ").trim(),
        password: await Encryption.hash(prompt("Enter password for Samantha Hopkins: ").trim()),
        contactNum: "12344567",
        address: "86 Edgedale Plains Singapore 828738",
        mealsMatched: 0,
        emailVerified: true
    })

    console.log("")
    console.log(`Created guest ${samantha.username} with user ID: ${samantha.userID}`)
    console.log("")

    // Create 1 Listing for Jamie, 1 Listing (7 days ago datetime) for Jamie
    const jamiesListing = await FoodListing.create({
        listingID: Universal.generateUniqueID(),
        title: "Pani Puri",
        shortDescription: "Indian street food!",
        longDescription: "Burst of flavours every time! Join me for a tantalising meal mixed with spicy and tangy flavours!",
        images: "panipuri.jpg",
        portionPrice: 5.0,
        approxAddress: "Jalan Arnap Road, Singapore",
        address: "10 Jalan Arnap, Singapore 249316",
        totalSlots: 5,
        datetime: new Date(Date.now() + 21600000).toISOString(),
        published: true,
        approxCoordinates: "1.3016989, 103.8284868",
        hostID: jamie.userID
    })

    console.log(`Created a listing by host ${jamie.username} (Datetime: ${new Date(jamiesListing.datetime).toString()}) with listing ID: ${jamiesListing.listingID}`);

    const jamiesPastListing = await FoodListing.create({
        listingID: Universal.generateUniqueID(),
        title: "Chips and Avocado",
        shortDescription: "Delicious burst of green flavour!",
        longDescription: "Just bought some fresh avocados from the market! Can't wait for a fresh meal with you all!",
        images: "avocado.jpg",
        portionPrice: 3.0,
        approxAddress: "Jalan Arnap Road, Singapore",
        address: "10 Jalan Arnap, Singapore 249316",
        totalSlots: 6,
        datetime: new Date(Date.now() - 604800000).toISOString(),
        published: true,
        approxCoordinates: "1.3016989, 103.8284868",
        hostID: jamie.userID
    })

    console.log(`Created listing by host ${jamie.username} (Datetime: ${new Date(jamiesPastListing.datetime).toString()}) with listing ID: ${jamiesPastListing.listingID}`);

    // Create Susie's active reservation for Jamie
    const susieActiveReservation = await Reservation.create({
        guestID: susie.userID,
        listingID: jamiesListing.listingID,
        referenceNum: Universal.generateUniqueID(6).toUpperCase(),
        datetime: new Date(Date.now() - 604850000).toISOString(),
        portions: 2,
        totalPrice: 10.0,
        markedPaid: true,
        paidAndPresent: true,
        chargeableCancelActive: false
    })

    console.log(`Created Susie's active reservation (Datetime: ${new Date(susieActiveReservation.datetime).toString()}) with reference num: ${susieActiveReservation.referenceNum}`);

    // Create Susie's past reservation for Jamie
    const susiePastReservation = await Reservation.create({
        guestID: susie.userID,
        listingID: jamiesPastListing.listingID,
        referenceNum: Universal.generateUniqueID(6, [susieActiveReservation.referenceNum]).toUpperCase(),
        datetime: new Date(Date.now() - 604850000).toISOString(),
        portions: 1,
        totalPrice: 3.0,
        markedPaid: true,
        paidAndPresent: true,
        chargeableCancelActive: false
    })

    console.log(`Created Susie's past reservation (Datetime: ${new Date(susiePastReservation.datetime).toString()}) with reference num: ${susiePastReservation.referenceNum}`);

    // Create Samantha's reservation with Jamie
    const samanthasActiveReservation = await Reservation.create({
        guestID: samantha.userID,
        listingID: jamiesListing.listingID,
        referenceNum: Universal.generateUniqueID(6, [susieActiveReservation.referenceNum, susiePastReservation.referenceNum]).toUpperCase(),
        datetime: new Date(Date.now() - 604850000).toISOString(),
        portions: 1,
        totalPrice: 5.0,
        markedPaid: true,
        paidAndPresent: true,
        chargeableCancelActive: false
    })

    console.log(`Created Samantha's active reservation (Datetime: ${new Date(samanthasActiveReservation.datetime).toString()}) with reference num: ${samanthasActiveReservation.referenceNum}`);

    // Create Reviews
    const review1 = await Review.create({
        reviewID: Universal.generateUniqueID(),
        foodRating: 4,
        hygieneRating: 3,
        comments: "Nice and tasty food, but cleanliness of the kitchen can be improved, saw some ants in the bowl.",
        dateCreated: new Date().toISOString(),
        guestID: samantha.userID,
        hostID: jamie.userID
    })

    console.log(`Created Review1 with review ID for Jamie by Samantha: ${review1.reviewID}`);

    const review2 = await Review.create({
        reviewID: Universal.generateUniqueID(),
        foodRating: 3,
        hygieneRating: 3,
        comments: "Food is okay. But the bowl and utensils is oily, should improve on that!",
        dateCreated: new Date().toISOString(),
        guestID: samantha.userID,
        hostID: jamie.userID
    })

    console.log(`Created Review2 with review ID for Jamie by Samantha: ${review2.reviewID}`);

    // Create Chat History between Samantha and Jamie
    const chatHistory = await ChatHistory.create({
        chatID: Universal.generateUniqueID(),
        user1ID: jamie.userID,
        user2ID: samantha.userID,
        datetime: new Date(Date.now() - 36000000).toISOString(),
    })

    console.log(`Chat History with ID ${chatHistory.chatID} for ${chatHistory.user1ID} (Jamie) and ${chatHistory.user2ID} (Samantha)`)

    // Create > 6 hour prior Chat Message in Chat History by Samantha to Jamie
    const chatMessage = await ChatMessage.create({
        messageID: Universal.generateUniqueID(),
        message: "Hi Jamie, how are you?",
        senderID: samantha.userID,
        datetime: new Date(Date.now() - 25200000).toISOString(),
        chatID: chatHistory.chatID
    })

    // Create system metrics
    const systemMetrics = await SystemAnalytics.create({
        instanceID: Universal.generateUniqueID(),
        lastBoot: new Date().toISOString(),
        accountCreations: 7,
        listingCreations: 4,
        emailDispatches: 8,
        fileUploads: 4,
        logins: 6
    })

    // Create listing analytics
    const listingAnalytics = await ListingAnalytics.create({
        listingID: jamiesListing.listingID,
        impressions: 10,
        clicks: 6
    })

    console.log(`Chat Message with ID ${chatMessage.messageID} (Datetime: ${new Date(chatMessage.datetime).toString()}) created for ${chatMessage.senderID}`)
    console.log("")

    console.log("Presentation transform successful.");
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

        if (tools.includes("createadmin")) {
            await createAdmin()
        }

        if (tools.includes("signjwt")) {
            await signJWT()
        }

        if (tools.includes("softreset")) {
            await softReset();
        }

        if (tools.includes("presentationtransform")) {
            await presentationTransform();
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })