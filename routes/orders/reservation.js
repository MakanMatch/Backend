const express = require('express')
const router = express.Router();
const { FoodListing } = require('../../models')

router.get("/listingDetails", (req, res) => {
    res.send({
        data: "toCome"
    })
})

module.exports = router;