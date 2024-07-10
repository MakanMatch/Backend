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
                const updateReview = await Review.findOne({
                    where: {
                        reviewID: reviewID
                    },
                    attributes: ['likeCount']
                });

                res.json({
                    message: "SUCCESS: Review unliked.",
                    liked: false,
                    likeCount: updateReview.likeCount
                })
            } else {
                const createLike = await ReviewLike.create({
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

                const updateReview = await Review.findOne({
                    where: {
                        reviewID: reviewID
                    },
                    attributes: ['likeCount']
                });

                res.json({
                    message: "SUCCESS: Review liked.",
                    liked: true,
                    likeCount: updateReview.likeCount
                })
            }
        } catch (err) {
            Logger.log(`REVIEWS LIKEREVIEW POST ERROR: Failed to like / unlike review; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to like review");
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