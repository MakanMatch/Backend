const Analytics = require("../../services/Analytics")
const Logger = require("../../services/Logger")

module.exports = (requestURL, parsedBody) => {
    if (requestURL == "/createAccount" && typeof parsedBody == "string" && parsedBody.startsWith("SUCCESS")) {
        // console.log("Supplementing account creation metric...")
        Analytics.supplementSystemMetricUpdate({
            accountCreations: 1
        })
            .then(result => {
                if (result !== true) {
                    Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement account creation. Error: ${result}`)
                }

                Analytics.persistData()
                    .then(persistResult => {
                        if (persistResult !== true) {
                            Logger.log(`ANALYTICS BEFORERESPONSE: Failed to persist account creation supplement. Error: ${persistResult}`)
                        }
                    })
                    .catch(err => {
                        Logger.log(`ANALYTICS BEFORERESPONSE: Failed to persist account creation supplement. Error: ${err}`)
                    })
            })
            .catch(err => {
                Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement account creation. Error: ${err}`)
            })
    }
}