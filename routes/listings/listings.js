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

router.post("/addListing", async (req, res) => {
    storeImages(req, res, async (err) => {
        if (
            !req.body.title ||
            !req.body.shortDescription ||
            !req.body.longDescription ||
            !req.body.portionPrice ||
            !req.body.totalSlots ||
            !req.body.datetime ||
            !req.body.hostID ||
            req.files.length === 0
        ) {
            console.log(req.body);
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
                    const hostInfo = await Host.findByPk(req.body.hostID);
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
                            title: req.body.title,
                            images: req.files.map(file => file.filename).join("|"),
                            shortDescription: req.body.shortDescription,
                            longDescription: req.body.longDescription,
                            portionPrice: req.body.portionPrice,
                            totalSlots: req.body.totalSlots,
                            datetime: formattedDatetime,
                            approxAddress: approximateAddress,
                            address: hostInfo.address,
                            hostID: req.body.hostID,
                            coordinates: coordinates.lat + "," + coordinates.lng,
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
                    } catch (error) {
                        res.status(500).send("ERROR: Internal server error");
                        Logger.log(`LISTINGS ADDLISTING: Internal server error: ${error}`);
                        return;
                    }
                } else {
                    // Delete all images if one of them fails to upload
                    for (let i=0; i<req.files.length; i++) {
                        await FileManager.deleteFile(req.files[i].filename);
                        Logger.log(`LISTINGS ADDLISTING: One or more image checks failed. Image ${req.files[i].filename} deleted successfully.`)
                    }
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
    // user may be a guest or a host
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
    const favCuisine = findUser.favCuisine || '';
    if (favCuisine.split("|").includes(listingID)) {
        // if the user is a guest, update Guest. If the user is a host, update Host
        const removeFavourite = await findUser.update({ favCuisine: favCuisine.replace(listingID + "|", "") }, { where: { userID: userID } }); // Removes the listingID from the guest's favCuisine field
        if (removeFavourite) {
            res.status(200).json({ message: "SUCCESS: Listing removed from favourites successfully", favourite: false });
            return;
        } else {
            res.status(400).send("ERROR: Failed to remove listing from favourites");
            return;
        }
    } else {
        const addFavourite = await findUser.update({ favCuisine: favCuisine + listingID + "|" }, { where: { userID: userID } }); // Adds the listingID to the guest's favCuisine field
        if (addFavourite) {
            res.status(200).json({ message: "SUCCESS: Listing added to favourites successfully", favourite: true });
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
        res.status(400).send("ERROR: One or more required payloads were not provided");
        return;
    }
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found");
        return;
    }
    const listingImages = findListing.images.split("|");
    for (let i=0; i<listingImages.length; i++) {
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
