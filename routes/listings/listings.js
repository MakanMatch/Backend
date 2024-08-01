const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host, Guest, UserRecord, FavouriteListing } = require("../../models");
const Universal = require("../../services/Universal");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger")
const { storeImages } = require("../../middleware/storeImages");
const axios = require("axios");
const yup = require("yup");
const { validateToken } = require("../../middleware/auth");
const { Op } = require("sequelize");

router.post("/addListing", validateToken, async (req, res) => {
    storeImages(req, res, async (err) => {
        const addListingSchema = yup.object().shape({
            title: yup.string().trim().required(),
            shortDescription: yup.string().trim().required(),
            longDescription: yup.string().trim().required(),
            portionPrice: yup.number().min(1).max(10).required(),
            totalSlots: yup.number().min(1).max(10).required(),
            datetime: yup.string().trim().required(),
            publishInstantly: yup.boolean().required()
        });

        if (req.files.length === 0) {
            return res.status(400).send("UERROR: No image was uploaded");
        } else {
            var validatedData;
            try {
                validatedData = await addListingSchema.validate(req.body, { abortEarly: false });
            } catch (validationError) {
                return res.status(400).send("UERROR: One or more entered fields are invalid");
            }

            if (err instanceof multer.MulterError) {
                Logger.log(`LISTINGS ADDLISTING: Image upload error: ${err}`);
                return res.status(400).send("UERROR: Image(s) not accepted");
            } else if (err) {
                Logger.log(`LISTINGS ADDLISTING: Internal server error: ${err}`);
                return res.status(500).send("ERROR: Failed to process image(s)");
            }
            var allImagesSuccess = false;
            for (let i = 0; i < req.files.length; i++) {
                const imageFile = req.files[i];
                const uploadImageResponse = await FileManager.saveFile(imageFile.filename);
                if (uploadImageResponse) {
                    allImagesSuccess = true;
                } else {
                    allImagesSuccess = false;
                    break;
                }
            }
            if (!allImagesSuccess) {
                // Delete all images if one or more images failed to upload
                for (let i = 0; i < req.files.length; i++) {
                    await FileManager.deleteFile(req.files[i].filename);
                }
                Logger.log(`LISTINGS ADDLISTING ERROR: One or more image checks failed. ${req.files.length} image(s) deleted successfully.`)
                return res.status(400).send("ERROR: Failed to upload image(s)");
            }

            const hostInfo = await Host.findByPk(req.user.userID);
            if (!hostInfo) {
                return res.status(404).send("UERROR: Your account details were not found");
            }
            try {
                const listingDetails = {
                    listingID: Universal.generateUniqueID(),
                    title: validatedData.title,
                    images: req.files.map(file => file.filename).join("|"),
                    shortDescription: validatedData.shortDescription,
                    longDescription: validatedData.longDescription,
                    portionPrice: validatedData.portionPrice,
                    totalSlots: validatedData.totalSlots,
                    datetime: validatedData.datetime,
                    approxAddress: hostInfo.approxAddress,
                    address: hostInfo.address,
                    hostID: hostInfo.userID,
                    coordinates: hostInfo.approxCoordinates,
                    published: validatedData.publishInstantly,
                };
                const addListingResponse = await FoodListing.create(listingDetails);
                if (addListingResponse) {
                    Logger.log(`LISTINGS ADDLISTING ERROR: Listing with listingID ${listingDetails.listingID} created successfully.`)
                    return res.status(200).json({
                        message: "SUCCESS: Food listing created successfully",
                        listingDetails,
                    });
                } else {
                    return res.status(400).send("ERROR: Failed to create food listing");
                }
            } catch (error) {
                Logger.log(`LISTINGS ADDLISTING ERROR: Internal server error: ${error}`);
                return res.status(500).send("ERROR: Internal server error");
            }
        }
    });
});

router.get("/getFavouritedListingsID", validateToken, async (req, res) => {
    const userID = req.user.userID;
    
    const userRecord = await UserRecord.findOne({
        where: {
            [Op.or]: [
                { hID: userID },
                { gID: userID },
                { aID: userID }
            ]
        },
        include: [{
            attributes: ["listingID"],
            model: FoodListing,
            as: "favourites",
        }]
    });
    if (!userRecord) {
        res.status(404).send("ERROR: User not found");
        return;
    }

    if (userRecord.favourites.length === 0) {
        res.status(200).json([]);
        return;
    }

    var listings = [];
    for (let i = 0; i < userRecord.favourites.length; i++) {
        listings.push(userRecord.favourites[i].listingID);
    }

    res.status(200).json(listings);
    return;
});

router.put("/toggleFavouriteListing", validateToken, async (req, res) => {
    const userID = req.user.userID;
    const { listingID } = req.body;
    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided");
        return;
    }
 
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        return res.status(404).send("ERROR: Listing doesn't exist");
    } else if (userID === findListing.hostID) {
        return res.status(400).send("UERROR: Hosts cannot add their own listings to favourites");
    }

    const userRecord = await UserRecord.findOne({
        attributes: ["recordID"],
        where: {
            [Op.or]: [
                { hID: userID },
                { gID: userID },
                { aID: userID }
            ]
        },
        include: [
            {
                model: FoodListing,
                as: "favourites"
            }
        ]
    })
    if (!userRecord) {
        res.status(404).send("ERROR: User not found");
        return;
    }
    
    var favListing = userRecord.favourites.filter(favListing => favListing.listingID == listingID) // returns a list with, if the listing has been favourited, the first index as the favourited listing
    
    if (favListing[0]) {
        const favListingRecord = favListing[0].FavouriteListing // get the FavouriteListing model record of the FoodListing that the user wants to unfavourite
        const deleteFavourite = await favListingRecord.destroy() // delete FavouriteListing 
        if (deleteFavourite) {
            res.status(200).json({
                message: "SUCCESS: Listing removed from favourites successfully",
                favourite: false
            });
            return;
        } else {
            res.status(400).send("ERROR: Failed to remove listing from favourites");
            return;
        }
    } else {
        const addFavourite = await FavouriteListing.create({
            listingID: listingID,
            userRecordID: userRecord.recordID
        });
        if (addFavourite) {
            res.status(200).json({
                message: "SUCCESS: Listing added to favourites successfully",
                favourite: true
            });
            return;
        } else {
            res.status(400).send("ERROR: Failed to add listing to favourites");
            return;
        }
    }
});

router.delete("/deleteListing", async (req, res) => {
    const { listingID } = req.body;
    if (!listingID) {
        return res.status(400).send("ERROR: One or more required payloads were not provided");
    }
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        return res.status(404).send("ERROR: Listing doesn't exist");
    }
    const listingImages = findListing.images.split("|");
    for (let i = 0; i < listingImages.length; i++) {
        await FileManager.deleteFile(listingImages[i]);
        Logger.log(`LISTINGS DELETELISTING: Image ${listingImages[i]} deleted successfully.`)
    }
    const deleteListing = await FoodListing.destroy({ where: { listingID: listingID } });
    if (deleteListing) {
        Logger.log(`LISTINGS DELETELISTING: Listing with listingID ${listingID} deleted successfully.`)
        return res.status(200).send("SUCCESS: Listing deleted successfully");
    } else {
        return res.status(400).send("ERROR: Failed to delete listing");
    }
});

module.exports = { router, at: '/listings' };
