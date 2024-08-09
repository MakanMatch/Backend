const { Analytics, Logger } = require('../services');
const { runProcessors } = require('./responseProcessors');
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

const ignoredRoutePaths = [
    "/cdn",
    "/admin/super"
]

const isIgnoredPath = (path) => {
    for (const ignoredPath of ignoredRoutePaths) {
        if (ignoredPath == "/cdn" && Analytics.ignoreCDN() && path.startsWith(ignoredPath)) {
            return true;
        } else if (ignoredPath != "/cdn" && path.startsWith(ignoredPath)) {
            return true;
        }
    }

    return false;
}

const newRequest = async (req, res, next) => {
    // Requests should never fail due to the intervening Analytics code
    try {
        if (!Analytics.checkPermission() || isIgnoredPath(req.originalUrl)) {
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
            if (!Analytics.checkPermission() || isIgnoredPath(req.originalUrl)) {
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

            runProcessors(requestURLOnly, parsedBody);
        } catch {}

        send.call(this, body);
    }

    next();
}

module.exports = { newRequest, beforeResponse };