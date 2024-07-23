const express = require('express');
const router = express.Router();
const { Review, Guest } = require('../../models');
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
            let { reviewID, foodRating, hygieneRating, comments, images} = req.body;

            if (!reviewID) {
                return res.status(400).send("ERROR: Missing review ID");
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
            if (foodRating) updateDict.foodRating = foodRating;
            if (hygieneRating) updateDict.hygieneRating = hygieneRating;
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

        const { reviewID } = req.body;
        if (!reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }

        const review = await Review.findOne({
            where: { reviewID: reviewID },
            include: [{
                model: Guest,
                as: 'reviewPoster',
                attributes: ['userID']
            }]
        })

        if (guestID !== review.reviewPoster.userID) {  // Check if the action performer is the review poster
            return res.status(403).send("ERROR: You are not authorized to delete this review");
        }

        try {
            const deleteReview = await review.destroy({
                where: { reviewID: reviewID }
            });
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
