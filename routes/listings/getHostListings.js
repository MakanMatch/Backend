const express = require("express");
const router = express.Router();
const { FoodListing } = require("../../models");
const { validateToken } = require("../../middleware/auth");
const { Logger } = require("../../services");

router.get("/", validateToken, async (req, res) => { // GET all hosts' food listings
    const hostID = req.user.userID;
    if (req.user.userType !== "Host") {
        return res.status(400).send("UERROR: You need to be a host before you can view your listings.");
    }

    try {
        const hostListings = await FoodListing.findAll({
            where: {
                hostID: hostID
            }
        });
        
        return res.status(200).send(hostListings);
    } catch (err) {
        Logger.log(`LISTINGS GETHOSTLISTINGS ERROR: ${err}`);
        return res.status(500).send("ERROR: Failed to retrieve host listings.");
    }
});

module.exports = { router, at: '/listings/getHostListings' };