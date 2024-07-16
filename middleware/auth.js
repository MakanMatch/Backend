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

    // Initialise a default TokenManager instance
    const tokenManager = TokenManager.default();

    var payload;
    var latestToken;
    var refreshed = false;
    try {
        // Get TokenManager to verify the token and also refresh it if necessary
        const verification = tokenManager.verify(token, true);
        payload = verification.payload;
        latestToken = verification.token;
        refreshed = verification.refreshed;
    } catch (err) {
        // Handle token verification/refreshing errors
        if (err.name == "TokenExpiredError") {
            return res.status(403).send("ERROR: Token expired. Please request new token.");
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${err}`);
            return res.status(403).send("ERROR: Failed to verify token.");
        }
    }

    // Populate request with user information
    req.user = payload;
    if (refreshed) {
        // Inform client of new token so that they can replace through RefreshedToken header
        Logger.log(`AUTH VALIDATETOKEN: Token refreshed for user with ID ${req.user.userID || "NOTFOUND"}.`);
        res.setHeader('RefreshedToken', latestToken); // THIS IS THE PROBLEM
    }

    // Continue to next middleware
    next();
};
module.exports = { validateToken };