const express = require('express')
const router = express.Router();
const { FoodListing } = require('../../models')
const Universal = require('../../services/Universal');
const FileManager = require('../../services/FileManager');
const { storeFile } = require('../../middleware/storeFile');
const Logger = require('../../services/Logger');
const yup = require('yup');
const Extensions = require('../../services/Extensions');
const { validateToken } = require('../../middleware/auth');

router.post("/uploadListingImage", validateToken, async (req, res) => {
    storeFile(req, res, async (err) => {
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

        const userID = req.user.userID
        if (listing.hostID != userID) {
            res.status(403).send("ERROR: You are not the host of this listing.")
            return
        }

        if (err) {
            res.status(400).send("ERROR: Failed to upload file. Error: " + err)
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
            res.send("SUCCESS: File uploaded successfully.")

            Logger.log(`ORDERS LISTINGDETAILS UPLOADLISTINGIMAGE: Uploaded image '${req.file.filename}' for listing '${listingID}'.`)
            return
        }
    })
})

router.post("/deleteListingImage", validateToken, async (req, res) => {
    if (!req.body.listingID || !req.body.imageName) {
        res.status(400).send("ERROR: One or more required payloads were not provided.")
        return
    }

    const listingID = req.body.listingID
    const imageName = req.body.imageName
    const userID = req.user.userID;

    const listing = await FoodListing.findByPk(listingID)
    if (!listing) {
        res.status(404).send("ERROR: Listing not found.")
        return
    }

    if (listing.hostID != userID) {
        res.status(403).send("ERROR: You are not the host of this listing.")
        return
    }

    if (listing.images == null || !listing.images.split("|").includes(imageName)) {
        res.status(404).send("ERROR: Image not found in listing.")
        return
    }

    try {
        const fileDelete = await FileManager.deleteFile(imageName)
        if (fileDelete !== true) {
            if (fileDelete != "ERROR: File does not exist.") {
                Logger.log("ORDERS LISTINGDETAILS DELETELISTINGIMAGE ERROR: Failed to delete image from storage; error: " + fileDelete)
                res.status(500).send("ERROR: Failed to delete image.")
                return
            } else {
                Logger.log("ORDERS LISTINGDETAILS DELETELISTINGIMAGE WARNING: Unexpected FM response in deleting image from storage; response: " + fileDelete)
            }
        }

        const listingImages = listing.images.split("|")
        const newImages = listingImages.filter(image => image != imageName)
        listing.images = newImages.join("|")
        await listing.save()
    } catch (err) {
        Logger.log("ORDERS LISTINGDETAILS DELETELISTINGIMAGE ERROR: Failed to delete image attached to listing in database; error: " + err)
        res.status(500).send("ERROR: Failed to delete image.")
        return
    }

    Logger.log(`ORDERS LISTINGDETAILS DELETELISTINGIMAGE: Deleted image '${imageName}' from listing '${listingID}'.`)
    res.send("SUCCESS: Image deleted successfully.")
    return
})

router.post("/updateListing", validateToken, async (req, res) => {
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

    const userID = req.user.userID
    if (listing.hostID != userID) {
        res.status(403).send("ERROR: You are not the host of this listing.")
        return
    }

    const validationSchema = yup.object({
        title: yup.string(),
        shortDescription: yup.string().max(50),
        longDescription: yup.string().max(350),
        portionPrice: yup.number(),
        approxAddress: yup.string(),
        totalSlots: yup.number(),
        datetime: yup.string(),
        published: yup.boolean()
    })

    let newData = Extensions.filterDictionary(req.body, (key) => key != "listingID")
    try {
        newData = validationSchema.validateSync(newData, { abortEarly: false })
        if (Object.keys(newData).length == 0) {
            res.status(200).send("SUCCESS: Nothing to update.")
            return
        }
    } catch (err) {
        // send back errors
        res.status(400).send(`ERROR: Data validation errors occurred. Errors: ${err.errors.join(", ")}`)
        return
    }

    try {
        listing.update(newData)
        await listing.save()

        Logger.log(`ORDERS LISTINGDETAILS UPDATELISTING: Listing '${listingID}' updated.`)
        res.send("SUCCESS: Listing updated successfully.")
        return
    } catch (err) {
        res.status(400).send("ERROR: Failed to update listing.")
        return
    }
})

module.exports = { router };