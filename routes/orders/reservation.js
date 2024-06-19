const express = require('express')
const router = express.Router();
const { FoodListing } = require('../../models')
const Universal = require('../../services/Universal');
const FileManager = require('../../services/FileManager');

router.get("/listingDetails", async (req, res) => {
    const dummyListingID = Universal.data["DUMMY_LISTING_ID"]
    const listing = await FoodListing.findByPk(dummyListingID)
    if (!listing || listing == null) {
        res.status(404).send("Listing not found")
        return
    }
    res.json(listing)
})

router.get("/img/:name", async (req, res) => {
    const imageName = req.params.name
    const filePrep = await FileManager.prepFile(imageName)
    if (filePrep.startsWith("ERROR") || !filePrep.startsWith("SUCCESS")) {
        res.status(400).send(filePrep)
        console.log(filePrep)
        return
    }

    res.sendFile(filePrep.substring("SUCCESS: File path: ".length))
})

module.exports = router;