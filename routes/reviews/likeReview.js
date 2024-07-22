const express = require('express');
const router = express.Router();
const { Review, ReviewLike } = require('../../models');
const Logger = require('../../services/Logger');
const { validateToken } = require('../../middleware/auth');

router.route("/")
    .post(validateToken, async (req, res) => {
        const guestID = req.user.userID;
        if (!guestID) {
            return res.status(400).send("ERROR: Missing guest ID");
        }
        const { reviewID } = req.body;
        if (!reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }

        try {
            const review = await Review.findByPk(reviewID)
            if (!review) {
                return res.status(404).send("ERROR: Review not found");
            }
            const existingLike = await ReviewLike.findOne({ where: { reviewID, guestID } });
            if (existingLike) {
                const unlikeReview = await ReviewLike.destroy({ where: { reviewID, guestID } }); // Unlike review
                review.likeCount -= 1;
                const updateReview = await review.save()
                if (!unlikeReview || !updateReview) {
                    return res.status(500).send("ERROR: Failed to unlike review");
                } else {
                    res.json({
                        message: "SUCCESS: Review unliked.",
                        liked: false,
                        likeCount: review.likeCount
                    })
                }
            } else {
                const likeReview = await ReviewLike.create({ reviewID, guestID }); // Like review
                review.likeCount += 1;
                const updateReview = await review.save()
                if (!likeReview || !updateReview) {
                    return res.status(500).send("ERROR: Failed to like review");
                } else {
                    res.json({
                        message: "SUCCESS: Review liked.",
                        liked: true,
                        likeCount: review.likeCount
                    })
                }
            }
        } catch (err) {
            Logger.log(`REVIEWS LIKEREVIEW POST ERROR: Failed to like / unlike review; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to like review");
        }
    })

module.exports = { router, at: '/likeReview' };