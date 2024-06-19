const express = require('express')
const router = express.Router();
const { FoodListing } = require('../../models')
const Universal = require('../../services/Universal');
const FileManager = require('../../services/FileManager');
const { storeFile } = require('../../middleware/storeFile');

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

router.post("/uploadListingImage", async (req, res) => {
    if (!req.body.listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
    }

    // const listingID = req.listingID
    const listingID = Universal.data["DUMMY_LISTING_ID"]
    const listing = await FoodListing.findByPk(listingID)
    if (!listing) {
        res.status(404).send("ERROR: Listing not found.")
        return
    }

    storeFile(req, res, async (err) => {
        if (err) {
            res.status(400).json(err)
            return
        } else if (req.file == undefined) {
            res.status(400).send("ERROR: No file selected.")
            return
        } else {
            await FileManager.saveFile(req.file.filename)
            res.json("SUCCESS: File uploaded successfully.")
            return
        }
    })
})

module.exports = router;