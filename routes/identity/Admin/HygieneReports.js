const express = require("express");
const router = express.Router();
const { UserRecord } = require("../../../models");
const { validateToken } = require("../../../middleware/auth");
const { Op } = require("sequelize");
const Logger = require("../../../services/Logger");

// router.post('/issueWarning', validateToken, async (req, res) => {
//     const hostID = req.body.hostID;

//     if (req.user.userType !== 'Admin') {
//         return res.status(403).send("UERROR: Unauthorised Access");
//     }


// });

module.exports = { router, at: '/admin/hygieneReports' };