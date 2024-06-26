const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const { FoodListing, Host, Guest, Admin, Review } = require("../../models");
const { EmptyResultError, or } = require("sequelize");
const { orderBy } = require("firebase/firestore");

router.get("/listings", async (req, res) => { // GET all food listings
    try {
        const foodListings = await FoodListing.findAll();
        foodListings.map(listing => listing.images = listing.images.split("|"));
        res.status(200).json(foodListings);
    } catch (error) {
        res.status(500).send("ERROR: Internal server error");
    }
});

router.get("/accountInfo", async (req, res) => { // GET account information
    try {
        const targetUserID = req.query.userID;
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
            return res.status(404).send("User does not exist.");
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

        console.log(`Account info for userID ${targetUserID}: ${JSON.stringify(accountInfo)}`)
        res.status(200).json(accountInfo);

    } catch (err) {
        res.status(500).send("An error occured while fetching the account information.")
    }
})

router.get("/getReviews", async (req, res) => { // GET full reviews list
    try {
        const where = {};
        const order = [];

        if (req.query.hostID) {
            where.hostID = req.query.hostID;
        }

        if (req.query.order) {
            if (req.query.order === "mostRecent") {
                order.push(['dateCreated', 'DESC']);
            } else if (req.query.order === "highestRating") {
                accRating = parseInt(order.foodRating) + parseInt(order.hygieneRating);
                order.push([accRating, 'DESC']);
            } else if (req.query.order === "lowestRating") {
                accRating = parseInt(order.foodRating) + parseInt(order.hygieneRating);
                order.push([accRating, 'ASC']);
            } else if (req.query.order === "images") {
                order.push(['images', 'ASC']);
            }
        }

        const reviews = await Review.findAll({ where, order});
        try {
            res.status(200).json(reviews);
        } catch (error) {
            res.status(404).send("ERROR: No reviews found.");
        }

    } catch (error) {
        res.status(500).send("ERROR: Internal server error");
    }
})

router.get("/reviews", async (req, res) => { // GET review from review id
    const review = await Review.findOne({ where: { reviewID: req.query.id } });
    if (review) {
        res.json(review);
    } else {
        res.status(404).send(`Review with ID ${req.params.id} not found`);
    }
})

module.exports = router;