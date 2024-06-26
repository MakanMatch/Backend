const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileManager = require('../../services/FileManager');
const { Universal } = require("../../services")
const { storeFiles } = require("../../middleware/storeFiles");
const { Review, Host, Guest } = require('../../models');


router.route("/")
    .post(storeFiles, async (req, res) => {
        const hostID = Universal.data["DUMMY_HOST_ID"]
        const host = await Host.findByPk(hostID)
        const guestID = Universal.data["DUMMY_GUEST_ID"]
        const guest = await Guest.findByPk(guestID)
        const { sender, receiver, foodRating, hygieneRating, comments, dateCreated } = req.body;

        if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
            return res.status(400).send("UERROR: Missing required fields");
        }

        try {
            const fileUrls = [];

            for (const file of req.files) {
                const saveResult = await FileManager.saveFile(file.filename);
                if (saveResult !== true) {
                    throw new Error(saveResult);
                }
                fileUrls.push(`${file.filename}`);
            }

            const reviewID = Universal.generateUniqueID();
            const fileUrlsString = fileUrls.join("|");

            const review = {
                reviewID: reviewID,
                sender,
                receiver,
                foodRating: foodRating,
                hygieneRating: hygieneRating,
                comments: comments,
                images: fileUrlsString,
                dateCreated: dateCreated,
                guestID: guestID, // Hardcoded for now
                hostID: hostID, // Hardcoded for now
            };

            await Review.create(review);

            res.send("SUCCESS: Review submitted successfully");
        } catch (error) {
            console.error('ERROR: Failed to upload images or submit review:', error);
            res.status(500).send('ERROR: Failed to upload images or submit review');
        }
    });

router.get("/host/:name", (req, res) => {
    const hostReviews = Object.values(reviews).filter(review => review.receiver === req.params.name);
    res.json(hostReviews);
});


router.route("/reviews/:id")
    .get((req, res) => {
        const review = reviews[req.params.id];
        if (review) {
            res.json(review);
        } else {
            res.status(404).send(`UERROR: Review with ID ${req.params.id} not found`);
        }
    })
    // Tested in postcode, working!
    .put((req, res) => {
        const { sender, receiver, foodRating, hygieneRating, comments, images, dateCreated } = req.body;
        if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
            res.status(400).send("UERROR: Missing required fields");
            return;
        }
        if (reviews[req.params.id]) {
            reviews[req.params.id] = {
                id: req.params.id,
                sender,
                receiver,
                foodRating,
                hygieneRating,
                comments,
                images: reviews[req.params.id].images,
                dateCreated
            };
            res.json(reviews[req.params.id]);
        } else {
            res.status(404).send(`UERROR: Review with ID ${req.params.id} not found`);
        }
    })
    // Tested in postcode, working!
    .delete((req, res) => {
        if (reviews[req.params.id]) {
            delete reviews[req.params.id];
            res.send(`SUCCESS: Review with ID ${req.params.id} deleted`);
        } else {
            res.status(404).send(`UERROR: Review with ID ${req.params.id} not found`);
        }
    });

module.exports = router;
