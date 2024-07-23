const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const { FoodListing, Host, Guest, Admin, Review, Reservation, ReviewLike } = require("../../models");
const Logger = require("../../services/Logger");
const { Sequelize } = require('sequelize');
const Universal = require("../../services/Universal");
const { validateToken, checkUser } = require("../../middleware/auth");

router.get('/myAccount', validateToken, (req, res) => {
    const userInfo = req.user;
    res.json(userInfo);
});

router.get("/listings", async (req, res) => { // GET all food listings
    const hostID = req.query.hostID;
    const includeHost = req.query.includeHost;
    const includeReservations = req.query.includeReservations;
    var whereClause = { published: true };
    if (hostID) {
        whereClause.HostID = hostID;
    }

    var includeClause = []
    if (includeHost == 'true') {
        includeClause.push({
            model: Host,
            as: "Host",
            attributes: ["userID", "username", "foodRating"]
        })
    }
    if (includeReservations == 'true') {
        includeClause.push({
            model: Guest,
            as: "guests"
        })
    }

    try {
        const foodListings = await FoodListing.findAll({
            where: whereClause,
            include: includeClause
        });
        foodListings.map(listing => (listing.images == null || listing.images == "") ? listing.images = [] : listing.images = listing.images.split("|"));
        res.status(200).json(foodListings);
    } catch (error) {
        Logger.log("CDN COREDATA LISTINGS ERROR: Failed to retrieve all published listings; error: " + error)
        res.status(500).send("ERROR: Internal server error");
    }
});

router.get("/checkFavouriteListing", async (req, res) => { // GET favourite listing
    try {
        const listingID = req.query.listingID;
        const userID = req.query.userID;
        const guest = await Guest.findByPk(userID);
        if (!guest) {
            return res.status(404).send("Guest not found.");
        }
        const favouriteCuisines = guest.favCuisine.split("|");
        if (favouriteCuisines.includes(listingID)) {
            res.status(200).json({ message: "SUCCESS: Listing is a favourite", listingIsFavourite: true });
        } else {
            res.status(200).json({ message: "SUCCESS: Listing is not a favourite", listingIsFavourite: false });
        }
    } catch (error) {
        res.status(500).send("ERROR: Internal server error");
    }
});

router.get("/getListing", async (req, res) => {
    const listingID = req.query.id || req.body.listingID;
    const includeReservations = req.query.includeReservations;
    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    const listing = await FoodListing.findByPk(listingID, {
        include: includeReservations ? [{
            model: Guest,
            as: "guests"
        }] : []
    })

    if (!listing || listing == null) {
        res.status(404).send("ERROR: Listing not found")
        return
    }
    res.json(listing)
    return
})

router.get("/accountInfo", async (req, res) => { // GET account information
    try {
        const targetUserID = req.query.userID;
        if (!targetUserID) { res.status(400).send("ERROR: One or more required payloads not provided."); }
        let user, userType;

        user = await Guest.findOne({ where: { userID: targetUserID } });
        if (user) {
            userType = 'Guest';
        } else {
            user = await Host.findOne({ where: { userID: targetUserID } });
            if (user) {
                userType = 'Host';

            } else {
                user = await Admin.findOne({ where: { userID: targetUserID } });
                if (user) {
                    userType = 'Admin';
                }
            }
        }

        if (!user) {
            return res.status(404).send("ERROR: User does not exist.");
        }

        const accountInfo = {
            userID: user.userID,
            username: user.username,
            email: user.email,
            contactNum: user.contactNum,
            address: user.address,
            emailVerified: user.emailVerified,
            resetKey: user.resetKey,
            resetKeyExpiration: user.resetKeyExpiration,
            createdAt: user.createdAt,
            userType: userType
        };

        if (userType === 'Admin') {
            accountInfo.role = user.role;
        } else if (userType === 'Host') {
            accountInfo.favCuisine = user.favCuisine;
            accountInfo.mealsMatched = user.mealsMatched;
            accountInfo.foodRating = user.foodRating;
            accountInfo.hygieneGrade = user.hygieneGrade;
            accountInfo.paymentImage = user.paymentImage;
        } else if (userType === 'Guest') {
            accountInfo.favCuisine = user.favCuisine;
            accountInfo.mealsMatched = user.mealsMatched;
        }

        res.status(200).json(accountInfo);

    } catch (err) {
        res.status(500).send("ERROR: An error occured while fetching the account information.")
        console.log(err)
    }
})

router.get("/getReviews", checkUser, async (req, res) => { // GET full reviews list
    try {
        const { hostID, order } = req.query;
        const where = {};
        const reviewOrder = [];
        var checkGuest = false

        if (!hostID || !order) {
            return res.status(400).send("ERROR: Missing host ID or sorting order.");
        } else {
            where.hostID = hostID;
        }
        if (req.user) {
            var guestID = req.user.userID;
            checkGuest = false
        } else {
            var guestID = null;
            checkGuest = true
        }

        if (order === "mostRecent") {
            reviewOrder.push(['dateCreated', 'DESC']);
        } else if (order === "highestRating") {
            reviewOrder.push([
                Sequelize.literal('foodRating + hygieneRating'), 'DESC'
            ])
        } else if (order === "lowestRating") {
            reviewOrder.push([
                Sequelize.literal('foodRating + hygieneRating'), 'ASC'
            ])
        } else {
            reviewOrder.push(['dateCreated', 'DESC']);
        }

        try {
            const host = await Host.findByPk(hostID);
            if (!host) {
                return res.status(404).send("UERROR: Host not found.");
            } else {
                const reviews = await Review.findAll({
                    where,
                    order: reviewOrder,
                    include: [{
                        model: Guest,
                        as: 'reviewPoster',
                        attributes: ['username']
                    }]
                })
                if (!checkGuest) {
                    const likedReviews = await ReviewLike.findAll({
                        where: {
                            guestID: guestID
                        }
                    });
                    if (likedReviews.length > 0) {
                        const likedReviewIDs = likedReviews.map(likedReview => likedReview.reviewID);
                        reviews.forEach(review => {
                            review.dataValues.isLiked = likedReviewIDs.includes(review.reviewID);
                        });
                    }
                }

                if (order === "images") {
                    reviews.sort((a, b) => {
                        const imageCountA = a.images ? a.images.split("|").length : 0;
                        const imageCountB = b.images ? b.images.split("|").length : 0;
                        return imageCountB - imageCountA;
                    });
                }

                if (reviews.length > 0) {
                    res.json(reviews);
                } else {
                    return res.status(200).json([]);
                }
            }
        } catch (err) {
            Logger.log(`CDN COREDATA GETREVIEWS GET ERROR: Failed to retrieve reviews; error: ${err}.`);
            return res.status(404).send("ERROR: No reviews found.");
        }

    } catch (err) {
        Logger.log(`CDN COREDATA GETREVIEWS ERROR: Failed to retrieve reviews; error: ${err}.`);
        return res.status(500).send("ERROR: An error occured while fetching reviews.");
    }
})

module.exports = { router, at: '/cdn' };