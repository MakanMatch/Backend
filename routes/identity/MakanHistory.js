const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Extensions = require("../../services/Extensions");
const { FoodListing, Host, Guest, Admin, Review, Reservation, ReviewLike } = require("../../models");
const Logger = require("../../services/Logger");
const { Sequelize } = require('sequelize');
const Universal = require("../../services/Universal");
const { validateToken, checkUser } = require("../../middleware/auth");
const { Op } = require("sequelize");

router.get("/getGuestPastReservations", validateToken, async(req, res) => {
    const userID = req.user.userID;
    if (!userID) {
        return res.status(400).send("ERROR: One or more required payloads were not provided");
    }
    try {
        const user = await Guest.findByPk(userID) || await Host.findByPk(userID);
        if (!user) {
            return res.status(404).send("ERROR: User doesn't exist");
        } else {
            const pastReservations = await Reservation.findAll({
                where: {
                    guestID: userID,
                    datetime: {
                        [Op.lt]: new Date().toISOString()
                    }
                }
            });
            if (pastReservations.length > 0) {
                const foodListings = await FoodListing.findAll({
                    where: {
                        listingID: {
                            [Op.in]: pastReservations.map(reservation => reservation.listingID)
                        }
                    },
                    include: [{
                        model: Host,
                        attributes: ["username", "foodRating"]
                    }]
                });
                var resultantResponse = []
                pastReservations.map(reservation => {
                    const listing = foodListings.find(listing => listing.listingID == reservation.listingID);
                    if (listing && listing.datetime < new Date().toISOString()) {
                        resultantResponse.push({
                            datetime: reservation.datetime,
                            guestID: reservation.guestID,
                            listingID: reservation.listingID,
                            markedPaid: reservation.markedPaid,
                            paidAndPresent: reservation.paidAndPresent,
                            portions: reservation.portions,
                            referenceNum: reservation.referenceNum,
                            totalPrice: reservation.totalPrice,
                            listing: listing
                        });
                    }
                });
                return res.status(200).json(resultantResponse);
            } else {
                return res.status(200).json([]);
            }
        }
    } catch (err) {
        Logger.log(`MAKAN_HISTORY GETGUESTPASTRESERVATIONS ERROR: ${err}`)
        return res.status(500).send("ERROR: An error occured while retrieving user's past reservations");
    }
});

module.exports = { router, at: '/makanHistory' };