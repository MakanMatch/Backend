const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileManager = require('../../services/FileManager');
const { Universal } = require("../../services")
const { storeImages } = require("../../middleware/storeImages");
const { Review, Host, Guest } = require('../../models');
const Logger = require('../../services/Logger');

router.route("/")
    .post(async (req, res) => {
        storeImages(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const { foodRating, hygieneRating, comments, dateCreated, guestID, hostID } = req.body;
          
            if (!foodRating || !hygieneRating || !dateCreated || !guestID || !hostID) {
                return res.status(400).send("ERROR: Missing required fields");
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
                        const saveResult = await FileManager.saveFile(file.filename);
                        if (saveResult !== true) {
                            throw new Error(saveResult);
                        } else {
                            fileUrls.push(`${file.filename}`);
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

                res.send("SUCCESS: Review submitted successfully");
            } catch (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to submit review; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to submit review");
            }
        });
    });

module.exports = { router, at: '/submitReview' };
