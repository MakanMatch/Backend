const express = require('express');
const router = express.Router();
const { Review } = require('../../models');
const Logger = require('../../services/Logger');
const { storeImages } = require('../../middleware/storeImages');
const FileManager = require('../../services/FileManager');
const multer = require('multer');

router.route("/")
    .get(async (req, res) => {
        const { reviewID } = req.body
        if (!reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const review = await Review.findByPk(reviewID);
            if (!review) {
                return res.status(404).send(`ERROR: Review not found`);
            }
            return res.json(review); // Tested in postcode, working!
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS GET ERROR: Failed to retrieve review with ID ${reviewID}; error: ${err}`);
            return res.status(500).send("ERROR: Failed to retrieve review");
        }
    })
    .put(async (req, res) => {
        storeImages(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }
            let { reviewID, foodRating, hygieneRating, comments, images } = req.body;

            if (!reviewID) {
                return res.status(400).send("ERROR: Missing review ID");
            }

            var fileUrls = [];

            if (images && images.length > 0) {
                for (const image of images) {
                    try {
                        await FileManager.saveFile(image)
                        fileUrls.push(`${image}`);
                    } catch (err) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to upload file; error: ${err}.`);
                        return res.status(500).send("ERROR: Failed to upload file");
                    }
                }
            }
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        await FileManager.saveFile(file.filename)
                        fileUrls.push(`${file.filename}`)
                    } catch (err) {
                        Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to upload file; error: ${err}.`);
                        return res.status(500).send("ERROR: Failed to upload file");
                    }
                }
            }

            const fileUrlsString = fileUrls.length > 0 ? fileUrls.join("|") : null;

            const updateDict = {};
            if (foodRating) updateDict.foodRating = foodRating;
            if (hygieneRating) updateDict.hygieneRating = hygieneRating;
            if (comments) updateDict.comments = comments.trim();
            if (fileUrlsString) {
                updateDict.images = fileUrlsString;
            } else {
                updateDict.images = null;
            }

            if (Object.keys(updateDict).length === 0) {
                return res.send("SUCCESS: No fields to update");
            } else {
                try {
                    const updateReview = await Review.update(updateDict, {
                        where: { reviewID: reviewID }
                    });
                    if (!updateReview) {
                        return res.status(404).send(`UERROR: Review with ID ${reviewID} not found`);
                    } else {
                        return res.send(`SUCCESS: Review with ID ${reviewID} updated`); // Tested in postcode, working!
                    }
                } catch (err) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update review with ID ${reviewID}; error: ${err}`);
                    return res.status(500).send("ERROR: Failed to update review");
                }
            }
        })
    })
    .delete(async (req, res) => {
        const { reviewID } = req.body;
        if (!reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const deleteReview = await Review.destroy({
                where: { reviewID: reviewID }
            });
            if (!deleteReview) {
                return res.status(404).send(`ERROR: Review with ID ${reviewID} not found`);
            } else {
                return res.send(`SUCCESS: Review with ID ${reviewID} deleted`); // Tested in postcode, working!
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS DELETE ERROR: Failed to delete review with ID ${reviewID}; error: ${err}`);
            return res.status(500).send("ERROR: Failed to delete review");
        }
    });

module.exports = { router, at: '/manageReviews' };
