const express = require('express');
const { validateToken } = require('../../middleware/auth');
const { FoodListing, Guest, Reservation } = require('../../models');
const Logger = require('../../services/Logger');
const Universal = require('../../services/Universal');
const router = express.Router();

router.post("/createReservation", validateToken, async (req, res) => {
    const guestID = req.user.userID;
    const { listingID, portions } = req.body;
    if (!listingID || !portions) {
        return res.status(400).send("ERROR: One or more payloads not provided.")
    } else if (typeof portions !== 'number' || portions <= 0) {
        return res.status(400).send("ERROR: Payloads must be in the right format.")
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

    const slotsTaken = listing.guests.length;
    if ((listing.totalSlots - slotsTaken) < portions) {
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

router.get("/getReservation", async (req, res) => {
    const { referenceNum, guestID, listingID } = req.body;
    var identifierMode = null;
    if (!referenceNum) {
        if (!guestID || !listingID) {
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
    if (processedData['markedPaid']) { delete processedData['markedPaid'] }
    if (processedData['paidAndPresent']) { delete processedData['paidAndPresent'] }

    return res.status(200).json(processedData)
})

module.exports = { router }