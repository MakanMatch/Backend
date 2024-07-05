const express = require('express');
const router = express.Router();
const { Review } = require('../../models');
const Logger = require('../../services/Logger');

router.route("/")
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

module.exports = { router, at: '/manageReviews' };
