const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger");
const { FoodListing,Review } = require("../../models");

router.get("/getImageForListing", async (req, res) => {
    const { listingID, imageName } = req.query;
    if (!listingID || !imageName) {
        res.status(400).send("ERROR: Invalid request parameters.");
        return;
    }

    // Find the listing
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        res.status(404).send("ERROR: Listing not found.");
        return;
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        res.status(404).send("ERROR: Image not found.");
        return;
    }

    const listingImages = findListing.images.split("|");
    
    if (listingImages.includes(imageName) !== true) {
        res.status(404).send("ERROR: Requested image does not belong to its corresponding listing.");
        return;
    }
    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    // Logger.log(`CDN GETIMAGEFORLISTING: Image(s) for listing ${listingID} sent successfully.`)
    return;
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

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        res.status(404).send("ERROR: Image not found.");
        return;
    }

    const reviewImages = findReview.images.split("|");

    if (reviewImages.includes(imageName) !== true) {
        res.status(404).send("ERROR: Requested image does not belong to its corresponding review.");
        return;
    }

    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    return;
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