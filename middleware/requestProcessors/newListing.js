const Analytics = require("../../services/Analytics")
const Logger = require("../../services/Logger")

module.exports = (requestURL, parsedBody) => {
    if (requestURL == "/listings/addListing" && typeof parsedBody == "object" && parsedBody.message && typeof parsedBody.message == "string" && parsedBody.message.startsWith("SUCCESS")) {
        console.log("Supplementing listing creation...")
        Analytics.supplementSystemMetricUpdate({
            listingCreations: 1
        })
            .then(result => {
                if (result !== true) {
                    Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement listing creation. Error: ${result}`)
                }
            })
            .catch(err => {
                Logger.log(`ANALYTICS BEFORERESPONSE: Failed to supplement listing creation. Error: ${err}`)
            })
    }
}