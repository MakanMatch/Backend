const express = require('express');
const router = express.Router();
const { Review, Guest, Host } = require('../../models');
const Logger = require('../../services/Logger');
const { storeImages } = require('../../middleware/storeImages');
const FileManager = require('../../services/FileManager');
const multer = require('multer');
const { validateToken } = require('../../middleware/auth');

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
            let { reviewID, foodRating, hygieneRating, comments, images, hostID} = req.body;

            if (!reviewID || !hostID) {
                return res.status(400).send("ERROR: One or more required payloads not provided.");
            }

            const guestID = req.user.userID;
            if (!guestID) {
                return res.status(400).send("ERROR: Missing guest ID");
            }

            const review = await Review.findOne({
                where: { reviewID: reviewID },
                include: [{
                    model: Guest,
                    as: 'reviewPoster',
                    attributes: ['userID']
                }]
            });

            if (guestID !== review.reviewPoster.userID) {    // Check if the action performer is the review poster
                return res.status(403).send("ERROR: You are not authorized to update this review");
            }

            if (!review) {
                return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
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
            } else {
                fileUrls = [];
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
            if (foodRating || hygieneRating) {
                const host = await Host.findByPk(hostID);
                if (!host) {
                    return res.status(404).send("ERROR: Host not found");
                } else {
                    if (foodRating) {
                        updateDict.foodRating = foodRating;
                        var previousFoodRating = review.foodRating;
                        var newFoodRating = foodRating;
                        var newHostFoodRating = ((parseFloat(host.foodRating) * host.reviewsCount) - parseFloat(previousFoodRating) + parseFloat(newFoodRating)) / host.reviewsCount;
                        try {
                            const updateHostFoodRating = await Host.update(
                                {
                                    foodRating: newHostFoodRating.toFixed(2)
                                },
                                {
                                    where: { userID: hostID }
                                }
                            );
                            if (updateHostFoodRating[0] === 0) {
                                return res.status(500).send("ERROR: Failed to update host food rating");
                            }
                        } catch (err) {
                            Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update host food rating; error: ${err}`);
                            return res.status(500).send("ERROR: Failed to update host food rating");
                        }
                    }
                    if (hygieneRating) {
                        updateDict.hygieneRating = hygieneRating;
                        var previousHygieneRating = review.hygieneRating;
                        var newHygieneRating = hygieneRating;
                        var newHostHygieneRating = ((parseFloat(host.hygieneGrade) * host.reviewsCount) - parseFloat(previousHygieneRating) + parseFloat(newHygieneRating)) / host.reviewsCount;
                        try {
                            const updateHostHygieneRating = await Host.update(
                                {
                                    hygieneGrade: newHostHygieneRating.toFixed(2)
                                },
                                {
                                    where: { userID: hostID }
                                }
                            );
                            if (updateHostHygieneRating[0] === 0) {
                                return res.status(500).send("ERROR: Failed to update host hygiene rating");
                            }
                        } catch (err) {
                            Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update host hygiene rating; error: ${err}`);
                            return res.status(500).send("ERROR: Failed to update host hygiene rating");
                        }
                    }
                }
            }
            
            updateDict.comments = comments.trim();
            if (fileUrlsString) {
                updateDict.images = fileUrlsString;
            } else {
                updateDict.images = null;
            }

            if (Object.keys(updateDict).length === 0) {
                return res.send("SUCCESS: No fields to update");
            } else {
                try {
                    const updateReview = await review.update(updateDict);
                    if (!updateReview) {
                        return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
                    } else {
                        // Compare original and updated images and delete removed files
                        const removedImages = originalImages.filter(image => !fileUrls.includes(image));

                        for (const removedImage of removedImages) {
                            try {
                                const deleteRemovedImage = await FileManager.deleteFile(removedImage);
                                if (!deleteRemovedImage) {
                                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to delete file; error: ${err}`);
                                }
                            } catch (err) {
                                Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to delete file; error: ${err}`);
                            }
                        }

                        return res.send(`SUCCESS: Review with ID ${reviewID} updated`); // Tested in postcode, working!
                    }
                } catch (err) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update review; error: ${err}`);
                    return res.status(500).send("ERROR: Failed to update review");
                }
            }
        })
    })
    .delete(validateToken, async (req, res) => {
        const guestID = req.user.userID;
            if (!guestID) {
                return res.status(400).send("ERROR: Missing guest ID");
            }

        const { reviewID, hostID } = req.body;
        if (!reviewID || !hostID) {
            return res.status(400).send("ERROR: One or more required payloads not provided.");
        }

        const review = await Review.findOne({
            where: { reviewID: reviewID },
            include: [{
                model: Guest,
                as: 'reviewPoster',
                attributes: ['userID']
            }]
        })

        const host = await Host.findByPk(hostID);
        if (!host) {
            return res.status(404).send("ERROR: Host not found");
        }

        if (host.reviewsCount == "1") {
            const updateHostRating = await host.update({
                foodRating: 0,
                hygieneGrade: 0,
                reviewsCount: 0
            })
            if (!updateHostRating) {
                return res.status(500).send("ERROR: Failed to update host rating");
            }
        } else {
            const updateHostRating = await host.update({
                foodRating: ((parseFloat(host.foodRating) * host.reviewsCount - review.foodRating) / (host.reviewsCount - 1)).toFixed(2),
                hygieneGrade: ((parseFloat(host.hygieneGrade) * host.reviewsCount - review.hygieneRating) / (host.reviewsCount - 1)).toFixed(2),
                reviewsCount: host.reviewsCount - 1
            })
            if (!updateHostRating) {
                return res.status(500).send("ERROR: Failed to update host rating");
            }
        }

        if (guestID !== review.reviewPoster.userID) {  // Check if the action performer is the review poster
            return res.status(403).send("ERROR: You are not authorized to delete this review");
        }

        try {
            const deleteReview = await review.destroy();
            if (!deleteReview) {
                return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
            } else {
                return res.send(`SUCCESS: Review with ID ${reviewID} deleted`); // Tested in postcode, working!
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS DELETE ERROR: Failed to delete review; error: ${err}`);
            return res.status(500).send("ERROR: Failed to delete review");
        }
    });

module.exports = { router, at: '/manageReviews' };
