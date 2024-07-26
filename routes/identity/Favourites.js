const express = require("express");
const router = express.Router();
const { FoodListing, Host, UserRecord } = require("../../models");
const { validateToken } = require("../../middleware/auth");
const { Op } = require("sequelize");
const Logger = require("../../services/Logger");

router.get('/getFavouritedListings', validateToken, async (req, res) => {
    const userID = req.user.userID;

    var userRecord;
    try {
        userRecord = await UserRecord.findOne({
            where: {
                [Op.or]: [
                    { hID: userID },
                    { gID: userID },
                    { aID: userID }
                ]
            },
            include: [
                {
                    model: FoodListing,
                    as: "favourites",
                    include: {
                        model: Host,
                        as: "Host"
                    }
                }
            ]
        })
    } catch (err) {
        Logger.log(`IDENTITY FAVOURITES GETFAVOURITEDLISTINGS ERROR: Failed to retrieve favourited listings; error: ${err}.`);
    }

    const listings = userRecord.favourites.map(listing => {
        listing.images = listing.images ? listing.images.split("|") : listing.images = []
        return listing;
    });
    return res.send(listings);
})

module.exports = { router, at: '/favourites' };