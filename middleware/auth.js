const jwt = require('jsonwebtoken');
const Logger = require('../services/Logger');
const TokenManager = require('../services/TokenManager');
require('dotenv').config();

const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send("ERROR: No authorization header found.");
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send("ERROR: No authorization token found.");
    }

    const tokenManager = TokenManager.default();
    var payload;
    var latestToken;
    var refreshed = false;
    try {
        const verification = tokenManager.verify(token, true);
        payload = verification.payload;
        latestToken = verification.token;
        refreshed = verification.refreshed;
    } catch (err) {
        if (err.name == "TokenExpiredError") {
            return res.status(403).send("ERROR: Token expired. Please request new token.");
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${err}`);
            return res.status(403).send("ERROR: Failed to verify token.");
        }
    }

    req.user = payload;
    if (refreshed) {
        // Inform client of new token so that they can replace
        Logger.log(`AUTH VALIDATETOKEN: Token refreshed for user with ID ${req.user.userID || "NOTFOUND"}.`);
        res.setHeader('RefreshedToken', latestToken); // THIS IS THE PROBLEM
    }

    next();
};
module.exports = { validateToken };