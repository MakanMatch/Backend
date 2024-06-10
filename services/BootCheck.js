require('dotenv').config()

class BootCheck {
    static check() {
        let requiredVariables = ["SERVER_PORT", "DB_MODE", "EMAILING_ENABLED"]
        for (let variable of requiredVariables) {
            if (process.env[variable] === undefined) {
                throw new Error(`Environment variable ${variable} is not set.`)
            }
            
            if (variable == "DB_MODE" && process.env[variable] !== "mysql" && process.env[variable] !== "sqlite") {
                throw new Error(`Environment variable ${variable} is not set to 'mysql' or 'sqlite'.`)
            } else if (variable == "DB_MODE" && process.env[variable] == "mysql") {
                requiredVariables.push("DB_CONFIG")
            }

            if (variable == "DB_CONFIG") {
                const config = require('../config/config.json')[process.env.DB_CONFIG]
                if (config === undefined) {
                    throw new Error(`Chosen database configuration ${process.env.DB_CONFIG} is not found in config/config.json.`)
                }
            }

            if (variable == "EMAILING_ENABLED" && process.env[variable] === "True") {
                if (!process.env.EMAIL_ADDRESS || !process.env.EMAIL_PASSWORD) {
                    throw new Error("EMAIL_ADDRESS or EMAIL_PASSWORD environment variables not set.")
                }
            }
        }
    }
}

module.exports = BootCheck;