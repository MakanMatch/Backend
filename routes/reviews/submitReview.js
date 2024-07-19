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
                            await FileManager.saveFile(file.filename);
                            fileUrls.push(`${file.filename}`);
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

                return res.send("SUCCESS: Review submitted successfully");
            } catch (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to submit review; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to submit review");
            }
        });
    });

module.exports = { router, at: '/submitReview' };
