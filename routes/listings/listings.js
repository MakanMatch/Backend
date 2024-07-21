const express = require("express");
const multer = require("multer");
const router = express.Router();
const { FoodListing } = require("../../models");
const { Host, Guest } = require("../../models");
const Universal = require("../../services/Universal");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger")
const { storeImages } = require("../../middleware/storeImages");
const axios = require("axios");
const yup = require("yup");
const { validateToken } = require("../../middleware/auth");

router.post("/addListing", validateToken, async (req, res) => {
    storeImages(req, res, async (err) => {
        const addListingSchema = yup.object().shape({
            title: yup.string().trim().required(),
            shortDescription: yup.string().trim().required(),
            longDescription: yup.string().trim().required(),
            portionPrice: yup.number().required(),
            totalSlots: yup.number().required()
        });
        if (!req.body.datetime) {
            res.status(400).send("UERROR: Date and time not provided");
            return
        }

        if (req.files.length === 0) {
            res.status(400).send("UERROR: No image uploaded");
            return;
        } else {
            var validatedData;
            try {
                validatedData = await addListingSchema.validate(req.body, { abortEarly: false });
            } catch (validationError) {
                res.status(400).send(`UERROR: ${validationError.errors.join(', ')}`);
                return;
            }

            if (err instanceof multer.MulterError) {
                Logger.log(`LISTINGS ADDLISTING: Image upload error: ${err}`);
                res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`LISTINGS ADDLISTING: Internal server error: ${err}`);
                res.status(500).send("ERROR: Internal server error");
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
                Logger.log(`LISTINGS ADDLISTING: One or more image checks failed. ${req.files.length} image(s) deleted successfully.`)
                res.status(400).send("ERROR: Failed to upload image");
                return;
            }

            const hostInfo = await Host.findByPk(req.user.userID);
            if (!hostInfo) {
                res.status(404).send("ERROR: Host not found");
                return;
            }
            try {
                const encodedAddress = encodeURIComponent(String(hostInfo.address));
                const apiKey = process.env.GMAPS_API_KEY;
                const url = `https://maps.googleapis.com/maps/api/geocode/json?address="${encodedAddress}"&key=${apiKey}`;
                const response = await axios.get(url);
                const location = response.data.results[0].geometry.location;
                const coordinates = { lat: location.lat, lng: location.lng };

                const components = response.data.results[0].address_components;
                let street = '';
                let city = '';
                let state = '';

                components.forEach(component => {
                    if (component.types.includes('route')) {
                        street = component.long_name;
                    }
                    if (component.types.includes('locality')) {
                        city = component.long_name;
                    }
                    if (component.types.includes('administrative_area_level_1')) {
                        state = component.long_name;
                    }
                });
                let approximateAddress = `${street}, ${city}`;
                if (state) {
                    approximateAddress += `, ${state}`; // For contexts outside of Singapore
                }

                const formattedDatetime = req.body.datetime + ":00.000Z";
                const listingDetails = {
                    listingID: Universal.generateUniqueID(),
                    title: validatedData.title,
                    images: req.files.map(file => file.filename).join("|"),
                    shortDescription: validatedData.shortDescription,
                    longDescription: validatedData.longDescription,
                    portionPrice: validatedData.portionPrice,
                    totalSlots: validatedData.totalSlots,
                    datetime: formattedDatetime,
                    approxAddress: approximateAddress,
                    address: hostInfo.address,
                    hostID: req.user.userID,
                    coordinates: coordinates.lat + "," + coordinates.lng,
                    published: true,
                };
                const addListingResponse = await FoodListing.create(listingDetails);
                if (addListingResponse) {
                    res.status(200).json({
                        message: "SUCCESS: Food listing created successfully",
                        listingDetails,
                    });
                    Logger.log(`LISTINGS ADDLISTING ERROR: Listing with listingID ${listingDetails.listingID} created successfully.`)
                    return;
                } else {
                    res.status(400).send("ERROR: Failed to create food listing");
                    return;
                }
            } catch (error) {
                res.status(500).send("ERROR: Internal server error");
                Logger.log(`LISTINGS ADDLISTING ERROR: Internal server error: ${error}`);
                return;
            }
        }
    });
});

router.put("/toggleFavouriteListing", validateToken, async (req, res) => {
    const { userID } = req.user;
    const { listingID } = req.body;
    if (!userID || !listingID) {
        res.status(400).send("ERROR: One or more required payloads were not provided");
        return;
    }

    const findUser = await Guest.findByPk(userID) || await Host.findByPk(userID);
    if (!findUser) {
        res.status(404).send("ERROR: User not found");
        return;
    }

    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found");
        return;
    } else if (userID === findListing.hostID) {
        res.status(400).send("ERROR: Host cannot favourite their own listing");
        return;
    }

    let favCuisine = findUser.favCuisine || '';

    if (favCuisine.split("|").includes(listingID)) {
        favCuisine = favCuisine.replace(listingID + "|", "");
    } else {
        favCuisine += listingID + "|";
    }

    try {
        findUser.favCuisine = favCuisine;
        await findUser.save();
        const favourite = favCuisine.split("|").includes(listingID);
        res.status(200).json({
            message: `SUCCESS: Listing ${favourite ? 'added to' : 'removed from'} favourites successfully`,
            favourite: favourite
        });
    } catch (error) {
        res.status(400).send("ERROR: Failed to update user's favourites");
    }
});

router.delete("/deleteListing", async (req, res) => {
    const { listingID } = req.body;
    if (!listingID) {
        res.status(400).send("ERROR: One or more required payloads were not provided");
        return;
    }
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found");
        return;
    }
    const listingImages = findListing.images.split("|");
    for (let i = 0; i < listingImages.length; i++) {
        await FileManager.deleteFile(listingImages[i]);
        Logger.log(`LISTINGS DELETELISTING: Image ${listingImages[i]} deleted successfully.`)
    }
    const deleteListing = await FoodListing.destroy({ where: { listingID: listingID } });
    if (deleteListing) {
        res.status(200).json({ message: "SUCCESS: Listing deleted successfully" });
        Logger.log(`LISTINGS DELETELISTING: Listing with listingID ${listingID} deleted successfully.`)
        return;
    } else {
        res.status(400).send("ERROR: Failed to delete listing");
        return;
    }
});

module.exports = { router, at: '/listings' };
