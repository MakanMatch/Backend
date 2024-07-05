const express = require('express');
const router = express.Router();
const { Universal } = require("../../services")
const { Review, Like } = require('../../models');
const Logger = require('../../services/Logger');

router.post("/", async (req, res) => {
    if (!req.query.reviewID || !req.query.guestID) {
        return res.status(400).send("ERROR: Missing required fields");
    }
    const likeID = Universal.generateUniqueID();
    try {
        const existingLike = await Like.findOne({
            where: {
                reviewID: req.query.reviewID,
                guestID: req.query.guestID
            }
        });
        if (existingLike) {
            await Like.destroy({
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
            await Like.create({
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

module.exports = { router, at: '/likeReview' };