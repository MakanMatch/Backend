const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const { FoodListing, Host, Guest, Admin, Review } = require("../../models");
const Logger = require("../../services/Logger");
const { Sequelize } = require('sequelize');
const Universal = require("../../services/Universal");
const { validateToken } = require("../../middleware/auth");

router.get('/MyAccount', validateToken, (req, res) => {
    const userInfo = req.user;
    res.json(userInfo);
});

router.get("/fetchHostDetails", async (req, res) => {
    const hostDetails = {
        hostUsername: Universal.data["DUMMY_HOST_USERNAME"],
        hostFoodRating: Universal.data["DUMMY_HOST_FOODRATING"]
    }
    res.status(200).json(hostDetails);
})

router.get("/fetchGuestDetails", async (req, res) => {
    const targetGuest = await Guest.findByPk(Universal.data["DUMMY_GUEST_ID"])
    if (!targetGuest) {
        return res.status(404).send("Dummy Guest not found.");
    }
    const guestFavCuisine = targetGuest.favCuisine;
    const guestDetails = {
        guestUserID: Universal.data["DUMMY_GUEST_ID"],
        guestUsername: Universal.data["DUMMY_GUEST_USERNAME"],
        guestFavCuisine: guestFavCuisine
    }
    res.status(200).json(guestDetails);
})

router.get("/listings", async (req, res) => { // GET all food listings
    try {
        const foodListings = await FoodListing.findAll();
        foodListings.map(listing => (listing.images == null || listing.images == "") ? listing.images = [] : listing.images = listing.images.split("|"));
        res.status(200).json(foodListings);
    } catch (error) {
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
    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    const listing = await FoodListing.findByPk(listingID)
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

router.get("/getReviews", async (req, res) => { // GET full reviews list
    try {
        const where = {};
        const order = [];

        if (!req.query.hostID) {
            return res.status(400).send("ERROR: Missing host ID or order.");
        } else {
            where.hostID = req.query.hostID;
        }

        if (req.query.order) {
            if (req.query.order === "mostRecent") {
                order.push(['dateCreated', 'DESC']);
            } else if (req.query.order === "highestRating") {
                order.push([
                    Sequelize.literal('foodRating + hygieneRating'), 'DESC'
                ])
            } else if (req.query.order === "lowestRating") {
                order.push([
                    Sequelize.literal('foodRating + hygieneRating'), 'ASC'
                ])
            } else {
                order.push(['dateCreated', 'DESC']);
            }
        }

        try {
            const host = await Host.findByPk(req.query.hostID);
            if (!host) {
                return res.status(404).send("UERROR: Host not found.");
            } else {
                const reviews = await Review.findAll({
                    where,
                    order,
                    include: [{
                        model: Guest,
                        as: 'guest',
                        attributes: ['username']
                    }]
                })

                if (req.query.order === "images") {
                    reviews.sort((a, b) => {
                        const imageCountA = a.images ? a.images.split("|").length : 0;
                        const imageCountB = b.images ? b.images.split("|").length : 0;
                        return imageCountB - imageCountA;
                    });
                }

                if (reviews.length > 0) {
                    res.json(reviews);
                }
            }
        } catch (err) {
            Logger.log(`CDN COREDATA GETREVIEWS ERROR: Failed to retrieve reviews; error: ${err}.`);
            return res.status(404).send("ERROR: No reviews found.");
        }

    } catch (err) {
        Logger.log(`CDN COREDATA GETREVIEWS ERROR: Failed to retrieve reviews; error: ${err}.`);
        return res.status(500).send("ERROR: An error occured while fetching reviews.");
    }
})

router.get("/reviews", async (req, res) => { // GET review from review id
    if (!req.query.id) {
        return res.status(400).send("ERROR: Missing review ID");
    } else {
        const review = await Review.findByPk(req.query.id);
        if (review) {
            res.json(review);
        } else {
            return res.status(404).send(`ERROR: Review with ID ${req.params.id} not found`);
        }
    }
})

module.exports = router;