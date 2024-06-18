const express = require('express');
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Reviews!")
    console.log("Reviews!")
})

module.exports = router;