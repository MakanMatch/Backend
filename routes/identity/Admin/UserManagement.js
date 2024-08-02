const express = require("express");
const router = express.Router();
const { UserRecord } = require("../../../models");
const { validateToken } = require("../../../middleware/auth");
const { Op } = require("sequelize");
const Logger = require("../../../services/Logger");

router.post('/toggleBanUser', validateToken, async (req, res) => {
    const { userID } = req.body;

    if (req.user.userType !== 'Admin') {
        return res.status(403).send("ERROR: Access denied.");
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
            Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to toggle ban status for user with ID ${userID}`)
            res.status(500).send("ERROR: Failed to ban user");
        }

        Logger.log(`IDENTITY USERMANAGEMENT BANUSER: ${user.banned ? 'Banned' : 'Unbanned'} user with ID ${userID}`);
        res.status(200).json({ message: "SUCCESS: Ban status updated", banned: user.banned });
    } catch (err) {
        Logger.log(`IDENTITY USERMANAGEMENT BANUSER ERROR: Failed to toggle ban user with ID ${userID}; error: ${err}`)
        res.status(500).send("ERROR: Failed to update ban status");
    }
});

module.exports = { router, at: '/admin/userManagement' };