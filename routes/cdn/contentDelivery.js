const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Logger = require("../../services/Logger");
const { FoodListing,Review, Guest, Host, ChatMessage, ChatHistory } = require("../../models");
const { Op } = require("sequelize");

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
    const { userID,  messageID } = req.query;
    if (!userID || !messageID) {
        return res.status(400).send("ERROR: Invalid request parameters.");
    }

    // Find the user
    const user = await Guest.findByPk(userID) || await Host.findByPk(userID);
    if (!user) {
        return res.status(404).send("ERROR: User not found")
    }

    const message = await ChatMessage.findByPk(messageID);
    if (!message) {
        return res.status(404).send("ERROR: Message not found.");
    }

    var imageName = message.image;

    const chatHistory = await ChatHistory.findByPk(message.chatID);

    if(!chatHistory){   
        return res.status(404).send("ERROR: Chat history not found.");
    }

    if (chatHistory.user1ID != userID && chatHistory.user2ID != userID) {
        return res.status(404).send("ERROR: User is not authorised to view this image.");
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