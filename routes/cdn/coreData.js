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
const { Analytics } = require("../../services");

router.get('/myAccount', validateToken, (req, res) => {
    const userInfo = req.user;
    res.json(userInfo);
});

router.get("/listings", async (req, res) => { // GET all food listings
    const hostID = req.query.hostID;
    const includeReservations = req.query.includeReservations;
    var includeClause = [
        {
            model: Host,
            as: "Host",
            attributes: ["userID", "username", "foodRating", "flaggedForHygiene"]
        }
    ]
    if (includeReservations == 'true') {
        includeClause.push({
            model: Guest,
            as: "guests"
        })
    }

    try {
        const bannedHostIDs = (await UserRecord.findAll({
            where: {
                [Op.and]: [
                    { banned: true },
                    { hID: { [Op.not]: null } }
                ]
            }
        })).map(record => record.hID);

        var whereClause = { published: true };
        if (hostID) {
            whereClause.hostID = hostID;
        } else {
            whereClause.hostID = {
                [Op.notIn]: bannedHostIDs
            }
        }

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
    const includeReservations = req.query.includeReservations === 'true';
    const includeHost = req.query.includeHost === 'true';

    var includeClause = []
    if (includeReservations) {
        includeClause.push({
            model: Guest,
            as: "guests"
        })
    }
    if (includeHost) {
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

    var preppedData = listing.toJSON();

    const guests = listing.guests ? listing.guests.map(guest => guest.userID) : [];

    // User is not the host or a reserved guest, remove sensitive information
    if (!isHost && (!req.user || !guests.includes(req.user.userID))) {
        delete preppedData.address;
        if (preppedData.guests) {
            preppedData.guests = preppedData.guests.map(guest => {
                const { userID, Reservation } = guest;
                const { portions } = Reservation;

                return {
                    userID,
                    Reservation: {
                        portions
                    }
                }
            })
        }
        if (preppedData.Host) {
            delete preppedData.Host.paymentImage;
            delete preppedData.Host.address;
            delete preppedData.Host.coordinates;
        }
    }

    // User is a reserved guest, process other guest information
    if (req.user && guests.includes(req.user.userID)) {
        preppedData.guests = preppedData.guests.map(guest => {
            if (guest.userID != req.user.userID) {
                delete guest.address;
            }
            return guest;
        });
    }

    // User is the host, include listing metrics
    if (isHost) {
        const listingMetrics = await Analytics.getListingMetrics(listingID)
        if (typeof listingMetrics !== "string") {
            try {
                preppedData.impressions = listingMetrics.impressions;
                if (listingMetrics.impressions > 0 && listingMetrics.clicks > 0) {
                    const ctr = Math.round((listingMetrics.clicks / listingMetrics.impressions) * 100)
                    preppedData.ctr = `${ctr}%`
                }
            } catch (err) {
                Logger.log(`COREDATA GETLISTING ERROR: Failed to collate listing metrics; error: ${err}`)
            }
        }
    }
    
    res.json(
        Extensions.sanitiseData(preppedData, [
            "listingID",
            "title",
            "images",
            "shortDescription",
            "longDescription",
            "datetime",
            "portionPrice",
            "address",
            "coordinates",
            "approxAddress",
            "approxCoordinates",
            "paymentImage",
            "totalSlots",
            "published",
            "hostID",
            "userID",
            "username",
            "fname",
            "lname",
            "markedPaid",
            "paidAndPresent",
            "chargeableCancelActive",
            "mealsMatched",
            "foodRating",
            "hygieneGrade",
            "referenceNum",
            "guestID",
            "portions",
            "totalPrice",
            "flaggedForHygiene",
            "impressions",
            "ctr"
        ], ["createdAt", "updatedAt"])
    )
    return
})

router.get("/accountInfo", checkUser, async (req, res) => { // GET account information
    try {
        const targetUserID = req.query.userID;
        if (!targetUserID) { res.status(400).send("ERROR: One or more required payloads not provided."); }
        let user, userType;

        user = await Guest.findOne({ where: { userID: targetUserID } });

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

        if (req.user && req.user.userType && req.user.userType !== "Admin") {
            // Check if user is banned
            const userRecord = await UserRecord.findOne({
                where: {
                    [Op.or]: [
                        { hID: targetUserID },
                        { gID: targetUserID },
                        { aID: targetUserID }
                    ]
                }
            })
            if (!userRecord) {
                return res.status(500).send("ERROR: Failed to process request. Please try again.")
            }

            if (userRecord.banned) {
                return res.status(404).send("UERROR: Account not found.")
            }
        }

        const accountInfo = {
            userID: user.userID,
            fname: user.fname,
            lname: user.lname,
            username: user.username,
            email: user.email,
            emailVerificationTime: user.emailVerificationTime,
            contactNum: user.contactNum,
            approxAddress: user.approxAddress,
            address: user.address,
            emailVerified: user.emailVerified,
            resetKey: user.resetKey,
            resetKeyExpiration: user.resetKeyExpiration,
            createdAt: user.createdAt,
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
            accountInfo.flaggedForHygiene = user.flaggedForHygiene;
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

                var reviewsJSON = reviews.map(review => review.toJSON());
                
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
                    // Filter out reviews with images
                    reviewsJSON = reviewsJSON.filter(review => review.images);

                    // Sort reviews in descending order of image count
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

    const userRecords = await UserRecord.findAll();

    const hosts = await Host.findAll();
    const hostsWithUserType = (hosts.map(host => {
        const hostObj = host.toJSON(); // Convert Sequelize instance to plain object
        hostObj.userType = "Host";
        hostObj.banned = userRecords.find(record => record.hID === hostObj.userID).banned;
        return hostObj;
    }));

    let responseArray = [];

    if (fetchHostsOnly === "false") {
        const guests = await Guest.findAll();
        const guestsWithUserType = (guests.map(guest => {
            const guestObj = guest.toJSON(); // Convert Sequelize instance to plain object
            guestObj.userType = "Guest";
            guestObj.banned = userRecords.find(record => record.gID === guestObj.userID).banned;
            return guestObj;
        }));
        const allUsers = hostsWithUserType.concat(guestsWithUserType);
        if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
            return res.status(200).send([]);
        } else {
            allUsers.forEach(user => {
                responseArray.push(Extensions.sanitiseData(user, ["userID", "fname", "lname", "username", "email", "userType", "contactNum", "hygieneGrade", "banned", "flaggedForHygiene"], ["password"], []));
            });
            return res.status(200).json(responseArray);
        }
    } else {
        if (!hostsWithUserType || !Array.isArray(hostsWithUserType) || hostsWithUserType.length === 0) {
            return res.status(200).send([]);
        } else {
            warningHosts = hostsWithUserType.filter(host => host.hygieneGrade <= 2.5 && host.hygieneGrade > 0);
            warningHosts.forEach(host => {
                responseArray.push(Extensions.sanitiseData(host, ["userID", "fname", "lname", "username", "email", "userType", "contactNum", "hygieneGrade", "banned", "flaggedForHygiene"], ["password"], []));
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