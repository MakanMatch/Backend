const express = require('express')
const router = express.Router();

router.get("/listingDetails", (req, res) => {
    res.send({
        data: "toCome"
    })
})

module.exports = router;