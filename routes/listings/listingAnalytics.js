const express = require("express");
const router = express.Router();
const { Analytics, Logger } = require("../../services");

router.post("/updateImpression", async (req, res) => {
    const listingID = req.body.listingID;
    Analytics.supplementListingMetricUpdate(listingID, {
        impressions: 1
    })
    .then(result => {
        if (result !== true) {
            Logger.log(`LISTINGANALYTICS UPDATEIMPRESSIONS: Failed to update impressions. Error: ${result}`)
        }
    })
    .catch(err => {
        Logger.log(`LISTINGANALYTICS UPDATEIMPRESSIONS: Failed to update impressions. Error: ${err}`)
    })

    res.status(200).send("SUCCESS: Impression update registered.")
});

router.post("/updateClick", async (req, res) => {
    const listingID = req.body.listingID;
    Analytics.supplementListingMetricUpdate(listingID, {
        clicks: 1
    })
    .then(result => {
        if (result !== true) {
            Logger.log(`LISTINGANALYTICS UPDATEIMPRESSIONS: Failed to update impressions. Error: ${result}`)
        }
    })
    .catch(err => {
        Logger.log(`LISTINGANALYTICS UPDATEIMPRESSIONS: Failed to update impressions. Error: ${err}`)
    })

    res.status(200).send("SUCCESS: Click update registered.")
});

module.exports = { router, at: '/listingAnalytics' };