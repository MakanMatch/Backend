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

router.post("/getReservation", validateToken, async (req, res) => {
    const guestID = req.user.userID;
    const { referenceNum, listingID } = req.body;

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
            return res.status(404).send("ERROR: Reservation not found.")
        }
    } catch (err) {
        Logger.log(`ORDERS CONFIRMRESERVATION GETRESERVATION ERROR: Failed to find reservation. Error: ${err}`)
        return res.send(400).send("ERROR: Failed to find reservation.")
    }

    var processedData = reservation.toJSON();
    if (processedData['markedPaid'] !== undefined) { delete processedData['markedPaid'] }
    if (processedData['paidAndPresent'] !== undefined) { delete processedData['paidAndPresent'] }

    return res.status(200).json(processedData)
})

router.get("/getReservations", validateToken, async (req, res) => {
    const guestID = req.user.userID;
    const includeListing = req.query.includeListing == 'true' ? true : false;
    const includeListingHost = req.query.includeListingHost == 'true' ? true: false;
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
                attributes: ["userID", "username", "foodRating", "fname", "lname"]
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

    const { portions } = req.body;
    if (!portions || typeof portions !== 'number' || portions <= 0) {
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
        totalPrice: totalPrice,
        portions: portions
    })
})

router.post("/cancelReservation", validateToken, async (req, res) => {
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
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to find reservation. Error: ${err}`)
        return res.send(400).send("ERROR: Failed to find reservation.")
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
        Logger.log(`ORDERS CONFIRMRESERVATION CANCELRESERVATION ERROR: Failed to find listing attached to reservation. Error: ${err}`)
        return res.status(500).send("ERROR: Unable to fulfill request, try again.")
    }

    if (Date(listing.datetime) < Date.now()) {
        return res.status(400).send("ERROR: Reservation has already passed.")
    } else if (Extensions.timeDiffInSeconds(new Date(), new Date(listing.datetime)) < 21600 && req.body.cancellationFeeAcknowledged !== true) {
        return res.status(400).send("UERROR: Cancellation fees apply for cancellations within 6 hours of the reservation time. Pay and acknowledge cancellation fee to proceed.")
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