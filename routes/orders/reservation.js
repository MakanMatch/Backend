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

router.get("/getListingImage/:name", async (req, res) => {
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
    storeFile(req, res, async (err) => {
        if (!req.body.listingID) {
            res.status(400).send("ERROR: Listing ID not provided.")
            return
        }

        // const listingID = req.listingID
        const listingID = Universal.data["DUMMY_LISTING_ID"]
        const listing = await FoodListing.findByPk(listingID)
        if (!listing) {
            res.status(404).send("ERROR: Listing not found.")
            return
        }

        if (err) {
            res.status(400).json(err)
            return
        } else if (req.file == undefined) {
            res.status(400).send("ERROR: No file selected.")
            return
        } else {
            var fileSave = await FileManager.saveFile(req.file.filename)
            if (!fileSave) {
                res.status(400).send("ERROR: Failed to save file.")
                return
            }

            if (listing.images == null || listing.images == "") {
                listing.images = req.file.filename
            } else {
                listing.images += "|" + req.file.filename
            }
            await listing.save()
            res.json("SUCCESS: File uploaded successfully.")
            return
        }
    })
})

router.post("/updateListing", async (req, res) => {
    if (!req.body.listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    const listingID = req.body.listingID
    const listing = await FoodListing.findByPk(listingID)
    if (!listing) {
        res.status(404).send("ERROR: Listing not found.")
        return
    }

    try {
        listing.update(req.body)
        await listing.save()
        res.send("SUCCESS: Listing updated successfully.")
        return
    } catch (err) {
        res.status(400).send("ERROR: Failed to update listing.")
        return
    }
})

module.exports = router;