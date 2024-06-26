const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host, Guest } = require("../../models");
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

router.post("/createGuest", async (req, res) => {
    const data = req.body;
    try {
        const newGuest = await Guest.create(data);
        res.status(200).json({
            message: "SUCCESS: Guest created successfully!",
            newGuest,
        });
        Logger.log(`LISTINGS CREATEGUEST: Sample Guest with userID ${newGuest.username} created successfully`)
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
            !req.body.datetime ||
            req.files.length === 0
        ) {
            res.status(400).send("UERROR: One or more required payloads were not provided");
            return;
        } else {
            if (err instanceof multer.MulterError) {
                res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                res.status(500).send("ERROR: Internal server error");
            } else {
                var allImagesSuccess = false;
                for (let i=0; i<req.files.length; i++) {
                    const imageFile = req.files[i];
                    const uploadImageResponse = await FileManager.saveFile(imageFile.filename);
                    if (uploadImageResponse) {
                        allImagesSuccess = true;
                    } else {
                        allImagesSuccess = false;
                        break;
                    }
                }
                if (allImagesSuccess === true) {
                    const formattedDatetime = req.body.datetime + ":00.000Z";
                    const listingDetails = {
                        listingID: Universal.generateUniqueID(),
                        title: req.body.title,
                        images: req.files.map(file => file.filename).join("|"),
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

router.put("/toggleFavouriteListing", async (req, res) => {
    const { userID, listingID } = req.body;
    if (!userID || !listingID) {
        res.status(400).send("ERROR: One or more required payloads were not provided");
        return;
    }
    const findGuest = await Guest.findByPk(userID);
    if (!findGuest) {
        res.status(404).send("ERROR: Guest not found");
        return;
    }
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found");
        return;
    }
    if (findGuest.favCuisine.split("|").includes(listingID)) {
        const removeFavourite = await Guest.update({ favCuisine: findGuest.favCuisine.replace(listingID + "|", "") }, { where: { userID: userID } }); // Removes the listingID from the guest's favCuisine field
        if (removeFavourite) {
            res.status(200).json({ message: "SUCCESS: Listing removed from favourites successfully", favourite: false });
            return;
        } else {
            res.status(400).send("ERROR: Failed to remove listing from favourites");
            return;
        }
    } else {
        const addFavourite = await Guest.update({ favCuisine: findGuest.favCuisine + listingID + "|" }, { where: { userID: userID } }); // Adds the listingID to the guest's favCuisine field
        if (addFavourite) {
            res.status(200).json({ message: "SUCCESS: Listing added to favourites successfully", favourite: true });
            return;
        } else {
            res.status(400).send("ERROR: Failed to add listing to favourites");
            return;
        }
    }
});

router.put("/updateListing", async (req, res) => {
    storeImages(req, res, async (err) => {
        if (
            !req.body.listingID ||
            !req.body.title ||
            !req.body.shortDescription ||
            !req.body.longDescription ||
            !req.body.portionPrice ||
            !req.body.totalSlots ||
            !req.body.datetime ||
            req.files.length === 0
        ) {
            res.status(400).send("UERROR: One or more required payloads were not provided");
            return;
        } else {
            if (err instanceof multer.MulterError) {
                res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                res.status(500).send("ERROR: Internal server error");
            } else {
                var allImagesSuccess = false;
                for (let i=0; i<req.files.length; i++) {
                    const imageFile = req.files[i];
                    const uploadImageResponse = await FileManager.saveFile(imageFile.filename);
                    if (uploadImageResponse) {
                        allImagesSuccess = true;
                    } else {
                        allImagesSuccess = false;
                        break;
                    }
                }
                if (allImagesSuccess === true) {
                    const formattedDatetime = req.body.datetime + ":00.000Z";
                    const listingDetails = {
                        listingID: req.body.listingID,
                        title: req.body.title,
                        images: req.files.map(file => file.filename).join("|"),
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
                    const updateListingResponse = await FoodListing.update(listingDetails, { where: { listingID: req.body.listingID } });
                    if (updateListingResponse) {
                        res.status(200).json({
                            message: "SUCCESS: Food listing updated successfully",
                            listingDetails,
                        });
                        Logger.log(`LISTINGS UPDATELISTING: Listing with listingID ${listingDetails.listingID} updated successfully.`)
                        return;
                    } else {
                        res.status(400).send("ERROR: Failed to update food listing");
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
