const Analytics = require("../../services/Analytics")
const Logger = require("../../services/Logger")

module.exports = (requestURL, parsedBody) => {
    if (requestURL == "/loginAccount" && typeof parsedBody == "object" && parsedBody.message && typeof parsedBody.message === "string" && parsedBody.message.startsWith("SUCCESS")) {
        // console.log("Supplementing account login...")
        Analytics.supplementSystemMetricUpdate({
            logins: 1
        })
            .then(result => {
                if (result !== true) {
                    Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement account login. Error: ${result}`)
                }

                Analytics.persistData()
                    .then(persistResult => {
                        if (persistResult !== true) {
                            Logger.log(`ANALYTICS BEFORERESPONSE: Failed to persist account login supplement. Error: ${persistResult}`)
                        }
                    })
                    .catch(err => {
                        Logger.log(`ANALYTICS BEFORERESPONSE: Failed to persist account login supplement. Error: ${err}`)
                    })
            })
            .catch(err => {
                Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement account login. Error: ${err}`)
            })
    }
}