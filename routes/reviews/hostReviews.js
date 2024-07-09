const express = require('express');
const router = express.Router();
const { Review } = require('../../models');
const Logger = require('../../services/Logger');

router.get("/", async (req, res) => {
    if (!req.query.hostID) {
        return res.status(400).send("ERROR: Missing host ID");
    }
    try {
        const hostReviews = await Review.findAll({
            where: { hostID: req.query.hostID }
        })
        if (!hostReviews) {
            return res.send([]);
        } else {
            res.json(hostReviews);
        }
    } catch (err) {
        Logger.log(`REVIEWS HOSTREVIEW GET ERROR: Failed to retrieve host reviews; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to retrieve host reviews");
    }
});

module.exports = { router, at: '/hostReviews' };