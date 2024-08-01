const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Superuser API");
});

module.exports = { router, at: '/admin/superuserAPI' };