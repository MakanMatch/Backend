const express = require('express');
const router = express.Router();
const { Review } = require('../../models');
const Logger = require('../../services/Logger');

router.get("/", async (req, res) => {
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
        Logger.log(`REVIEWS HOSTREVIEW GET ERROR: Failed to retrieve host review; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to retrieve host review");
    }
});

module.exports = { router, at: '/hostReview' };