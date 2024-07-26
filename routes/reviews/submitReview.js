const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileManager = require('../../services/FileManager');
const { Universal } = require("../../services")
const { storeImages } = require("../../middleware/storeImages");
const { Review, Host, Guest } = require('../../models');
const Logger = require('../../services/Logger');
const { validateToken } = require('../../middleware/auth');

router.route("/")
    .post(validateToken, async (req, res) => {
        storeImages(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const guestID = req.user.userID;
            if (!guestID) {
                return res.status(400).send("ERROR: Missing guest ID");
            }

            const { foodRating, hygieneRating, comments, dateCreated, hostID } = req.body;

            if (!foodRating || !hygieneRating || !dateCreated || !hostID) {
                return res.status(400).send("ERROR: Missing required fields");
            }

            if (guestID == hostID) {
                return res.status(400).send("UERROR: You cannot create a review for yourself.");
            }

            try {
                const host = await Host.findByPk(hostID)
                const guest = await Guest.findByPk(guestID)
                if (!host || !guest) {
                    return res.status(404).send("ERROR: Host or guest not found");
                }

                const fileUrls = [];
                if (req.files) {
                    for (const file of req.files) {
                        try {
                            const saveFile = await FileManager.saveFile(file.filename);
                            if (saveFile == true) {
                                fileUrls.push(`${file.filename}`);
                            } else {
                                return res.status(500).send("ERROR: Failed to upload file");
                            }
                        } catch (err) {
                            Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to upload file; error: ${err}.`);
                            return res.status(500).send("ERROR: Failed to upload file");
                        }
                    }
                }
                const fileUrlsString = fileUrls.join("|");

                const reviewID = Universal.generateUniqueID();

                const review = {
                    reviewID: reviewID,
                    foodRating: foodRating,
                    hygieneRating: hygieneRating,
                    comments: comments,
                    images: fileUrlsString,
                    dateCreated: dateCreated,
                    guestID: guestID,
                    hostID: hostID
                };

                await Review.create(review);

                // Check review count for host
                const currentReviewCount = await Review.count({
                    where: { hostID: hostID },
                    hostID: { [Op.eq]: reviewID }
                });
                if (!currentReviewCount) {
                    return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
                }

                // Update Host Food Rating
                var newHostFoodRating = ((parseFloat(host.foodRating) * currentReviewCount) + parseFloat(foodRating)) / (currentReviewCount + 1);
                var newHostHygieneRating = ((parseFloat(host.hygieneGrade) * currentReviewCount) + parseFloat(hygieneRating)) / (currentReviewCount + 1);

                const updateHostRating = await host.update(
                    {
                        foodRating: newHostFoodRating.toFixed(2),
                        hygieneGrade: newHostHygieneRating.toFixed(2),
                        reviewsCount: currentReviewCount + 1,
                    },
                    {
                        where: { userID: hostID }
                    }
                );

                if (updateHostRating[0] === 0) {
                    return res.status(500).send("ERROR: Failed to update host food rating");
                }
                return res.send("SUCCESS: Review submitted successfully");
            } catch (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to submit review; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to submit review");
            }
        });
    });

module.exports = { router, at: '/submitReview' };
