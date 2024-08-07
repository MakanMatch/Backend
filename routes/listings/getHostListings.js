const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const Extensions = require("../../services/Extensions");
const { FoodListing, Host, Guest, Admin, Review, Reservation, ReviewLike, UserRecord } = require("../../models");
const Logger = require("../../services/Logger");
const { Sequelize } = require('sequelize');
const Universal = require("../../services/Universal");
const { validateToken, checkUser } = require("../../middleware/auth");
const { Op } = require("sequelize");

router.get("/", validateToken, async (req, res) => { // GET all hosts' food listings
    const hostID = req.user.userID;
    const hostListings = await FoodListing.findAll({
        where: {
            hostID: hostID
        }
    });
    return res.status(200).send(hostListings);
});

module.exports = { router, at: '/listings/getHostListings' };