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
        whereClause.hostID = hostID;
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

        const listingsWithImagesArray = foodListings.map(listing => {
            var listingJson = listing.toJSON();
            listingJson.images = listingJson.images ? listingJson.images.split("|") : [];
            listingJson = Extensions.sanitiseData(
                listingJson,
                [],
                [
                    "password",
                    "address",
                    "createdAt",
                    "updatedAt",
                    "HostUserID"
                ],
                []
            )
            return listingJson;
        });

        return res.status(200).json(listingsWithImagesArray);
    } catch (error) {
        Logger.log("CDN COREDATA LISTINGS ERROR: Failed to retrieve all published listings; error: " + error);
        return res.status(500).send("ERROR: Internal server error");
    }
});

router.get("/checkFavouriteListing", async (req, res) => { // GET favourite listing
    try {
        const listingID = req.query.listingID;
        const userID = req.query.userID;
        const guest = await Guest.findByPk(userID);
        if (!guest) {
            return res.status(404).send("UERROR: Your account details were not found");
        }
        const favouriteCuisines = guest.favCuisine.split("|");
        if (favouriteCuisines.includes(listingID)) {
            return res.status(200).json({ message: "SUCCESS: Listing is a favourite", listingIsFavourite: true });
        } else {
            return res.status(200).json({ message: "SUCCESS: Listing is not a favourite", listingIsFavourite: false });
        }
    } catch (error) {
        return res.status(500).send("ERROR: Internal server error");
    }
});

router.get("/getListing", checkUser, async (req, res) => {
    const listingID = req.query.id || req.body.listingID;
    const includeReservations = req.query.includeReservations;
    const includeHost = req.query.includeHost;

    var includeClause = []
    if (includeReservations == 'true') {
        includeClause.push({
            model: Guest,
            as: "guests"
        })
    }
    if (includeHost == 'true') {
        includeClause.push({
            model: Host,
            as: "Host"
        })
    }

    if (!listingID) {
        res.status(400).send("ERROR: Listing ID not provided.")
        return
    }

    const listing = await FoodListing.findByPk(listingID, {
        include: includeClause
    })

    if (!listing || listing == null) {
        res.status(404).send("ERROR: Listing not found")
        return
    }

    var isHost = req.user && listing.hostID == req.user.userID;
    if (!isHost && !listing.published) {
        res.status(404).send("ERROR: Listing not found")
        return
    }
    
    res.json(
        Extensions.sanitiseData(listing.toJSON(), [
            "listingID",
            "title",
            "images",
            "shortDescription",
            "longDescription",
            "datetime",
            "portionPrice",
            "approxAddress",
            "address",
            "totalSlots",
            "published",
            "hostID",
            "userID",
            "username",
            "fname",
            "lname",
            "markedPaid",
            "paidAndPresent",
            "mealsMatched",
            "foodRating",
            "hygieneGrade",
            "referenceNum",
            "guestID",
            "portions",
            "totalPrice"
        ], ["createdAt", "updatedAt"])
    )
    return
})

router.get("/accountInfo", async (req, res) => { // GET account information
    try {
        const targetUserID = req.query.userID;
        if (!targetUserID) { res.status(400).send("ERROR: One or more required payloads not provided."); }
        let user, userType;

        user = await Guest.findByPk(targetUserID);
        if (user) {
            userType = 'Guest';
        } else {
            user = await Host.findByPk(targetUserID);
            if (user) {
                userType = 'Host';

            } else {
                user = await Admin.findByPk(targetUserID);
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
            fname: user.fname,
            lname: user.lname,
            username: user.username,
            email: user.email,
            contactNum: user.contactNum,
            approxAddress: user.approxAddress,
            address: user.address,
            emailVerified: user.emailVerified,
            resetKey: user.resetKey,
            resetKeyExpiration: user.resetKeyExpiration,
            createdAt: user.createdAt,
            userType: userType,
            reviewsCount: user.reviewsCount
        };

        if (userType === 'Admin') {
            accountInfo.role = user.role;
        } else if (userType === 'Host') {
            accountInfo.favCuisine = user.favCuisine;
            accountInfo.mealsMatched = user.mealsMatched;
            accountInfo.foodRating = user.foodRating;
            accountInfo.hygieneGrade = user.hygieneGrade;
            accountInfo.paymentImage = user.paymentImage;
            accountInfo.reviewsCount = user.reviewsCount;
        } else if (userType === 'Guest') {
            accountInfo.favCuisine = user.favCuisine;
            accountInfo.mealsMatched = user.mealsMatched;
        }

        return res.status(200).json(accountInfo);
    } catch (err) {
        Logger.log(`CDN COREDATA ACCOUNTINFO ERROR: Failed to retrieve account information; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to process request, please try again.")
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

                const reviewsJSON = reviews.map(review => review.toJSON());
                
                if (!checkGuest) {
                    const likedReviews = await ReviewLike.findAll({
                        where: {
                            guestID: guestID
                        },
                        attributes: ['reviewID']
                    });
                    if (likedReviews.length > 0) {
                        const likedReviewIDs = likedReviews.map(likedReview => likedReview.reviewID);
                        reviewsJSON.forEach(review => { 
                            review.isLiked = likedReviewIDs.includes(review.reviewID); 
                        });
                    }
                } else {
                    reviewsJSON.forEach(review => { 
                        review.isLiked = false; 
                    });
                }

                if (order === "images") {
                    reviewsJSON.sort((a, b) => {
                        const imageCountA = a.images ? a.images.split("|").length : 0;
                        const imageCountB = b.images ? b.images.split("|").length : 0;
                        return imageCountB - imageCountA;
                    });
                }

                if (reviews.length > 0) {
                    res.json(reviewsJSON.length > 0 ? reviewsJSON : []);
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

router.get("/fetchAllUsers", validateToken, async (req, res) => { // GET all users
    const fetchHostsOnly = req.query.fetchHostsOnly || "false";

    const currentUserType = req.user.userType;
    if (currentUserType !== "Admin") {
        return res.status(403).send("ERROR: Unauthorized access.");
    }

    const hosts = await Host.findAll();
    const hostsWithUserType = (hosts.map(host => {
        const hostObj = host.toJSON(); // Convert Sequelize instance to plain object
        hostObj.userType = "Host";
        return hostObj;
    }));

    let responseArray = [];

    if (fetchHostsOnly === "false") {
        const guests = await Guest.findAll();
        const guestsWithUserType = (guests.map(guest => {
            const guestObj = guest.toJSON(); // Convert Sequelize instance to plain object
            guestObj.userType = "Guest";
            return guestObj;
        }));
        const allUsers = hostsWithUserType.concat(guestsWithUserType);
        if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
            return res.status(200).send([]);
        } else {
            allUsers.forEach(user => {
                responseArray.push(Extensions.sanitiseData(user, ["userID", "username", "email", "userType", "hygieneGrade"], ["password"], []));
            });
            return res.status(200).json(responseArray);
        }
    } else {
        if (!hostsWithUserType || !Array.isArray(hostsWithUserType) || hostsWithUserType.length === 0) {
            return res.status(200).send([]);
        } else {
            warningHosts = hostsWithUserType.filter(host => host.hygieneGrade <= 2.5);
            warningHosts.forEach(host => {
                responseArray.push(Extensions.sanitiseData(host, ["userID", "username", "email", "userType", "hygieneGrade"], ["password"], []));
            });
            return res.status(200).json(responseArray);
        }
    }
});

router.get("/consolidateReviewsStatistics", async (req, res) => { // GET full reservations list
    const { hostID } = req.query;
    if (!hostID) {
        return res.status(400).send("UERROR: One or more required payloads were not provided");
    }
    try {
        const findHost = await Host.findByPk(hostID);
        if (!findHost) {
            return res.status(404).send("ERROR: Host doesn't exist");
        } else {
            const hostFoodRatings = await Review.findAll({
                where: { hostID },
                attributes: ['foodRating']
            });
            if (hostFoodRatings.length > 0) {
                const oneStarRatings = hostFoodRatings.filter(rating => rating.foodRating === 1).length;
                const twoStarRatings = hostFoodRatings.filter(rating => rating.foodRating === 2).length;
                const threeStarRatings = hostFoodRatings.filter(rating => rating.foodRating === 3).length;
                const fourStarRatings = hostFoodRatings.filter(rating => rating.foodRating === 4).length;
                const fiveStarRatings = hostFoodRatings.filter(rating => rating.foodRating === 5).length;
                const totalRatings = hostFoodRatings.length;

                const consolidatedData = {
                    oneStar: (oneStarRatings / totalRatings) * 100,
                    twoStar: (twoStarRatings / totalRatings) * 100,
                    threeStar: (threeStarRatings / totalRatings) * 100,
                    fourStar: (fourStarRatings / totalRatings) * 100,
                    fiveStar: (fiveStarRatings / totalRatings) * 100
                }
                return res.status(200).json(consolidatedData);
            } else {
                return res.status(200).json(
                    { 
                        message: "No reviews found.",
                        consolidatedData: {
                            oneStar: 0,
                            twoStar: 0,
                            threeStar: 0,
                            fourStar: 0,
                            fiveStar: 0
                        }
                    }
                );
            }
        }
    } catch (err) {
        Logger.log(`CDN COREDATA CONSOLIDATEREVIEWSSTATISTICS ERROR: Failed to consolidate review statistics: ${err}.`);
        return res.status(500).send("ERROR: An error occured while retrieving review statistics");
    }
});

module.exports = { router, at: '/cdn' };