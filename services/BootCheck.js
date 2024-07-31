require('dotenv').config()

/**
 * BootCheck class to check if all required environment variables are set
 * 
 * Add required environment variables to the `requiredVariables` array. You can add additional checks of your own in the for loop.
 * 
 * Add optional environment variables to the `optionalVariables` array. The class will check if they are set and log a warning if they are not.
 * 
 * @method check: Checks if all required environment variables are set
 */
class BootCheck {
    static check() {
        let requiredVariables = ["SERVER_PORT", "DB_MODE", "EMAILING_ENABLED", "JWT_KEY", "WS_PORT", "FILEMANAGER_ENABLED", "FIRESTORAGE_ENABLED", "API_KEY"]
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

            if (variable == "FIRESTORAGE_ENABLED" && process.env[variable] === "True") {
                if (!process.env.STORAGE_BUCKET_URL) {
                    throw new Error("FireStorage service is enabled but no STORAGE_BUCKET_URL environment variable is provided.")
                }
            }
        }

        let optionalVariables = ["LOGGING_ENABLED", "DEBUG_MODE", "OPENAI_API_KEY"]
        for (let variable of optionalVariables) {
            if (process.env[variable] !== undefined) {
                optionalVariables = optionalVariables.filter(v => v !== variable)
            }

            if (variable == "OPENAI_API_KEY" && process.env.OPENAI_CHAT_ENABLED == undefined || process.env.OPENAI_CHAT_ENABLED == null) {
                throw new Error("OPENAI_API_KEY environment variable is set but OPENAI_CHAT_ENABLED is not.")
            }
        }
        if (optionalVariables.length > 0) {
            console.log(`BOOTCHECK WARNING: Optional environment variable(s) ${optionalVariables.join(", ")} are not set.`)
        }
    }
}

module.exports = BootCheck;