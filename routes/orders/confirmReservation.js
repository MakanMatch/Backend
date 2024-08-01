const express = require('express');
const { validateToken } = require('../../middleware/auth');
const { FoodListing, Guest, Reservation, Host } = require('../../models');
const Logger = require('../../services/Logger');
const Universal = require('../../services/Universal');
const yup = require('yup');
const { Op } = require('sequelize');
const { Extensions } = require('../../services');
const router = express.Router();

router.post("/createReservation", validateToken, async (req, res) => {
    const guestID = req.user.userID;
    var { listingID, portions } = req.body;
    if (!listingID || !portions) {
        return res.status(400).send("ERROR: One or more payloads not provided.")
    }
    portions = parseInt(portions)
    if (portions == NaN || portions <= 0) {
        return res.status(400).send("ERROR: Invalid portions value.")
    }

    const listing = await FoodListing.findByPk(listingID, {
        include: [{
            model: Guest,
            as: "guests"
        }]
    })
    if (!listing || listing == null) {
        return res.status(400).send("ERROR: Listing does not exist.")
    }
    if (listing.published !== true) {
        return res.status(400).send("UERROR: The listing is not currently accepting reservations.")
    }
    if (listing.hostID == guestID) {
        return res.status(400).send("UERROR: You cannot make a reservation for your own listing.")
    }

    const guest = await Guest.findByPk(guestID)
    if (!guest || guest == null) {
        return res.status(400).send("ERROR: Guest does not exist.")
    }

    var reservationAlreadyMade = false;
    for (const res of listing.guests) {
        if (res.userID == guestID) {
            reservationAlreadyMade = true;
            break;
        }
    }
    if (reservationAlreadyMade) {
        return res.status(400).send("UERROR: You have already made a reservation for this listing.")
    }

    var portionsTaken = 0;
    for (const guest of listing.guests) {
        if (guest.userID != guestID) {
            portionsTaken += guest.Reservation.portions
        }
    }
    if (portions > (listing.totalSlots - portionsTaken)) {
        return res.status(400).send("UERROR: Not enough portions available.")
    }

    const allReservationReferences = (await Reservation.findAll({ attributes: ['referenceNum'] })).map(r => r.referenceNum)

    const totalPrice = portions * listing.portionPrice
    const reservation = await Reservation.create({
        guestID: guestID,
        listingID: listingID,
        referenceNum: Universal.generateUniqueID(6, allReservationReferences).toUpperCase(),
        datetime: new Date().toISOString(),
        portions: portions,
        totalPrice: totalPrice,
        markedPaid: false,
        paidAndPresent: false
    })
    if (!reservation) {
        Logger.log(`ORDERS CONFIRMRESERVATION CREATERESERVATION ERROR: Failed to make reservation for guest ${guestID} for listing ${listingID}. Sequelize create response: ${reservation}`)
        return res.status(500).send("ERROR: Failed to create reservation.")
    }

    Logger.log(`ORDERS CONFIRMRESERVATION CREATERESERVATION: Guest ${guestID} made reservation for listing ${listingID}.`)
    return res.status(200).json({
        message: "SUCCESS: Reservation made successfully.",
        listingID: listingID,
        referenceNum: reservation.referenceNum,
        totalPrice: totalPrice,
        portions: portions
    })
})

router.get("/getReservations", validateToken, async (req, res) => {
    const guestID = req.user.userID;
    const includeListing = req.query.includeListing == 'true' ? true : false;
    const includeListingHost = req.query.includeListingHost == 'true' ? true : false;
    const includeListingReservations = req.query.includeListingReservations == 'true' ? true : false;

    var reservationsJSON;
    try {
        const reservations = await Reservation.findAll({
            where: { guestID: guestID }
        })
        if (!reservations || reservations.length == 0) {
            return res.send([])
        }

        reservationsJSON = reservations.map(r => r.toJSON())
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION GETRESERVATIONS ERROR: Failed to find reservations for user ${guestID}. Error: ${err}`)
        return res.status(500).send("ERROR: Failed to process request.")
    }

    if (includeListing) {
        var includeClause = [];
        if (includeListingHost) {
            includeClause.push({
                model: Host,
                as: "Host",
                attributes: ["userID", "username", "foodRating", "fname", "lname", "paymentImage"]
            })
        }
        if (includeListingReservations) {
            includeClause.push({
                model: Guest,
                as: "guests",
                attributes: ["userID", "username", "fname", "lname"],
                through: {
                    model: Reservation,
                    as: "Reservation",
                    attributes: ["portions", "totalPrice", "datetime"]
                }
            })
        }

        try {
            const listingIDs = reservationsJSON.map(r => r.listingID)
            const listings = await FoodListing.findAll({
                where: {
                    listingID: {
                        [Op.in]: listingIDs
                    }
                },
                include: includeClause
            })

            reservationsJSON = reservationsJSON.map(r => {
                const listing = listings.find(l => l.listingID == r.listingID)
                const listingJSON = listing.toJSON();
                listing.images = listing.images ? listing.images.split("|") : []

                if (listing) {
                    r['listing'] = listing;
                }
                return r
            })
        } catch (err) {
            Logger.log(`ORDERS CONFIRMRESERVATION GETRESERVATIONS ERROR: Failed to find listings for reservations for user ${guestID}. Error: ${err}`)
            return res.status(500).send("ERROR: Failed to process request.")
        }
    }

    return res.status(200).json(reservationsJSON)
})

router.put("/updateReservation", validateToken, async (req, res) => {
    const userID = req.user.userID;
    const { referenceNum, listingID } = req.body;
    var identifierMode = null;
    if (!referenceNum) {
        if (!listingID) {
            return res.status(400).send("ERROR: Sufficient payloads not provided to identify reservation.")
        } else { identifierMode = 'FKIdentifiers' }
    } else { identifierMode = 'Reference' }

    let whereClause = {};
    if (identifierMode == 'Reference') { whereClause['referenceNum'] = referenceNum }
    else { whereClause['guestID'] = userID, whereClause['listingID'] = listingID }

    var reservation;
    try {
        reservation = await Reservation.findOne({ where: whereClause })
        if (!reservation) {
            return res.status(404).send("ERROR: No reservation found.")
        }
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION GETRESERVATION ERROR: Failed to find reservation. Error: ${err}`)
        return res.send(400).send("ERROR: Failed to find reservation.")
    }

    if (Date(reservation.datetime) < Date.now()) {
        return res.status(400).send("ERROR: Reservation has already passed.")
    }

    var listing;
    try {
        listing = await FoodListing.findByPk(reservation.listingID, {
            include: [{
                model: Guest,
                as: "guests"
            }]
        })
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION UPDATERESERVATION ERROR: Failed to find listing attached to reservation. Error: ${err}`)
        return res.status(500).send("ERROR: Unable to fulfill request, try again.")
    }

    if (listing.published !== true) {
        return res.status(400).send("UERROR: The listing is not currently accepting reservations.")
    }

    const { portions, markedPaid } = req.body;
    if (portions) {
        if (typeof portions !== 'number' || portions <= 0) {
            return res.status(400).send("ERROR: Invalid payload.")
        }

        var portionsTaken = 0;
        for (const guest of listing.guests) {
            if (guest.userID != userID) {
                portionsTaken += guest.Reservation.portions
            }
        }
        if (portions > (listing.totalSlots - portionsTaken)) {
            return res.status(400).send("UERROR: Not enough portions available.")
        }

        const totalPrice = portions * listing.portionPrice
        reservation.portions = portions
        reservation.totalPrice = totalPrice
    }

    if (markedPaid !== undefined) {
        if (typeof markedPaid !== 'boolean') {
            return res.status(400).send("ERROR: Invalid payload.")
        }

        reservation.markedPaid = markedPaid
    }

    if (!reservation.changed()) {
        return res.status(200).send("SUCCESS: Nothing to update.")
    }

    try {
        await reservation.save()
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION UPDATERESERVATION ERROR: Failed to update reservation. Error: ${err}`)
        return res.status(500).send("ERROR: Unable to fulfill request, try again.")
    }

    Logger.log(`ORDERS CONFIRMRESERVATION UPDATERESERVATION: Reservation ${reservation.referenceNum} updated by guest ${userID}.`)
    return res.status(200).json({
        message: "SUCCESS: Reservation updated successfully.",
        listingID: listingID,
        referenceNum: reservation.referenceNum,
        totalPrice: reservation.totalPrice,
        portions: reservation.portions,
        markedPaid: reservation.markedPaid
    })
})

router.post("/cancelReservation", validateToken, async (req, res) => {
    const userID = req.user.userID;
    const isHost = req.user.userType == "Host";
    const { referenceNum, listingID, guestID } = req.body;

    var identifierMode = null;
    if (!referenceNum) {
        if (!listingID) {
            return res.status(400).send("ERROR: Sufficient payloads not provided to identify reservation.")
        } else {
            if (isHost && (!guestID || typeof guestID !== "string")) {
                return res.status(400).send("ERROR: Sufficient payloads not provided to identify reservation.")
            } else {
                identifierMode = 'FKIdentifiers'
            }
        }
    } else { identifierMode = 'Reference' }

    let whereClause = {};
    if (identifierMode == 'Reference') { whereClause['referenceNum'] = referenceNum }
    else { whereClause['guestID'] = isHost ? guestID : userID, whereClause['listingID'] = listingID }

    var reservation;
    var listing;
    try {
        if (isHost) {
            if (identifierMode == 'FKIdentifiers') {
                listing = await FoodListing.findByPk(listingID, {
                    where: {
                        userID: userID
                    },
                    include: [{
                        model: Guest,
                        as: "guests"
                    }]
                })

                if (!listing) {
                    return res.status(404).send("ERROR: No such listing found.")
                }

                const targetGuest = listing.guests.find(g => g.userID == userID)
                if (!targetGuest) {
                    return res.status(404).send("ERROR: No such guest found.")
                }

                reservation = targetGuest.Reservation;
            } else {
                reservation = await Reservation.findOne({ where: whereClause })
            }
        } else {
            reservation = await Reservation.findOne({ where: whereClause })
        }

        if (!reservation) {
            return res.status(404).send("ERROR: No reservation found.")
        }
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to find reservation. Error: ${err}`)
        return res.status(400).send("ERROR: Failed to find reservation.")
    }

    if (isHost) {
        if (reservation.markedPaid == true) {
            return res.status(400).send("UERROR: Guest has already paid for this reservation. Contact guest to cancel.")
        }

        try {
            const reservationCopy = structuredClone(reservation.toJSON());
            await reservation.destroy();

            if (reservationCopy.chargeableCancelActive == true) {
                // Notify guest of cancellation
            }

            Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION: Reservation ${reservation.referenceNum} for listing ${listingID} cancelled by host ${userID}.`)
            return res.status(200).send("SUCCESS: Reservation cancelled successfully.")
        } catch (err) {
            Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to cancel reservation with reference number ${reservation.referenceNum}; error: ${err}`)
            return res.status(500).send("ERROR: Unable to fulfill request, try again.")
        }
    }

    try {
        listing = await FoodListing.findByPk(reservation.listingID, {
            include: [{
                model: Guest,
                as: "guests"
            }]
        })
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to find listing attached to reservation. Error: ${err}`)
        return res.status(500).send("ERROR: Unable to fulfill request, try again.")
    }

    console.log(listing.datetime, new Date().toISOString());
    if (new Date(listing.datetime) < new Date()) {
        return res.status(400).send("ERROR: Reservation has already passed.")
    }

    if (reservation.chargeableCancelActive == true) {
        return res.status(400).send("UERROR: Cancellation fee has already been acknowledged for this reservation. Await host confirmation.")
    }

    if (Extensions.timeDiffInSeconds(new Date(), new Date(listing.datetime)) < 21600) {
        // Attempting within six hour cancellation window

        if (req.body.cancellationFeeAcknowledged !== true) {
            return res.status(400).send("UERROR: Cancellation fees apply for cancellations within 6 hours of the reservation time. Pay and acknowledge cancellation fee to proceed.")
        } else {
            // Set chargeableCancelActive to true. The host needs to acknowledge the cancellation fee before the reservation can be cancelled.
            reservation.chargeableCancelActive = true;
            try {
                const saveResult = await reservation.save();
                if (!saveResult) {
                    return res.status(500).send("ERROR: Unable to fulfill request, try again.")
                }

                Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION: Cancellation fee acknowledged for reservation ${reservation.referenceNum} by guest ${userID}.`)
                return res.status(200).send("SUCCESS: Cancellation fee acknowledged. Await cancellation fee confirmation from host.")
            } catch (err) {
                Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to set chargeableCancelActive to true for reservation with reference number ${reservation.referenceNum}; error: ${err}`)
                return res.status(500).send("ERROR: Unable to fulfill request, try again.")
            }
        }
    }

    try {
        await reservation.destroy();
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION: Reservation ${reservation.referenceNum} for listing ${listing.listingID} cancelled by guest ${userID}.`)
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to cancel reservation with reference number ${reservation.referenceNum}; error: ${err}`)
        return res.status(500).send("ERROR: Unable to fulfill request, try again.")
    }

    res.status(200).send("SUCCESS: Reservation cancelled successfully.")
})

module.exports = { router }