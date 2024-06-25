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

sequelize.sync({ alter: true })
    .then(() => {
        if (process.argv[2] == "reset") {
            resetDB()
        } else {
            console.log("No tool activated.")
            return
        }
    })
    .catch(err => {
        console.error(err)
        process.exit()
    })