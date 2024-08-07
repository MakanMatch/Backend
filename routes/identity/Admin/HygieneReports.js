const express = require("express");
const router = express.Router();
const { UserRecord, Warning, Host } = require("../../../models");
const { validateToken, validateAdmin } = require("../../../middleware/auth");
const { Op } = require("sequelize");
const { Logger, Emailer, HTMLRenderer } = require("../../../services");
const path = require("path");

router.post('/issueWarning', validateAdmin, async (req, res) => {
    const { reason, hostID } = req.body;
    const issuingAdminID = req.user.userID;

    if (!hostID) {
        return res.status(400).send("UERROR: One or more required payloads missing");
    }

    const host = await Host.findByPk(hostID);
    if (!host) {
        return res.status(404).send("ERROR: Host not found");
    }

    host.flaggedForHygiene = true;
    const updateHostFlagged = await host.save();

    if (!updateHostFlagged) {
        return res.status(500).send("ERROR: Failed to update host's flagged status");
    }

    const emailText = `
        Dear ${host.fname} ${host.lname},

        Our system has detected that your hygiene grade has fallen below the acceptable standards.

        Your account has been flagged. Please take immediate action to improve your hygiene grade to avoid further action being taken against your account.

        This is a warning to inform you that your hygiene grade is currently at ${host.hygieneGrade}.

        Persistent failure to maintain a hygiene grade higher than 2.5 will result in your account being banned.

        To improve your hygiene grade, we suggest:
            - Cleaning your kitchen and dining area regularly
            - Ensuring all food is prepared and stored in a clean environment
            - Providing disposable cutlery if guests prefer so

        We hope you have a pleasant experience! Thank you for using MakanMatch.

        Best Regards,
        MakanMatch Team
    `

    Emailer.sendEmail(
        host.email,
        "[ACTION REQUIRED] Hygiene Warning | MakanMatch",
        emailText,
        HTMLRenderer.render(
            path.join("emails", "hygieneWarningReceived.html"),
            {
                hostName: `${host.fname} ${host.lname}`,
                hygieneGrade: `${host.hygieneGrade}`,
            }
        )
    )
    .catch((err) => {
        Logger.log(`ADMIN HYGIENEREPORTS ISSUEWARNING ERROR: Failed to send email to host with ID ${hostID}; error: ${err}.`);
    });

    return res.status(200).send("Warning issued successfully");
});

router.post("/unflagHost", validateAdmin, async (req, res) => {
    const { hostID } = req.body;

    if (!hostID) {
        return res.status(400).send("UERROR: One or more required payloads missing");
    }

    const host = await Host.findByPk(hostID);
    if (!host) {
        return res.status(404).send("ERROR: Host not found");
    }

    host.flaggedForHygiene = false;
    const updateHostFlagged = await host.save();

    if (!updateHostFlagged) {
        return res.status(500).send("ERROR: Failed to update host's flagged status");
    }

    return res.status(200).send("Host unflagged successfully");
});

module.exports = { router, at: '/admin/hygieneReports' };