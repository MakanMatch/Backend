const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileManager = require('../../services/FileManager');
const { upload } = require('../../middleware/upload');

//Global dictionary to store reviews (tempororily saved in memory, implement to database later)
const reviews = {};
let nextReviewId = 1;

router.route("/")
  .get((req, res) => {
    res.json(Object.values(reviews));
  })
  .post(upload, async (req, res) => { 
    const { sender, receiver, foodRating, hygieneRating, comments,dateCreated } = req.body;

    if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
      return res.status(400).send("Missing required fields");
    }

    try {
      const fileUrls = [];

      if (req.file && req.file.length > 0) {
        for (const file of req.file){
            const saveResult = await FileManager.saveFile(file.path, file.filename);
            if (saveResult !== true) {
              throw new Error(saveResult);
            }
            fileUrls.push(`/FileStore/${file.filename}}`);
        } 
      }

      const reviewId = nextReviewId++;

      console.log("Review ID:", reviewId);
      console.log("Review Data:", req.body);
      console.log("Image URLs:", fileUrls);

      reviews[reviewId] = {
        id: reviewId,
        sender,
        receiver,
        foodRating,
        hygieneRating,
        comments,
        fileUrls,
        dateCreated
      };

      res.status(201).json({ message: "Review submitted successfully", review: reviews[reviewId] });
    } catch (error) {
      console.error('Failed to upload images or submit review:', error);
      res.status(500).send('Failed to upload images or submit review');
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
            res.status(404).send(`Review with ID ${req.params.id} not found`);
        }
    })
    .put((req, res) => {
        const { sender, receiver, foodRating, hygieneRating, comments, images, dateCreated } = req.body;
        if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
            res.status(400).send("Missing required fields");
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
