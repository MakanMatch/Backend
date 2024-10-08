const express = require('express')
const router = express.Router();
const { FoodListing, Guest, Reservation, Host } = require('../../models')
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
    const listing = await FoodListing.findByPk(listingID, {
        include: [
            {
                model: Guest,
                as: "guests",
                attributes: ["userID"],
                through: {
                    model: Reservation,
                    as: "Reservation",
                    attributes: ["portions"]
                }
            },
            {
                model: Host,
                as: "Host",
                attributes: ["userID", "paymentImage"]
            }
        ]
    })
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
        res.status(400).send(`ERROR: Data validation errors occurred. Errors: ${err.errors.join(" ")}`)
        return
    }

    const alreadyReservedSlots = listing.guests.map(g => g.Reservation.portions).reduce((t, n) => t + n, 0)
    if (newData.totalSlots < alreadyReservedSlots) {
        res.status(400).send("UERROR: Total slots cannot be less than the number of reserved slots.")
        return
    }

    if (newData.published === true && listing.Host.paymentImage == null) {
        res.status(400).send("UERROR: Upload a PayNow QR code image before publishing the listing.")
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

router.post("/deleteListing", validateToken, async (req, res) => {
    const hostID = req.user.userID;
    const listingID = req.body.listingID;
    if (!listingID || typeof listingID !== "string") {
        return res.status(400).send("ERROR: Listing ID not provided or invalid.")
    }

    var listing;
    try {
        listing = await FoodListing.findByPk(listingID)
        if (!listing) {
            return res.status(200).send("SUCCESS: Listing does not exist.")
        }
    } catch (err) {
        Logger.log(`ORDERS LISTINGDETAILS DELETELISTING ERROR: Failed to retrieve listing '${listingID}'; error: ${err}`)
        return res.status(500).send("ERROR: Failed to retrieve listing.")
    }

    if (req.user.userType !== "Admin" && listing.hostID != hostID) {
        return res.status(403).send("ERROR: You are not the host of this listing.")
    }

    const listingImages = structuredClone(listing.images.split("|"))

    try {
        await listing.destroy()
        Logger.log(`ORDERS LISTINGDETAILS DELETELISTING: Listing with ID '${listingID}' deleted by host.`)
    } catch (err) {
        Logger.log(`ORDERS LISTINGDETAILS DELETELISTING ERROR: Failed to delete listing '${listingID}'; error: ${err}`)
        return res.status(500).send("ERROR: Failed to delete listing.")
    }

    for (const image of listingImages) {
        try {
            const fileDeletion = await FileManager.deleteFile(image)
            if (fileDeletion !== true) {
                if (fileDeletion != "ERROR: File does not exist.") {
                    Logger.log(`ORDERS LISTINGDETAILS DELETELISTING WARNING: Unexpected FM response in deleting image '${image}'; response: ${fileDeletion}`)
                }
            }
        } catch (err) {
            Logger.log(`ORDERS LISTINGDETAILS DELETELISTING WARNING: Failed to delete image '${image}' from storage; error: ${err}`)
        }
    }

    return res.status(200).send("SUCCESS: Listing deleted successfully.")
})

module.exports = { router };