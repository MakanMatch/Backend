const express = require("express");
const router = express.Router();
const { Analytics, Logger } = require("../../services");
const { FoodListing } = require("../../models");

router.post("/updateImpression", async (req, res) => {
    const listingID = req.body.listingID;
    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    try {
        const listing = await FoodListing.findByPk(listingID, { attributes: ["listingID"] });
        if (!listing) {
            res.status(404).send("ERROR: Listing not found.")
            return
        }
    } catch (err) {
        res.status(500).send("ERROR: Failed to retrieve listing.")
        return
    }

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
    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    try {
        const listing = await FoodListing.findByPk(listingID, { attributes: ["listingID"] });
        if (!listing) {
            res.status(404).send("ERROR: Listing not found.")
            return
        }
    } catch (err) {
        res.status(500).send("ERROR: Failed to retrieve listing.")
        return
    }

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