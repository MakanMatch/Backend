const express = require('express');
const router = express.Router();
const { Analytics, Logger } = require('../../../services');
const { validateAdmin } = require('../../../middleware/auth');


router.get("/getMetrics", validateAdmin, async (req, res) => {
    if (!Analytics.checkPermission()) {
        res.status(400).send("ERROR: Analytics are not available at this time.")
        return;
    }

    var allData = {};
    try {
        var systemMetrics = await Analytics.getSystemMetrics();
        if (typeof systemMetrics == "string") {
            Logger.log(`IDENTITY ADMIN SYSTEMMETRICS ERROR: Failed to retrieve system metrics; error: ${systemMetrics}`)
            return res.status(500).send("ERROR: Failed to process request.")
        }

        if (systemMetrics.instanceID) {
            delete systemMetrics.instanceID;
        }
        if (systemMetrics.createdAt) {
            delete systemMetrics.createdAt;
        }
        if (systemMetrics.updatedAt) {
            delete systemMetrics.updatedAt
        }

        var requestMetrics = await Analytics.getRequestMetrics();
        if (!Array.isArray(requestMetrics)) {
            Logger.log(`IDENTITY ADMIN SYSTEMMETRICS ERROR: Failed to retrieve system metrics; error: ${systemMetrics}`)
            return res.status(500).send("ERROR: Failed to process request.")
        }

        requestMetrics = requestMetrics.map(request => {
            if (request.createdAt) {
                delete request.createdAt
            }
            if (request.updatedAt) {
                delete request.updatedAt
            }

            return request;
        })
        
        allData.systemAnalytics = systemMetrics;
        allData.requestAnalytics = requestMetrics;
    } catch (err) {
        Logger.log(`IDENTITY ADMIN SYSTEMMETRICS ERROR: Failed to retrieve system and request metrics for admin; error: ${err}`)
        res.status(500).send("ERROR: Failed to process request.")
        return;
    }

    return res.json(allData);
})

module.exports = { router, at: "/admin" }