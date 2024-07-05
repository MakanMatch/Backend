const express = require('express');
const router = express.Router();
const { validateToken } = require('../../middleware/auth');

router.post('/logout', (req, res) => {
    // WORK IN PROGRESS
    console.log("User logged out.")
});



module.exports = { router, at: '/identity/myAccount' };