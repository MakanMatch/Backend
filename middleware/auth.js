const jwt = require('jsonwebtoken');
const Logger = require('../services/Logger');
const TokenManager = require('../services/TokenManager');
const { UserRecord } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();

const validateToken = async (req, res, next) => {
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
            if (process.env.DEBUG_MODE == "True") {
                Logger.log(`AUTH VALIDATETOKEN: Token expired.`);
            }
            return res.status(403).send("ERROR: Token expired. Please request new token.");
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${err}`);
            return res.status(403).send("ERROR: Failed to verify token.");
        }
    }

    // Verify user existence
    const record = await UserRecord.findOne({ where: {
        [Op.or]: [
            { gID: payload.userID },
            { hID: payload.userID },
            { aID: payload.userID },
        ]
    }});
    if (!record) {
        return res.status(404).send("ERROR: User does not exist.");
    }
    // Check if user is banned
    if (record.banned === true) {
        return res.status(403).send("ERROR: User is banned.");
    }

    // Populate request with user information
    req.user = payload;
    if (refreshed) {
        // Inform client of new token so that they can replace through RefreshedToken header
        Logger.log(`AUTH VALIDATETOKEN: Token refreshed for user with ID ${req.user.userID || "NOTFOUND"}.`);
        res.setHeader('refreshedtoken', latestToken);
    }

    // Continue to next middleware
    next();
};

const checkUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        next();
        return
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        next();
        return
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
            if (process.env.DEBUG_MODE == "True") {
                Logger.log(`AUTH VALIDATETOKEN: Token expired.`);
            }
            return res.status(403).send("ERROR: Token expired. Please request new token.");
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${err}`);
            return res.status(403).send("ERROR: Failed to verify token.");
        }
    }

    // Verify user existence
    const record = await UserRecord.findOne({ where: {
        [Op.or]: [
            { gID: payload.userID },
            { hID: payload.userID },
            { aID: payload.userID },
        ]
    }});
    if (!record) {
        return res.status(404).send("ERROR: User does not exist.");
    }
    // Check if user is banned
    if (record.banned === true) {
        return res.status(403).send("ERROR: User is banned.");
    }

    // Populate request with user information
    req.user = payload;
    if (refreshed) {
        // Inform client of new token so that they can replace through RefreshedToken header
        Logger.log(`AUTH VALIDATETOKEN: Token refreshed for user with ID ${req.user.userID || "NOTFOUND"}.`);
        res.setHeader('refreshedtoken', latestToken);
    }

    // Continue to next middleware
    next();
}

const validateAdmin = async (req, res, next) => {
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
            if (process.env.DEBUG_MODE == "True") {
                Logger.log(`AUTH VALIDATETOKEN: Token expired.`);
            }
            return res.status(403).send("ERROR: Token expired. Please request new token.");
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${err}`);
            return res.status(403).send("ERROR: Failed to verify token.");
        }
    }

    if (payload.userType !== "Admin") {
        return res.status(403).send("ERROR: Access denied.")
    }

    // Verify user existence
    const record = await UserRecord.findOne({ where: {
        [Op.or]: [
            { gID: payload.userID },
            { hID: payload.userID },
            { aID: payload.userID },
        ]
    }});
    if (!record) {
        return res.status(404).send("ERROR: User does not exist.");
    }
    if (!record.aID) {
        return res.status(403).send("ERROR: Access denied.")
    }

    // Populate request with user information
    req.user = payload;
    if (refreshed) {
        // Inform client of new token so that they can replace through RefreshedToken header
        Logger.log(`AUTH VALIDATETOKEN: Token refreshed for user with ID ${req.user.userID || "NOTFOUND"}.`);
        res.setHeader('refreshedtoken', latestToken);
    }

    // Continue to next middleware
    next();
};

module.exports = { validateToken, checkUser, validateAdmin };