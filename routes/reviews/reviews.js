const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileManager = require('../../services/FileManager');
const { Universal } = require("../../services")
const { storeFiles } = require("../../middleware/storeFiles");
const { Review, Host, Guest } = require('../../models');
const Logger = require('../../services/Logger');


router.route("/")
    .post(async (req, res) => {
        storeFiles(req, res, async (err) => {
            const hostID = Universal.data["DUMMY_HOST_ID"]
            const host = await Host.findByPk(hostID)
            const guestID = Universal.data["DUMMY_GUEST_ID"]
            const guest = await Guest.findByPk(guestID)
            const { sender, receiver, foodRating, hygieneRating, comments, dateCreated } = req.body;

            if (!sender || !receiver || !foodRating || !hygieneRating || !dateCreated) {
                return res.status(400).send("UERROR: Missing required fields");
            }
            try {
                const fileUrls = [];

                for (const file of req.files) {
                    const saveResult = await FileManager.saveFile(file.filename);
                    if (saveResult !== true) {
                        throw new Error(saveResult);
                    }
                    fileUrls.push(`${file.filename}`);
                }

                const reviewID = Universal.generateUniqueID();
                const fileUrlsString = fileUrls.join("|");

                const review = {
                    reviewID: reviewID,
                    sender,
                    receiver,
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
            } catch {
                Logger.log('ERROR: Failed to submit review:');
            }
            if (err instanceof multer.MulterError) {
                Logger.log("ERROR: Image upload error");
            } else {
                Logger.log("ERROR: Internal server error");
            } 
        });
    });

router.get("/host", async (req, res) => {
    const hostReviews = await Review.findAll({
        where: {
            hostID: req.query.hostID
        }

    })
    res.json(hostReviews); // Tested in postcode, working!
});


router.route("/reviews/:id/")
    .get(async (req, res) => {
        if (!req.params.id) {
            res.status(400).send("UERROR: Missing review ID");
            return;
        }

        try {
            const review = await Review.findOne({ where: { reviewID: req.params.id } });
            if (!review) {
                res.status(404).send(`UERROR: Review with ID ${req.params.id} not found`);
                return;
            }
            res.json(review); // Tested in postcode, working!
        } catch {
            Logger.log(`UERROR: Failed to retrieve review with ID ${req.params.id}`);
            return;
        }
    })
    .put(async (req, res) => {
        if (!req.params.id) {
            res.status(400).send("UERROR: Missing review ID");
            return;
        }
        try {
            const review = await Review.findOne({ where: { reviewID: req.params.id } });
            if (!review) {
                res.status(404).send(`UERROR: Review with ID ${req.params.id} not found`);
                return;
            }
        } catch {
            Logger.log(`UERROR: Failed to update review with ID ${req.params.id}`);
            return;
        }
        updateDict = {};
        const newFoodRating = req.query.foodRating;
        if (newFoodRating) {
            updateDict["foodRating"] = newFoodRating;
        }
        const newHygieneRating = req.query.hygieneRating;
        if (newHygieneRating) {
            updateDict["hygieneRating"] = newHygieneRating;
        }
        const newComment = req.query.comments;
        if (newComment) {
            updateDict["comments"] = newComment;
        }
        const newImages = req.query.images;
        if (newImages) {
            updateDict["images"] = newImages;
        }

        try {
            await Review.update(updateDict, {
                where: { reviewID: req.params.id }
            })
            res.send(`SUCCESS: Review with ID ${req.params.id} updated`); // Tested in postcode, working!
        } catch {
            Logger.log(`UERROR: Failed to update review with ID ${req.params.id}`);
            return;
        }
    })
    .delete(async (req, res) => {
        if (!req.params.id) {
            res.status(400).send("UERROR: Missing review ID");
            return;
        }
        try {
            await Review.destroy({
                where: {
                    reviewID: req.params.id
                }
            });
            res.send(`SUCCESS: Review with ID ${req.params.id} deleted`);     // Tested in postcode, working!
        } catch {
            Logger.log(`UERROR: Failed to delete review with ID ${req.params.id}`);
            return;
        }
    });

module.exports = router;
