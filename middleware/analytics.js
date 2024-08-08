const { Analytics, Logger }  = require('../services');
require('dotenv').config();

const newRequest = async (req, res, next) => {
    if (!Analytics.checkPermission()) {
        next();
        return
    }

    const requestURLOnly = req.url.split("?")[0];

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

    Analytics.supplementSystemMetricUpdate({
        totalRequests: 1
    })
    .then(result => {
        if (result !== true) {
            Logger.log(`ANALYTICS NEWREQUEST: Failed to update system metrics. Error: ${result}`)
        }
    })
    .catch(err => {
        Logger.log(`ANALYTICS NEWREQUEST: Failed to update system metrics. Error: ${err}`)
    })
    
    // Continue to next middleware
    next();
};

module.exports = { newRequest };