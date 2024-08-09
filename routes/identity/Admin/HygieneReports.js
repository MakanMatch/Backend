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

    var host;
    try {
        host = await Host.findByPk(hostID);
        if (!host) {
            return res.status(404).send("ERROR: Host not found");
        }
    } catch (err) {
        return res.status(500).send("ERROR: Failed to process request.");
    }

    if (host.hygieneGrade > 2.5) {
        return res.status(400).send("UERROR: Host need to have a rating below 2.5 for a warning to be issued");
    }

    if (host.hygieneGrade == 0) {
        return res.status(400).send("UERROR: Host does not have a review yet");
    }

    // Check if there is a previous warning and remove it
    try {
        const previousWarning = await Warning.findOne({
            where: {
                hostID: hostID
            }
        })

        if (previousWarning) {
            const removePreviousWarning = await previousWarning.destroy();
            if (!removePreviousWarning) {
                return res.status(500).send("ERROR: Failed to remove previous warning");
            }
        }
    } catch (err) {
        Logger.log(`ADMIN HYGIENEREPORTS ISSUEWARNING ERROR: Failed to remove previous warning for host with ID ${hostID}; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to process request.");
    }

    const datetime = new Date().toISOString();

    try {
        const issuedWarning = await Warning.create({
            reason: reason,
            issuingAdminID: issuingAdminID,
            hostID: hostID,
            datetime: datetime
        });
        if (!issuedWarning) {
            return res.status(500).send("ERROR: Failed to save warning");
        }

        host.flaggedForHygiene = true;
        const updateHostFlagged = await host.save();

        if (!updateHostFlagged) {
            return res.status(500).send("ERROR: Failed to update host's flagged status.");
        }
    } catch (err) {
        Logger.log(`ADMIN HYGIENEREPORTS ISSUEWARNING ERROR: Failed to issue warning to host with ID ${hostID}; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to process request.");
    }

    const emailText = `
        Dear ${host.fname} ${host.lname},

        Our system has detected that your hygiene grade has fallen below the acceptable standards.

        Your account has been flagged. Please take immediate action to improve your hygiene grade to avoid further action being taken against your account.

        ${reason}

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
                reason: reason
            }
        )
    )
        .catch((err) => {
            Logger.log(`ADMIN HYGIENEREPORTS ISSUEWARNING ERROR: Failed to send email to host with ID ${hostID}; error: ${err}.`);
        });

    return res.status(200).send("SUCCESS: Warning issued successfully");
});

router.post("/unflagHost", validateAdmin, async (req, res) => {
    const { hostID } = req.body;

    if (!hostID) {
        return res.status(400).send("UERROR: One or more required payloads missing");
    }

    try {
        const host = await Host.findByPk(hostID);
        if (!host) {
            return res.status(404).send("ERROR: Host not found");
        }

        host.flaggedForHygiene = false;
        const updateHostFlagged = await host.save();

        if (!updateHostFlagged) {
            return res.status(500).send("ERROR: Failed to update host's flagged status");
        }
    } catch (err) {
        Logger.log(`ADMIN HYGIENEREPORTS UNFLAGHOST ERROR: Failed to unflag host with ID ${hostID}; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to process request.");
    }

    // Remove the warning associated with the host
    try {
        const warning = await Warning.findOne({
            where: { hostID: hostID }
        });

        if (warning) {
            const removeWarning = await warning.destroy();
            if (!removeWarning) {
                return res.status(500).send("ERROR: Failed to remove warning");
            }
        }
    } catch (err) {
        Logger.log(`ADMIN HYGIENEREPORTS UNFLAGHOST ERROR: Failed to remove warning for host with ID ${hostID}; error: ${err}.`);
        return res.status(500).send("ERROR: Failed to process request.");
    }

    return res.status(200).send("SUCCESS: Host unflagged successfully");
});

module.exports = { router, at: '/admin/hygieneReports' };