const express = require('express');
const router = express.Router();
const { Review, Guest, Host, Warning } = require('../../models');
const Logger = require('../../services/Logger');
const { storeImages } = require('../../middleware/storeImages');
const FileManager = require('../../services/FileManager');
const multer = require('multer');
const { validateToken } = require('../../middleware/auth');
const { Op } = require('sequelize');

router.route("/")
    .put(validateToken, async (req, res) => {
        storeImages(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }
            let { reviewID, foodRating, hygieneRating, comments, images } = req.body;

            if (!reviewID) {
                return res.status(400).send("ERROR: Review ID is not provided.");
            }

            const guestID = req.user.userID;

            const review = await Review.findByPk(reviewID, {
                attributes: ['reviewID', 'foodRating', 'hygieneRating', 'images', 'hostID'],
                include: [{
                    model: Guest,
                    as: 'reviewPoster',
                    attributes: ['userID']
                }]
            });

            const hostID = review.hostID;
            if (!hostID) {
                return res.status(404).send("ERROR: Host ID not found");
            }

            const host = await Host.findByPk(hostID)
            if (!host) {
                return res.status(404).send("ERROR: Host not found");
            }

            // Check if the action performer is the review poster
            if (!review) {
                return res.status(404).send(`ERROR: Review with ID ${reviewID} not found.`);
            }

            if (guestID !== review.reviewPoster.userID) {
                return res.status(403).send("ERROR: You are not authorized to update this review.");
            }

            // Store original images
            const originalImages = review.images ? review.images.split('|') : [];

            var fileUrls = [];

            if (images && Array.isArray(images)) {
                for (const image of images) {
                    try {
                        const saveImages = await FileManager.saveFile(image)
                        if (saveImages == true) {
                            fileUrls.push(`${image}`);
                        } else {
                            return res.status(500).send("ERROR: Failed to upload images");
                        }
                    } catch (err) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to upload images; error: ${err}.`);
                        return res.status(500).send("ERROR: Failed to upload file");
                    }
                }
            } else if (images && typeof images === 'string') {
                try {
                    const saveSingleImage = await FileManager.saveFile(images)
                    if (saveSingleImage == true) {
                        fileUrls.push(`${images}`);
                    } else {
                        return res.status(500).send("ERROR: Failed to upload image");
                    }
                } catch (err) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to upload image; error: ${err}.`);
                    return res.status(500).send("ERROR: Failed to upload file");
                }
            }

            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        const saveFiles = await FileManager.saveFile(file.filename)
                        if (saveFiles == true) {
                            fileUrls.push(`${file.filename}`)
                        } else {
                            return res.status(500).send("ERROR: Failed to upload files");
                        }
                    } catch (err) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to upload files; error: ${err}.`);
                        return res.status(500).send("ERROR: Failed to upload file");
                    }
                }
            }

            const fileUrlsString = fileUrls.length > 0 ? fileUrls.join("|") : null;

            const updateDict = {};

            // Check review count for host
            const currentReviewCount = await Review.count({
                where: { hostID: hostID }
            });

            if (currentReviewCount == null || currentReviewCount == undefined || isNaN(currentReviewCount)) {
                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Review count for host with ID ${hostID} could not be obtained.`)
                return res.status(500).send(`ERROR: Failed to process request.`);
            }

            // Process food rating
            var previousFoodRating = review.foodRating;
            var newFoodRating = foodRating;
            var foodRatingChanged = (newFoodRating && newFoodRating != previousFoodRating);

            // Process hygiene rating
            var previousHygieneRating = review.hygieneRating;
            var newHygieneRating = hygieneRating;
            var hygieneRatingChanged = (newHygieneRating && newHygieneRating != previousHygieneRating);

            updateDict.comments = comments.trim();
            // Adding in images, if any
            if (fileUrlsString) {
                updateDict.images = fileUrlsString;
            } else {
                updateDict.images = null;
            }

            // Adding in new food rating, if changed
            if (foodRatingChanged) {
                updateDict.foodRating = newFoodRating;
            }

            // Adding in new hygiene rating, if changed
            if (hygieneRatingChanged) {
                updateDict.hygieneRating = newHygieneRating;
            }

            try {
                // Update the review record
                review.set(updateDict);

                const updateReview = await review.save();
                if (!updateReview) {
                    return res.status(500).send(`ERROR: Failed to update review.`);
                }

                // Compare original and updated images and delete removed files
                const removedImages = originalImages.filter(image => !fileUrls.includes(image));

                for (const removedImage of removedImages) {
                    try {
                        const deleteRemovedImage = await FileManager.deleteFile(removedImage);
                        if (deleteRemovedImage != true) {
                            Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to delete file ${removedImage}; error: ${deleteRemovedImage}`);
                        }
                    } catch (err) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to delete file ${removedImage}; error: ${err}`);
                    }
                }
            } catch (err) {
                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update review; error: ${err}`);
                return res.status(500).send("ERROR: Failed to update review.");
            }

            if (foodRatingChanged || hygieneRatingChanged) {
                var newHostHygieneRating = ((parseFloat(host.hygieneGrade) * currentReviewCount) - parseFloat(previousHygieneRating) + parseFloat(newHygieneRating)) / currentReviewCount;
                var newHostFoodRating = ((parseFloat(host.foodRating) * currentReviewCount) - parseFloat(previousFoodRating) + parseFloat(newFoodRating)) / currentReviewCount;

                try {
                    host.set({
                        foodRating: newHostFoodRating.toFixed(2),
                        hygieneGrade: newHostHygieneRating.toFixed(2)
                    });

                    const saveHostTable = await host.save();
                    if (!saveHostTable) {
                        return res.status(500).send("ERROR: Failed to update host ratings.");
                    }
                } catch (err) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update host rating; error: ${err}`);
                    return res.status(500).send("ERROR: Failed to update host ratings.");
                }
            }

            // Check if hygiene grade is above 2.5, unflag host and remove warning
            try {
                if (host.flaggedForHygiene && (host.hygieneGrade > 2.5 || host.hygieneGrade == 0)) {
                    host.flaggedForHygiene = false;
                    await host.save();

                    const warning = await Warning.findOne({ where: { hostID: host.userID } });
                    if (warning) {
                        const removePreviousWarning = await warning.destroy();
                        if (!removePreviousWarning) {
                            Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to remove warning for host with ID ${hostID}.`);
                        }
                    }
                }
            } catch (err) {
                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to check host hygiene grade and update warnings/flagged status; error: ${err}`)
            }

            return res.send(`SUCCESS: Review with ID ${reviewID} updated.`);
        })
    })
    .delete(validateToken, async (req, res) => {
        const guestID = req.user.userID;

        const { reviewID } = req.body;
        if (!reviewID) {
            return res.status(400).send("ERROR: Review ID is not provided.");
        }

        const review = await Review.findByPk(reviewID, {
            attributes: ['reviewID', 'foodRating', 'hygieneRating', 'images', 'hostID'],
            include: [
                {
                    model: Guest,
                    as: 'reviewPoster',
                    attributes: ['userID']
                },
                {
                    model: Host,
                    as: 'host'
                }
            ]
        });
        if (!review) {
            return res.status(404).send(`ERROR: Review with ID ${reviewID} not found.`);
        }

        if (guestID !== review.reviewPoster.userID) {
            return res.status(403).send("ERROR: You are not authorized to delete this review.");
        }

        const host = review.host;

        // Check review count for host
        const prevReviewCount = await Review.count({
            where: { hostID: host.userID }
        });

        if (prevReviewCount == null || prevReviewCount == undefined || isNaN(prevReviewCount)) {
            return res.status(404).send(`ERROR: Failed to process request.`);
        }

        // Delete review
        try {
            const deleteReview = await review.destroy();
            if (!deleteReview) {
                return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS DELETE ERROR: Failed to delete review; error: ${err}`);
            return res.status(500).send("ERROR: Failed to delete review.");
        }

        // Update host ratings
        try {
            if (prevReviewCount == 1) {
                // If this is the last review, just set ratings to 0
                host.set({
                    foodRating: 0,
                    hygieneGrade: 0,
                    reviewsCount: 0
                })

                const updateHostRating = await host.save();
                if (!updateHostRating) {
                    return res.status(500).send("ERROR: Failed to update host rating");
                }
            } else {
                // Otherwise, update ratings based on average
                host.set({
                    foodRating: ((parseFloat(host.foodRating) * prevReviewCount - review.foodRating) / (prevReviewCount - 1)).toFixed(2),
                    hygieneGrade: ((parseFloat(host.hygieneGrade) * prevReviewCount - review.hygieneRating) / (prevReviewCount - 1)).toFixed(2),
                    reviewsCount: prevReviewCount - 1
                })

                const updateHostRating = await host.save();
                if (!updateHostRating) {
                    return res.status(500).send("ERROR: Failed to update host rating");
                }
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS DELETE ERROR: Failed to update host ratings; error; ${err}`)
        }

        // Check if hygiene grade is above 2.5, unflag host and remove warning
        try {
            if (host.flaggedForHygiene && (host.hygieneGrade > 2.5 || host.hygieneGrade == 0)) {
                host.flaggedForHygiene = false;
                await host.save();

                const warning = await Warning.findOne({ where: { hostID: host.userID } });
                if (warning) {
                    const removePreviousWarning = await warning.destroy();
                    if (!removePreviousWarning) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to remove warning for host with ID ${host.userID}.`);
                    }
                }
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to check host hygiene grade and update warnings/flagged status; error: ${err}`)
        }

        return res.send(`SUCCESS: Review with ID ${reviewID} deleted.`);
    });

module.exports = { router, at: '/manageReviews' };
