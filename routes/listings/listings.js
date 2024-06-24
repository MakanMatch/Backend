const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host } = require("../../models");
const Universal = require("../../services/Universal");
const FileManager = require("../../services/FileManager");
const storeImages = require("../../middleware/storeImages");

router.post("/createHost", async (req, res) => {
    // POST a new host before creating a food listing
    const data = req.body;
    try {
        const newHost = await Host.create(data);
        res.status(200).json({
            message: "Host created successfully!",
            newHost,
        });
    } catch (error) {
        console.error("Error creating host:", error);
        res.status(400).json({
            error: "One or more required payloads were not provided.",
        });
    }
});

router.get("/hostInfo", async (req, res) => {
    try {
        // GET host info before displaying listing's host name
        const hostInfo = await Host.findByPk(
            "272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4"
        ); // hardcoded for now
        if (hostInfo) {
            res.status(200).json(hostInfo);
        } else {
            res.status(404).json({ error: "Host not found" });
        }
    } catch (error) {
        console.error("Error fetching host info:", error);
        res.status(500).json({ error: "Failed to fetch host info" });
    }
});

router.get("/", async (req, res) => {
    // GET all food listings
    try {
        const foodListings = await FoodListing.findAll();
        foodListings.map(listing => listing.images = listing.images.split("|"));
        res.status(200).json(foodListings);
    } catch (error) {
        console.error("Error retrieving food listings:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Flow: addListing -> refreshes -> fetchListings -> Image component sources from /getImageForListing?listingID=<value>&imageName=<value> -> send file back down -> Image component renders

router.get("/getImageForListing", async (req, res) => {
    const { listingID, imageName } = req.query;
    if (!listingID || !imageName) {
        res.status(400).send("ERROR: Invalid request parameters.");
        console.error("Invalid request parameters.");
        return;
    }

    // Find the listing
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found.");
        console.error("Listing not found.");
        return;
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        res.status(404).send("ERROR: Image not found.");
        console.error("Image not found.");
        return;
    }

    const listingImages = findListing.images.split("|");
    
    if (listingImages.includes(imageName) !== true) {
        res.status(404).send("ERROR: Requested image does not belong to its corresponding listing.");
        console.error("Requested image does not belong to its corresponding listing.");
        return;
    }
    res.sendFile
    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    return;
});

router.post("/addListing", async (req, res) => {
    storeImages(req, res, async (err) => {
        console.log(req.body);
        if (
            !req.body.title ||
            !req.body.shortDescription ||
            !req.body.longDescription ||
            !req.body.portionPrice ||
            !req.body.totalSlots ||
            !req.body.datetime
        ) {
            res.status(400).send(
                "One or more required payloads were not provided"
            );
            return;
        } else {
            if (err instanceof multer.MulterError) {
                console.error("Multer error:", err);
                res.status(400).send("Image upload error");
            } else if (err) {
                console.error("Unknown error occured during upload:", err);
                res.status(500).send("Internal server error");
            } else if (!req.file) {
                res.status(400).send("No file was selected to upload");
            } else {
                const uploadImageResponse = await FileManager.saveFile(
                    req.file.filename
                );
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
                        address:
                            "1 North Point Dr, #01-164/165 Northpoint City, Singapore 768019", // hardcoded for now
                        hostID: "272d3d17-fa63-49c4-b1ef-1a3b7fe63cf4", // hardcoded for now
                        published: true,
                    };
                    const addListingResponse = await FoodListing.create(
                        listingDetails
                    );
                    if (addListingResponse) {
                        res.status(200).json({
                            message: "Food listing created successfully",
                            listingDetails,
                        });
                        return;
                    } else {
                        res.status(400).send("Failed to create food listing");
                        return;
                    }
                } else {
                    res.status(400).send("Failed to upload image");
                    return;
                }
            }
        }
    });
});

module.exports = router;
