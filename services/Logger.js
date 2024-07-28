const FileOps = require('./FileOps')
require('dotenv').config()

/**
 * Logger class to log messages to a file
 * 
 * Recommended format for log messages:
 * 
 * `ROUTENAME SERVICENAME FUNCTIONNAME [METHOD] [ERROR]: Message here`
 * 
 * Provide as many log tags as you wish to help identify the source of the log message. These log tags can be used for filtering later on to group and analyse log messages.
 * 
 * @method checkPermission: Checks if the system has permission to log messages
 * @method setup: Sets up the logger database file
 * @method log: Logs a message
 * @method destroyLogs: Deletes the logs file
 * @method readLogs: Reads all logs
 * @method logAndThrow: Logs a message and throws an error (`Error` object)
 */
class Logger {
    static logsFile = "logs.txt"

    static checkPermission() {
        return process.env.LOGGING_ENABLED === "True"
    }

    static setup() {
        if (this.checkPermission()) {
            try {
                if (!FileOps.exists(Logger.logsFile)) {
                    const datetime = new Date();
                    FileOps.writeTo(Logger.logsFile, `${datetime.toISOString()} LOGGER: Logger database file setup complete.\n`)
                }
            } catch (err) {
                console.log(`LOGGER SETUP ERROR: Failed to set up ${this.logsFile} database file. Setup permissions have been granted. Error: ${err}`)
            }
        }
    }

    static log(message, debugPrintExplicitDeny = false) {
        if (process.env.DEBUG_MODE === "True" && !debugPrintExplicitDeny) {
            console.log(message)
        }

        if (this.checkPermission()) {
            try {
                const datetime = new Date();
                FileOps.appendTo(Logger.logsFile, `${datetime.toISOString()} ${message}\n`)
            } catch (err) {
                console.log(`LOGGER LOG ERROR: Failed to log message ${message}. Error: ${err}`)
            }
        }
    }

    static destroyLogs() {
        if (FileOps.exists(Logger.logsFile)) {
            try {
                const status = FileOps.deleteFile(Logger.logsFile)
                if (status != true) {
                    console.log(`LOGGER ERROR: Failed to delete logs file. Error: ${status}`)
                }

                return
            } catch (err) {
                console.log(`LOGGER DESTROYLOGS ERROR: Failed to delete logs file. Error: ${err}`)
            }
        }
    }

    static readLogs() {
        if (!this.checkPermission()) {
            return "ERROR: Logging-related services do not have permission to operate."
        }

        if (FileOps.exists(Logger.logsFile)) {
            try {
                var logs = FileOps.read(Logger.logsFile)
                logs = logs.split("\n").filter(log => log != "")
                return logs
            } catch (err) {
                console.log(`LOGGER READALL ERROR: Failed to read logs file. Error: ${err}`)
                return `ERROR: Failed to read logs file. Error: ${err}`
            }
        } else {
            return []
        }
    }

    static logAndThrow(message) {
        this.log(message)
        throw message
    }
}

module.exports = Logger;