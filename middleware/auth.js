const jwt = require('jsonwebtoken');
require('dotenv').config();

const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.error('No authorization header');
        return res.sendStatus(401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        console.error('No token found in authorization header');
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_KEY, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.sendStatus(403);
        }
        // console.log("Decoded this user: " + user)
        req.user = user;
        next();
    });
};

const checkUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.error('No authorization header');
        next();
        return
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        console.error('No token found in authorization header');
        next();
        return
    }

    jwt.verify(token, process.env.JWT_KEY, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.sendStatus(403);
        }
        // console.log("Decoded this user: " + user)
        req.user = user;
        next();
    });
}

module.exports = { validateToken, checkUser };