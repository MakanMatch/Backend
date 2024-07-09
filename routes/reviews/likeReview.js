const express = require('express');
const router = express.Router();
const { Universal } = require("../../services")
const { Review, ReviewLike } = require('../../models');
const Logger = require('../../services/Logger');

router.route("/")
    .post(async (req, res) => {
        const { reviewID, guestID } = req.body;
        if (!reviewID || !guestID) {
            return res.status(400).send("ERROR: Missing required fields");
        }
        const likeID = Universal.generateUniqueID();

        try {
            const existingLike = await ReviewLike.findOne({
                where: {
                    reviewID: reviewID,
                    guestID: guestID
                }
            });
            if (existingLike) {
                await ReviewLike.destroy({
                    where: {
                        reviewID: reviewID,
                        guestID: guestID
                    }
                });
                await Review.decrement('likeCount', {
                    where: {
                        reviewID: reviewID
                    }
                });
                res.send("SUCCESS: Like removed");
            } else {
                const createLike = await ReviewLike.create({
                    likeID: likeID,
                    reviewID: reviewID,
                    guestID: guestID,
                });
                if (!createLike) {
                    return res.status(500).send("ERROR: Failed to like review");
                }
                await Review.increment('likeCount', {
                    where: {
                        reviewID: reviewID
                    }
                });
                res.send("SUCCESS: Like added");
            }
        } catch (err) {
            Logger.log(`REVIEWS LIKEREVIEW POST ERROR: Failed to like / unlike review; error: ${err}.`);
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
                res.json({message: "SUCCESS: Like status retrieved.", liked: true});
            } else {
                res.json({message: "SUCCESS: Like status retrieved.", liked: false});
            }
        } catch (err) {
            Logger.log(`REVIEWS LIKEREVIEW GET ERROR: Failed to retrieve like status; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to retrieve like status");
        }
    })

router.get("/userLiked", async (req, res) => {
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
        } else {
            return res.status(200).json([]);
        }
    } catch (err) {
        Logger.log(`REVIEWS LIKEREVIEW USERLIKEDREVIEWS GET ERROR: Failed to retrieve liked reviews by user; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to retrieve liked reviews");
    }
})


module.exports = { router, at: '/likeReview' };