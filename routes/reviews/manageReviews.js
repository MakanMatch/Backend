const express = require('express');
const router = express.Router();
const { Review } = require('../../models');
const Logger = require('../../services/Logger');
const { storeImages } = require('../../middleware/storeImages');
const FileManager = require('../../services/FileManager');
const multer = require('multer');

router.route("/")
    .get(async (req, res) => {
        if (!req.query.reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const review = await Review.findByPk(req.query.reviewID);
            if (!review) {
                return res.status(404).send(`ERROR: Review not found`);
            }
            res.json(review); // Tested in postcode, working!
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS GET ERROR: Failed to retrieve review with ID ${req.query.reviewID}; error: ${err}`);
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
            const getImageNames = (urls) => {
                return urls.map(url => {
                  const parts = url.split('&imageName=');
                  return parts.length > 1 ? parts[1] : null;
                });
              };
            const imagesName = getImageNames(images);
            if (imagesName) {
                for (const image of imagesName) {
                    const savePreviousImages = await FileManager.saveFile(image);
                    if (savePreviousImages !== true) {
                        throw new Error(savePreviousImages);
                    } else {
                        fileUrls.push(`${image}`);
                    }
                }
            }
            if (req.files) {
                for (const file of req.files) {
                    const saveNewFile = await FileManager.saveFile(file.filename);
                    if (saveNewFile !== true) {
                        throw new Error(saveResult);
                    } else {
                        fileUrls.push(`${file.filename}`);
                    }
                }
            } else {
                fileUrls = null
            }
            if (fileUrls != null) {
                var fileUrlsString = fileUrls.join("|");
            } else {
                var fileUrlsString = undefined;
            }

            const updateDict = {};
            if (foodRating) updateDict.foodRating = foodRating;
            if (hygieneRating) updateDict.hygieneRating = hygieneRating;
            if (comments) updateDict.comments = comments;
            if (fileUrlsString) {
                updateDict.images = fileUrlsString;
            } else {
                updateDict.images = "";
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
                        res.send(`SUCCESS: Review with ID ${reviewID} updated`); // Tested in postcode, working!
                    }
                } catch (err) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Failed to update review with ID ${reviewID}; error: ${err}`);
                    return res.status(500).send("ERROR: Failed to update review");
                }
            }
        })
    })
    .delete(async (req, res) => {
        if (!req.query.reviewID) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const deleteReview = await Review.destroy({
                where: { reviewID: req.query.reviewID }
            });
            if (!deleteReview) {
                return res.status(404).send(`ERROR: Review with ID ${req.query.reviewID} not found`);
            } else {
                res.send(`SUCCESS: Review with ID ${req.query.reviewID} deleted`); // Tested in postcode, working!
            }
        } catch (err) {
            Logger.log(`REVIEWS MANAGEREVIEWS DELETE ERROR: Failed to delete review with ID ${req.query.reviewID}; error: ${err}`);
            return res.status(500).send("ERROR: Failed to delete review");
        }
    });

module.exports = { router, at: '/manageReviews' };
