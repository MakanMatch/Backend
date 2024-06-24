const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host } = require("../../models");
const Universal = require("../../services/Universal");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger")
const { storeImages } = require("../../middleware/storeImages");

router.post("/createHost", async (req, res) => {
    // POST a new host before creating a food listing
    const data = req.body;
    try {
        const newHost = await Host.create(data);
        res.status(200).json({
            message: "SUCCESS: Host created successfully!",
            newHost,
        });
        Logger.log(`LISTINGS CREATEHOST: Sample Host with userID ${newHost.username} created successfully`)
    } catch (error) {
        res.status(400).send("UERROR: One or more required payloads were not provided.");
    }
});

router.post("/addListing", async (req, res) => {
    storeImages(req, res, async (err) => {
        if (
            !req.body.title ||
            !req.body.shortDescription ||
            !req.body.longDescription ||
            !req.body.portionPrice ||
            !req.body.totalSlots ||
            !req.body.datetime
        ) {
            res.status(400).send("UERROR: One or more required payloads were not provided");
            return;
        } else {
            if (err instanceof multer.MulterError) {
                res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                res.status(500).send("ERROR: Internal server error");
            } else if (!req.file) {
                res.status(400).send("UERROR: No file was selected to upload");
            } else {
                const uploadImageResponse = await FileManager.saveFile(req.file.filename);
                if (uploadImageResponse) {
                    const formattedDatetime = req.body.datetime + ":00.000Z";
                    const listingDetails = {
                        listingID: Universal.generateUniqueID(),
                        title: req.body.title,
                        images: req.file.filename,
                        shortDescription: req.body.shortDescription,
                        longDescription: req.body.longDescription,
                        portionPrice: req.body.portionPrice,
                        totalSlots: req.body.totalSlots,
                        datetime: formattedDatetime,
                        approxAddress: "Yishun, Singapore", // hardcoded for now
                        address: "1 North Point Dr, #01-164/165 Northpoint City, Singapore 768019", // hardcoded for now
                        hostID: "272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4", // hardcoded for now
                        published: true,
                    };
                    const addListingResponse = await FoodListing.create(listingDetails);
                    if (addListingResponse) {
                        res.status(200).json({
                            message: "SUCCESS: Food listing created successfully",
                            listingDetails,
                        });
                        Logger.log(`LISTINGS ADDLISTING: Listing with listingID ${listingDetails.listingID} created successfully.`)
                        return;
                    } else {
                        res.status(400).send("ERROR: Failed to create food listing");
                        return;
                    }
                } else {
                    res.status(400).send("ERROR: Failed to upload image");
                    return;
                }
            }
        }
    });
});

module.exports = router;
