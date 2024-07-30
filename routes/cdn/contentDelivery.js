const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger");
const { FoodListing,Review, Guest, Host } = require("../../models");

router.get("/getImageForListing", async (req, res) => {
    const { listingID, imageName } = req.query;
    if (!listingID || !imageName) {
        return res.status(400).send("ERROR: Invalid request parameters.");
    }

    // Find the listing
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        return res.status(404).send("ERROR: Listing not found.");
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        return res.status(404).send("ERROR: Image not found.");
    }

    const listingImages = findListing.images.split("|");
    
    if (listingImages.includes(imageName) !== true) {
        return res.status(404).send("ERROR: Requested image does not belong to its corresponding listing.");
    }
    return res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length));
});

router.get("/getImageForReview", async (req, res) => {
    const { reviewID, imageName } = req.query;
    if (!reviewID || !imageName) {
        res.status(400).send("ERROR: Invalid request parameters.");
        return;
    }

    // Find the review
    const findReview = await Review.findByPk(reviewID);
    if (!findReview) {
        res.status(404).send("ERROR: Review not found.");
        return;
    }

    const reviewImages = findReview.images.split("|");

    if (reviewImages.includes(imageName) !== true) {
        return res.status(404).send("ERROR: Image not found.");
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        return res.status(404).send("ERROR: Image not found.");
    }

    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    return;
});

router.get("/getImageForChat", async (req, res) => {
    const { userID, imageName } = req.query;
    if (!userID || !imageName) {
        return res.status(400).send("ERROR: Invalid request parameters.");
    }

    // Find the user
    const findUser = await Guest.findByPk(userID) || await Host.findByPk(userID);
    if (!findUser) {
        return res.status(404).send("ERROR: User not found.");
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        return res.status(404).send("ERROR: Image not found.");
    }
    
    return res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length));
});

// router.get("/getProfilePicture", async (req, res) => {
//     const { userID } = req.query;
//     if (!userID) {
//         res.status(400).send("ERROR: Invalid request parameters.");
//         return;
//     }

//     const findImageName = await FileManager.prepFile(imageName);
//     if (!findImageName.startsWith("SUCCESS")) {
//         res.status(404).send("ERROR: Image not found.");
//         return;
//     }

//     res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
//     return;
// });

module.exports = { router, at: '/cdn' };