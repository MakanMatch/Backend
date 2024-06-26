const express = require("express");
const router = express.Router();
const path = require("path");
const FileManager = require("../../services/FileManager");
const { FoodListing, Host, Guest, Admin } = require("../../models");

router.get("/listings", async (req, res) => { // GET all food listings
    try {
        const foodListings = await FoodListing.findAll();
        foodListings.map(listing => listing.images = listing.images.split("|"));
        res.status(200).json(foodListings);
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

router.get("/getReviews", (req, res) => { // GET full reviews list
    res.json({}); // Placeholder, change later
})

router.get("/reviews", (req, res) => { // GET review from review id
    res.send("TBC")
    // const review = reviews[req.query.id];
    // if (review) {
    //     res.json(review);
    // } else {
    //     res.status(404).send(`Review with ID ${req.params.id} not found`);
    // }
})

module.exports = router;