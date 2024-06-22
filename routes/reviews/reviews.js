const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileManager = require('../../services/FileManager');
const upload = require('../../middleware/upload');

//Global dictionary to store reviews (tempororily saved in memory, implement to database later)
const reviews = {};
let nextReviewId = 1;

router.route("/")
    .get((req, res) => {
        res.json(Object.values(reviews));
    })
    .post((req, res) => {
        const { sender, receiver, foodRating, hygieneRating, comments, images, dateCreated } = req.body;
        if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
            res.status(400).send("Missing required fields");
            return;
        }
        const reviewId = nextReviewId++;

        console.log("Review ID:", reviewId);
        console.log("Review Data:", req.body);

        // typically save the review data to a database, but for now store it in memory
        reviews[reviewId] = {
            id: reviewId,
            sender: sender,
            receiver: receiver,
            foodRating: foodRating,
            hygieneRating: hygieneRating,
            comments: comments,
            images: images,
            dateCreated: dateCreated
        }

        res.status(201).send({ message: "Review submitted successfully", review: reviews[reviewId] });
    });

router.post('/upload-images', upload.array('images'), async (req, res) => {
    try {
        const fileUrls = [];

        for (const file of req.files) {
            const saveResult = await FileManager.saveFile(file.filename);
            if (saveResult !== true) {
                throw new Error(saveResult);
            }
            fileUrls.push(`/FileStore/${file.filename}`);
        }

        res.status(201).json({ urls: fileUrls });
        console.log('Images uploaded:', fileUrls);
    } catch (error) {
        console.error('Failed to upload images:', error);
        res.status(500).send('Failed to upload images');
        return;
    }
});
router.get("/host/:name", (req, res) => {
    const hostReviews = Object.values(reviews).filter(review => review.receiver === req.params.name);
    res.json(hostReviews);
});


router.route("/:id")
    .get((req, res) => {
        const review = reviews[req.params.id];
        if (review) {
            res.json(review);
        } else {
            res.status(404).send(`Review with ID ${req.params.id} not found`);
        }
    })
    .put((req, res) => {
        const { sender, receiver, foodRating, hygieneRating, comments, images, dateCreated } = req.body;
        if (reviews[req.params.id]) {
            reviews[req.params.id] = {
                id: req.params.id,
                sender,
                receiver,
                foodRating,
                hygieneRating,
                comments,
                images,
                dateCreated
            };
            res.json(reviews[req.params.id]);
        } else {
            res.status(404).send(`Review with ID ${req.params.id} not found`);
        }
    })
    .delete((req, res) => {
            if (reviews[req.params.id]) {
            delete reviews[req.params.id];
            res.send(`Review with ID ${req.params.id} deleted`);
        } else {
            res.status(404).send(`Review with ID ${req.params.id} not found`);
        }
    });

module.exports = router;
