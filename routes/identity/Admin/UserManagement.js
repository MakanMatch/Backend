const express = require("express");
const router = express.Router();
const { UserRecord } = require("../../../models");
const { validateToken } = require("../../../middleware/auth");
const { Op } = require("sequelize");
const Logger = require("../../../services/Logger");

router.post('/banUser', validateToken, async (req, res) => {
    const { userID } = req.body;

    if (req.user.userType !== 'Admin') {
        return res.status(403).send("UERROR: Unauthorised Access");
    }

    try {
        // Find the user
        user = await UserRecord.findOne({
            where: {
                [Op.or]: [
                    { hID: userID },
                    { gID: userID },
                    { aID: userID }
                ]
            }
        })

        user.banned = !user.banned;
        const saveUser = await user.save();

        if (!saveUser) {
            Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to ban user with ID ${userID}`)
            res.status(500).send("ERROR: Failed to ban user");
        }

        Logger.log(`IDENTITY USERMANAGEMENT BANUSER: Banned user with ID ${userID}`)
        res.status(200).json({ message: "SUCCESS: Banned user", banned: user.banned });
    } catch (err) {
        console.log(err)
        Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to ban user with ID ${userID}; error: ${err}`)
        res.status(500).send("ERROR: Failed to ban user");
    }
});

router.get("/fetchBanState", validateToken, async (req, res) => {
    const { userID } = req.query;
    
    if (req.user.userType !== 'Admin') {
        return res.status(403).send("UERROR: Unauthorised Access");
    }

    try {
        // Find the user
        user = await UserRecord.findOne({
            where: {
                [Op.or]: [
                    { hID: userID },
                    { gID: userID },
                    { aID: userID }
                ]
            }
        })

        res.status(200).json({ banned: user.banned });
    } catch (err) {
        console.log(err)
        res.status(500).send("ERROR: Failed to ban user");
    }
});

module.exports = { router, at: '/admin/userManagement' };