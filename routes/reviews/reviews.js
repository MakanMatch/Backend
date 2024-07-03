const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileManager = require('../../services/FileManager');
const { Universal } = require("../../services")
const { storeImages } = require("../../middleware/storeImages");
const { Review, Host, Guest } = require('../../models');
const Logger = require('../../services/Logger');


router.route("/")
    .post(async (req, res) => {
        storeImages(req, res, async (err) => {

            if (err instanceof multer.MulterError) {
                Logger.log(`CDN REVIEWS POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`CDN REVIEWS POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const hostID = Universal.data["DUMMY_HOST_ID"]
            const guestID = Universal.data["DUMMY_GUEST_ID"]
            const { foodRating, hygieneRating, comments, dateCreated } = req.body;
          
            if (!foodRating || !hygieneRating || !dateCreated) {
                return res.status(400).send("ERROR: Missing required fields");
            }
            try {
                // const host = await Host.findByPk(hostID)
                // const guest = await Guest.findByPk(guestID)
                // if (!host || !guest) {
                //     return res.status(404).send("ERROR: Host or guest not found");
                // }
                // Not using the above code for now as we are hardcoding the hostID and guestID

                const fileUrls = [];
                for (const file of req.files) {
                    const saveResult = await FileManager.saveFile(file.filename);
                    if (saveResult !== true) {
                        throw new Error(saveResult);
                    } else {
                        fileUrls.push(`${file.filename}`);
                    }
                }

                const reviewID = Universal.generateUniqueID();
                const fileUrlsString = fileUrls.join("|");

                const review = {
                    reviewID: reviewID,
                    foodRating: foodRating,
                    hygieneRating: hygieneRating,
                    comments: comments,
                    images: fileUrlsString,
                    dateCreated: dateCreated,
                    guestID: guestID, // Hardcoded for now
                    hostID: hostID, // Hardcoded for now
                };

                await Review.create(review);

                res.send("SUCCESS: Review submitted successfully");
            } catch (err) {
                Logger.log(`CDN REVIEWS POST ERROR: Failed to submit review; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to submit review");
            }
        });
    });

router.get("/host", async (req, res) => {
    if (!req.query.hostID) {
        return res.status(400).send("ERROR: Missing host ID");
    }
    try {
        const hostReview = await Review.findAll({
            where: { hostID: req.query.hostID }
        })
        if (!hostReview) {
            return res.send([]);
        } else {
            res.json(hostReview);
        }
    } catch (err) {
        Logger.log(`CDN REVIEWS HOST ERROR: Failed to retrieve host review; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to retrieve host review");
    }
});


router.route("/reviews/")
    .get(async (req, res) => {
        if (!req.query.id) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const review = await Review.findByPk(req.query.id);
            if (!review) {
                return res.status(404).send(`ERROR: Review not found`);
            }
            res.json(review); // Tested in postcode, working!
        } catch (err) {
            Logger.log(`CDN REVIEWS REVIEWS ERROR: Failed to retrieve review with ID ${req.query.id} ${err}`);
            return res.status(500).send("ERROR: Failed to retrieve review");
        }
    })
    .put(async (req, res) => {
        if (!req.query.id) {
            return res.status(400).send("ERROR: Missing review ID");

        }
        const updateFields = ["foodRating", "hygieneRating", "comments", "images", "likeCount", "dateCreated", "guestID", "hostID"];
        const updateDict = {};
        updateFields.forEach(field => {
            if (req.query[field]) {
                updateDict[field] = req.query[field];
            }
        })
        if (Object.keys(updateDict).length === 0) {
            return res.send("SUCCESS: No fields to update");
        } else {
            try {
                const updateReview = await Review.update(updateDict, {
                    where: { reviewID: req.query.id }
                });
                if (!updateReview) {
                    return res.status(404).send(`UERROR: Review with ID ${req.query.id} not found`);
                } else {
                    res.send(`SUCCESS: Review with ID ${req.query.id} updated`); // Tested in postcode, working!
                }
            } catch (err) {
                Logger.log(`CDN REVIEWS REVIEWS ERROR: Failed to update review with ID ${req.query.id} ${err}`);
                return res.status(500).send("ERROR: Failed to update review");
            }
        }
    })
    .delete(async (req, res) => {
        if (!req.query.id) {
            return res.status(400).send("ERROR: Missing review ID");
        }
        try {
            const deleteReview = await Review.destroy({
                where: { reviewID: req.query.id }
            });
            if (!deleteReview) {
                return res.status(404).send(`ERROR: Review with ID ${req.query.id} not found`);
            } else {
                res.send(`SUCCESS: Review with ID ${req.query.id} deleted`); // Tested in postcode, working!
            }
        } catch (err){
            Logger.log(`CDN REVIEWS REVIEWS ERROR: Failed to delete review with ID ${req.query.id} ${err}`);
            return res.status(500).send("ERROR: Failed to delete review");
        }
    });

module.exports = router;
