const express = require("express");
const router = express.Router();
const FileManager = require("../../services/FileManager");
const { Host, Reservation } = require("../../models");
const { storeFile } = require("../../middleware/storeFile");
const { validateToken } = require("../../middleware/auth");
const Logger = require("../../services/Logger");
const multer = require("multer");

router.route("/uploadPaymentQR")
    .post(validateToken, async (req, res) => {
        storeFile(req, res, async (err) => {
            if (err instanceof multer.MulterError) {
                Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error");
            } else if (err) {
                Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Internal server error; error: ${err}.`);
                return res.status(500).send("ERROR: Internal server error");
            }

            const hostID = req.user.userID;

            var host;
            try {
                host = await Host.findByPk(hostID);
                if (!host) {
                    return res.status(404).send("ERROR: Host not found.");
                }
            } catch (err) {
                Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Failed to upload file; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to upload file");
            }

            if (req.file) {
                try {
                    const saveFile = await FileManager.saveFile(req.file.filename);
                    if (saveFile !== true) {
                        Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Failed to save file.`);
                        return res.status(500).send("ERROR: Failed to save file");
                    }
                } catch (err) {
                    Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Failed to upload file; error: ${err}.`);
                    return res.status(500).send("ERROR: Failed to upload file");
                }
            }

            //Delete host previous payment image
            if (host.paymentImage) {
                try {
                    const deletePreviousPaymentImage = await FileManager.deleteFile(host.paymentImage);
                    if (deletePreviousPaymentImage !== true) {
                        return res.status(500).send("ERROR: Failed to delete previous payment image.");
                    }
                } catch (err) {
                    Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Failed to delete previous payment image; error: ${err}.`);
                    return res.status(500).send("ERROR: Failed to delete previous payment image.");
                }
            }

            // Update Host Payment Image
            try {
                host.set({
                    paymentImage: req.file.filename
                });

                const updateHostPaymentImage = await host.save();

                if (!updateHostPaymentImage) {
                    return res.status(500).send("ERROR: Failed to update host payment image.");
                }

                return res.status(200).send("SUCCESS: Payment QR uploaded successfully. Image name: " + req.file.filename);
            } catch (err) {
                Logger.log(`ORDERS MANAGEGUESTS UPLOADPAYMENTQR POST ERROR: Failed to upload Payment QR; error: ${err}.`);
                return res.status(500).send("ERROR: Failed to upload Payment QR.")
            }
        })
    })

router.route("/togglePaidAndPresent")
    .put(validateToken, async (req, res) => {
        const userID = req.user.userID;
        const { referenceNum, listingID, guestID } = req.body;
        var identifierMode = null;
        if (!referenceNum) {
            if (!listingID) {
                return res.status(400).send("ERROR: Sufficient payloads not provided to identify reservation.")
            } else { identifierMode = 'FKIdentifiers' }
        } else { identifierMode = 'Reference' }

        let whereClause = {};
        if (identifierMode == 'Reference') { whereClause['referenceNum'] = referenceNum }
        else { whereClause['guestID'] = guestID, whereClause['listingID'] = listingID }

        var reservation;
        try {
            reservation = await Reservation.findOne({ where: whereClause })
            if (!reservation) {
                return res.status(404).send("ERROR: No reservation found.")
            }
        } catch (err) {
            Logger.log(`ORDERS MANAGEGUESTS TOGGLEPAIDANDPRESENT PUT ERROR: Failed to find reservation. Error: ${err}`)
            return res.send(400).send("ERROR: Failed to find reservation.")
        }

        try {
            if (reservation.paidAndPresent == true) {
                reservation.set({ paidAndPresent: false });
            }
            else {
                reservation.set({ paidAndPresent: true });
            }

            const updatePaidAndPresent = await reservation.save();

            if (!updatePaidAndPresent) {
                return res.status(500).send("ERROR: Failed to update paid and present status");
            }

            return res.status(200).json({ paidAndPresent: reservation.paidAndPresent });
        } catch (err) {
            Logger.log(`ORDERS MANAGEGUESTS TOGGLEPAIDANDPRESENT PUT ERROR: Failed to update paid and present status; error: ${err}.`);
            return res.status(500).send("ERROR: Failed to update paid and present status");
        }

    })

module.exports = { router, at: '/orders/manageGuests' };