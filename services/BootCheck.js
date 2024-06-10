require('dotenv').config()

class BootCheck {
    static check() {
        let requiredVariables = ["SERVER_PORT", "DB_MODE"]
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
        }
    }
}

module.exports = BootCheck;