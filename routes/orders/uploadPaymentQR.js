const express = require("express");
const router = express.Router();
const FileManager = require("../../services/FileManager");
const path = require('path')
const { FoodListing, Review, Host } = require("../../models");
const { storeFile } = require("../../middleware/storeFile");
const { validateToken } = require("../../middleware/auth");
const Logger = require("../../services/Logger");
const multer = require("multer");

router.route("/")
    .post(validateToken, async (req, res) => {
        storeFile(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const hostID = req.user.userID;

            if (!hostID) {
                return res.status(400).send("ERROR: Missing required fields");
            }
            
            try {
                var host = await Host.findByPk(hostID);
                if (!host) {
                    return res.status(404).send("ERROR: Listing or host not found.");
                }

                if (req.file) {
                    try {
                        const saveFile = await FileManager.saveFile(req.file.filename);
                        if (!saveFile) {
                            Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to save file.`);
                            return res.status(500).send("ERROR: Failed to save file");
                        }
                    } catch (err) {
                        Logger.log(`REVIEWS SUBMITREVIEW POST ERROR: Failed to upload file; error: ${err}.`);
                        return res.status(500).send("ERROR: Failed to upload file");
                    }
                }
            } catch (err) {
                Logger.log(`ORDERS UPLOADPAYMENT QR POST ERROR: Failed to upload file; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to upload file");
            }

            // Update Host Payment Image
            try {
                host.set({
                    paymentImage: req.file.filename
                });

                const updateHostPaymentImage = await host.save();
                
                if (!updateHostPaymentImage) {
                    return res.status(500).send("ERROR: Failed to update Host Payment Image");
                }

                return res.status(200).send("SUCCESS: Payment QR uploaded successfully");
            } catch (err) {
                Logger.log(`ORDERS UPLOADPAYMENT QR POST ERROR: Failed to upload Payment QR; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to upload Payment QR")
            }
        })
    })

module.exports = { router, at: '/orders/uploadPaymentQR' };