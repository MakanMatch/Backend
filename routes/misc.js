const express = require('express');
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Hello from misc router!")
})

module.exports = router;