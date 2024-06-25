const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger");
const { FoodListing } = require("../../models");

router.get("/getImageForListing", async (req, res) => {
    const { listingID, imageName } = req.query;
    if (!listingID || !imageName) {
        res.status(400).send("ERROR: Invalid request parameters.");
        return;
    }

    // Find the listing
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found.");
        return;
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        res.status(404).send("ERROR: Image not found.");
        return;
    }

    const listingImages = findListing.images.split("|");
    
    if (listingImages.includes(imageName) !== true) {
        res.status(404).send("ERROR: Requested image does not belong to its corresponding listing.");
        return;
    }
    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    Logger.log(`CDN GETIMAGEFORLISTING: Image(s) for listing ${listingID} sent successfully.`)
    return;
});

module.exports = router;