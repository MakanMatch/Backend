const express = require("express");
const router = express.Router();
const FileManager = require("../../services/FileManager");
const path = require("path")
const { FoodListing, Review, Host, Guest, Admin } = require("../../models");
const { checkUser } = require("../../middleware/auth");
const { Logger, Extensions, TokenManager } = require("../../services");

router.get("/getImageForListing", async (req, res) => {
    const { listingID, imageName } = req.query;
    if (!listingID || !imageName) {
        return res.status(400).send("ERROR: Invalid request parameters.");
    }

    // Find the listing
    const findListing = await FoodListing.findByPk(listingID);
    if (!findListing) {
        return res.status(404).send("ERROR: Listing not found.");
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        return res.status(404).send("ERROR: Image not found.");
    }

    const listingImages = findListing.images.split("|");
    
    if (listingImages.includes(imageName) !== true) {
        return res.status(404).send("ERROR: Requested image does not belong to its corresponding listing.");
    }
    return res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length));
});

router.get("/getImageForReview", async (req, res) => {
    const { reviewID, imageName } = req.query;
    if (!reviewID || !imageName) {
        res.status(400).send("ERROR: Invalid request parameters.");
        return;
    }

    // Find the review
    const findReview = await Review.findByPk(reviewID);
    if (!findReview) {
        res.status(404).send("ERROR: Review not found.");
        return;
    }

    const reviewImages = findReview.images.split("|");

    if (reviewImages.includes(imageName) !== true) {
        return res.status(404).send("ERROR: Image not found.");
    }

    const findImageName = await FileManager.prepFile(imageName);
    if (!findImageName.startsWith("SUCCESS")) {
        return res.status(404).send("ERROR: Image not found.");
    }

    res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
    return;
});

// router.get("/getProfilePicture", async (req, res) => {
//     const { userID } = req.query;
//     if (!userID) {
//         res.status(400).send("ERROR: Invalid request parameters.");
//         return;
//     }

//     const findImageName = await FileManager.prepFile(imageName);
//     if (!findImageName.startsWith("SUCCESS")) {
//         res.status(404).send("ERROR: Image not found.");
//         return;
//     }

//     res.status(200).sendFile(findImageName.substring("SUCCESS: File path: ".length))
//     return;
// });

router.get("/getHostPaymentQR", checkUser, async (req, res) => {
    const { listingID, hostID, token } = req.query;
    var userID;
    var userType;
    if (!req.user) {
        if (!token) {
            return res.status(403).send("ERROR: Authorisation tests failed.");
        } else {
            try {
                const { payload } = TokenManager.default().verify(token, false);
                userID = payload.userID;
                
                var user = await Guest.findByPk(userID, { attributes: ["userID"] });
                userType = "Guest";
                if (!user) {
                    user = await Host.findByPk(userID, { attributes: ["userID"] });
                    userType = "Host";
                    if (!user) {
                        user = await Admin.findByPk(userID, { attributes: ["userID"] });
                        userType = "Admin";
                        if (!user) {
                            return res.status(404).send("ERROR: User not found.");
                        }
                    }
                }
            } catch (err) {
                return res.status(403).send("ERROR: Authorisation tests failed.");
            }
        }
    } else {
        userID = req.user.userID;
        userType = req.user.userType;
    }

    var user;
    var imageName;
    if (userType == "Host" || userType == "Admin") {
        // User is Host or Admin, deliver image directly through host record
        var identifier = userID;
        if (userType == "Admin") {
            if (!hostID) {
                return res.status(400).send("ERROR: Host ID not provided.");
            }
            identifier = hostID;
        }

        try {
            user = await Host.findByPk(identifier);
            if (!user) {
                return res.status(404).send("ERROR: User not found.")
            }

            if (!user.paymentImage) {
                return res.status(200).send("SUCCESS: Host does not have a payment QR image yet.");
            }

            imageName = user.paymentImage;
        } catch (err) {
            Logger.log(`CDN GETHOSTPAYMENTQR ERROR: Failed to find host; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to process request.");
        }
    } else if (userType == "Guest") {
        // User is guest, find the listing with an associated host, and get the image from there
        if (!listingID) {
            return res.status(400).send("ERROR: Listing ID not provided.");
        }

        try {
            const listing = await FoodListing.findByPk(listingID, {
                include: [
                    {
                        model: Guest,
                        as: "guests",
                        where: { userID: userID }
                    },
                    {
                        model: Host,
                        as: "Host",
                        attributes: ["userID", "paymentImage"]
                    }
                ]
            });
            if (!listing || listing.guests.length == 0) {
                return res.status(404).send("ERROR: Listing not found.");
            } else if (Extensions.timeDiffInSeconds(new Date(), new Date(listing.datetime)) > 21600) {
                return res.status(400).send("ERROR: Payment QR image not available yet.")
            }

            if (!listing.Host.paymentImage) {
                return res.status(200).send("SUCCESS: Host does not have a payment QR image yet.");
            }
            
            imageName = listing.Host.paymentImage;
        } catch (err) {
            Logger.log(`CDN GETHOSTPAYMENTQR ERROR: Failed to find listing; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to process request.");
        }
    }

    const findPaymentQR = await FileManager.prepFile(imageName);
    if (!findPaymentQR.startsWith("SUCCESS")) {
        Logger.log(`CDN GETHOSTPAYMENTQR ERROR: Failed to find payment QR image; error: ${findPaymentQR}.`);
        res.status(400).send("ERROR: Failed to find payment QR image.");
        return;
    }
 
    return res.status(200).sendFile(findPaymentQR.substring("SUCCESS: File path: ".length));
})

module.exports = { router, at: '/cdn' };