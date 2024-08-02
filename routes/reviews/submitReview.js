const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileManager = require('../../services/FileManager');
const { Universal, Emailer, HTMLRenderer, Extensions } = require("../../services")
const { storeImages } = require("../../middleware/storeImages");
const { Review, Host, Guest } = require('../../models');
const Logger = require('../../services/Logger');
const { validateToken } = require('../../middleware/auth');
const path = require('path');

router.route("/")
    .post(validateToken, async (req, res) => {
        storeImages(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const guestID = req.user.userID;

            const { foodRating, hygieneRating, comments, dateCreated, hostID } = req.body;

            if (!foodRating || !hygieneRating || !dateCreated || !hostID) {
                return res.status(400).send("ERROR: Missing required fields");
            }

            if (guestID == hostID) {
                return res.status(400).send("UERROR: You cannot create a review for yourself.");
            }

            try {
                const host = await Host.findByPk(hostID)
                const guest = await Guest.findByPk(guestID)
                if (!host || !guest) {
                    return res.status(404).send("ERROR: Host or guest not found.");
                }

                const latestReview = await Review.findAll({
                    include: [
                        {
                            model: Guest,
                            as: "reviewPoster",
                            where: {
                                userID: guestID
                            }
                        }
                    ],
                    order: [["createdAt", "DESC"]]
                })
                if (latestReview && Array.isArray(latestReview) && latestReview.length > 0) {
                    if (Extensions.timeDiffInSeconds(latestReview[0].createdAt, new Date()) < 60) {
                        return res.status(400).send("UERROR: You can only submit a review once per minute.");
                    }
                }

                const fileUrls = [];
                if (req.files) {
                    for (const file of req.files) {
                        try {
                            const saveFile = await FileManager.saveFile(file.filename);
                            if (saveFile == true) {
                                fileUrls.push(`${file.filename}`);
                            } else {
                                return res.status(500).send("ERROR: Failed to upload file");
                            }
                        } catch (err) {
                            Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to upload file; error: ${err}.`);
                            return res.status(500).send("ERROR: Failed to upload file");
                        }
                    }
                }
                const fileUrlsString = fileUrls.length != 0 ? fileUrls.join("|"): null;

                const reviewID = Universal.generateUniqueID();

                const review = {
                    reviewID: reviewID,
                    foodRating: foodRating,
                    hygieneRating: hygieneRating,
                    comments: (comments && typeof comments == "string") ? comments.trim() : "",
                    images: fileUrlsString,
                    dateCreated: dateCreated,
                    guestID: guestID,
                    hostID: hostID
                };

                // Check review count for host. Will count the just created review.
                const prevReviewCount = await Review.count({
                    where: { hostID: hostID }
                });
    
                if (prevReviewCount == null || prevReviewCount == undefined || isNaN(prevReviewCount)) {
                    Logger.log(`REVIEWS MANAGEREVIEWS PUT ERROR: Review count for host with ID ${hostID} could not be obtained.`)
                    return res.status(500).send(`ERROR: Failed to process request.`);
                }

                const reviewCreation = await Review.create(review);
                if (!reviewCreation) {
                    return res.status(500).send("ERROR: Failed to create review.");
                }

                // Update Host Food Rating
                var newHostFoodRating = ((parseFloat(host.foodRating) * prevReviewCount) + parseFloat(foodRating)) / (prevReviewCount + 1);
                var newHostHygieneRating = ((parseFloat(host.hygieneGrade) * prevReviewCount) + parseFloat(hygieneRating)) / (prevReviewCount + 1);

                host.set(
                    {
                        foodRating: newHostFoodRating.toFixed(2),
                        hygieneGrade: newHostHygieneRating.toFixed(2),
                        reviewsCount: prevReviewCount + 1,
                    }
                );

                const updateHostRating = await host.save();

                if (!updateHostRating) {
                    return res.status(500).send("ERROR: Failed to update host food rating and hygiene rating.");
                }

                // Send Email to host about new review received
                const emailText = `
                    Dear ${host.firstName} ${host.lastName},

                    You have received a new review from ${guest.firstName} ${guest.lastName}.

                    Please login to your account to view the review that you've received.

                    To locate the Makan Reviews page, follow these steps:
                    1. Login to your account
                    2. Click on your profile picture located in the top right corner of the page to access your account.
                    3.Navigate to the "Makan Reviews" tab in the sidebar to view all the reviews you have received.

                    Alternatively, you can directly access your reviews by clicking or copy this link to your browser this link: "http://localhost:8500/reviews?hostID=${hostID}"

                    We hope you have a pleasant experience! Thank you for using MakanMatch.

                    Best Regards,
                    MakanMatch Team
                `

                Emailer.sendEmail(
                    host.email,
                    "Review Received | MakanMatch",
                    emailText,
                    HTMLRenderer.render(
                        path.join("emails", "ReviewReceived.html"),
                        {
                            hostName: `${host.fname} ${host.lname}`,
                            guestName: `${guest.fname} ${guest.lname}`,
                            hostID: hostID
                        }
                    )
                )
                .catch((err) => {
                    Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to send email to host with ID ${hostID}; error: ${err}.`);
                });
                return res.send("SUCCESS: Review submitted successfully");
            } catch (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to submit review; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to submit review");
            }
        });
    });

module.exports = { router, at: '/submitReview' };
