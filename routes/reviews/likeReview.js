const express = require('express');
const router = express.Router();
const { Universal } = require("../../services")
const { Review, ReviewLike } = require('../../models');
const Logger = require('../../services/Logger');

router.route("/")
    .post(async (req, res) => {
        if (!req.query.reviewID || !req.query.guestID) {
            return res.status(400).send("ERROR: Missing required fields");
        }
        const likeID = Universal.generateUniqueID();
        try {
            const existingLike = await ReviewLike.findOne({
                where: {
                    reviewID: req.query.reviewID,
                    guestID: req.query.guestID
                }
            });
            if (existingLike) {
                await ReviewLike.destroy({
                    where: {
                        reviewID: req.query.reviewID,
                        guestID: req.query.guestID
                    }
                });
                await Review.decrement('likeCount', {
                    where: {
                        reviewID: req.query.reviewID
                    }
                });
                res.send("SUCCESS: Like removed");
            } else {
                await ReviewLike.create({
                    likeID: likeID,
                    reviewID: req.query.reviewID,
                    guestID: req.query.guestID,
                });
                await Review.increment('likeCount', {
                    where: {
                        reviewID: req.query.reviewID
                    }
                });
                res.send("SUCCESS: Like added");
            }
        } catch (err) {
            Logger.log(`CDN REVIEWS LIKEREVIEW ERROR: Failed to like / unlike review; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to like review");
        }
    })
    .get(async (req, res) => {
        if (!req.query.guestID || !req.query.reviewID) {
            return res.status(400).send("ERROR: Missing required fields");
        }
        try {
            const existingLike = await ReviewLike.findOne({
                where: {
                    reviewID: req.query.reviewID,
                    guestID: req.query.guestID
                }
            });
            if (existingLike) {
                res.send(true);
            } else {
                res.send(false);
            }
        } catch (err) {
            Logger.log(`CDN REVIEWS LIKEREVIEW ERROR: Failed to retrieve like status; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to retrieve like status");
        }
    })

router.get("/userLikedReviews", async (req, res) => {
    if (!req.query.guestID) {
        return res.status(400).send("ERROR: Missing required fields");
    }
    try {
        const likedReviews = await ReviewLike.findAll({
            where: {
                guestID: req.query.guestID
            }
        });
        if (likedReviews) {
            res.json(likedReviews);
            console.log(likedReviews);
        } else {
            return res.status(200).json([]);
        }
    } catch (err) {
        Logger.log(`CDN REVIEWS USERLIKEDREVIEWS ERROR: Failed to retrieve liked reviews by user; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to retrieve liked reviews");
    }
})


module.exports = { router, at: '/likeReview' };