const { Analytics, Logger } = require('../services');
require('dotenv').config();

const processBody = (jsonString) => {
    try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === "object") {
            return o;
        } else {
            return jsonString
        }
    } catch { return jsonString };
}

const newRequest = async (req, res, next) => {
    // Requests should never fail due to the intervening Analytics code
    try {
        if (!Analytics.checkPermission() || (Analytics.ignoreCDN() && req.originalUrl.startsWith("/cdn"))) {
            next();
            return
        }

        const requestURLOnly = req.originalUrl.split("?")[0];

        Analytics.supplementRequestMetricUpdate(requestURLOnly, req.method, {
            requestsCount: 1,
            lastRequest: new Date().toISOString()
        })
            .then(result => {
                if (result !== true) {
                    Logger.log(`ANALYTICS NEWREQUEST: Failed to update request metrics. Error: ${result}`)
                }
            })
            .catch(err => {
                Logger.log(`ANALYTICS NEWREQUEST: Failed to update request metrics. Error: ${err}`)
            })
    } catch {}

    // Continue to next middleware
    next();
};

const beforeResponse = async (req, res, next) => {
    var send = res.send;
    res.send = function (body) {
        // Requests should never fail due to intervening Analytics code
        try {
            // Analyse response body
            if (!Analytics.checkPermission() || (Analytics.ignoreCDN() && req.originalUrl.startsWith("/cdn"))) {
                send.call(this, body);
                next();
                return
            }

            const requestURLOnly = req.originalUrl.split("?")[0];
            const parsedBody = processBody(body);

            // Update request success status
            if (res.statusCode == 200) {
                Analytics.supplementRequestMetricUpdate(requestURLOnly, req.method, {
                    successResponses: 1
                })
                    .then(result => {
                        if (result !== true) {
                            Logger.log(`ANALYTICS BEFORERESPONSE: Failed to update request success status. Error: ${result}`)
                        }
                    })
                    .catch(err => {
                        Logger.log(`ANALYTICS BEFORERESPONSE: Failed to update request success status. Error: ${err}`)
                    })
            }

            if (requestURLOnly == "/createAccount" && typeof parsedBody == "string" && parsedBody.startsWith("SUCCESS")) {
                console.log("Supplementing account creation metric...")
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
            } else if (requestURLOnly == "/loginAccount" && typeof parsedBody == "object" && parsedBody.message && typeof parsedBody.message === "string" && parsedBody.message.startsWith("SUCCESS")) {
                console.log("Supplementing account login...")
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
            } else if (requestURLOnly == "/listings/addListing" && typeof parsedBody == "object" && parsedBody.message && typeof parsedBody.message == "string" && parsedBody.message.startsWith("SUCCESS")) {
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
        } catch {}

        send.call(this, body);
    }

    next();
}

module.exports = { newRequest, beforeResponse };