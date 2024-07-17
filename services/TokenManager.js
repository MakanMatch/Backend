const jwt = require('jsonwebtoken');
const Extensions = require('./Extensions');

/**
 * Adapted from https://gist.github.com/ziluvatar/a3feb505c4c0ec37059054537b38fc48
 */
class TokenManager {
    // Initialise a TokenManager with a secret key, a refresh window in seconds, and options for the JWT
    constructor(secretKey, refreshWindowInSeconds, options) {
        this.secretKey = secretKey;
        this.refreshWindow = refreshWindowInSeconds
        this.options = options; // algorithm + keyid + noTimestamp + expiresIn + notBefore
    }

    // Sign and generate a JWT with the payload
    sign(payload) {
        const jwtSignOptions = Object.assign({}, this.options);
        return jwt.sign(payload, this.secretKey, jwtSignOptions);
    }

    // Verify a JWT, optionally refreshing it if it is within the configured refresh window
    verify(token, autoRefresh=false, complete=false) {
        const payload = jwt.verify(token, this.secretKey, { complete });

        if (autoRefresh && Extensions.timeDiffInSeconds(new Date(), new Date(payload.exp * 1000)) < this.refreshWindow) {
            // Token is within the refresh window, call refresh method to get a new token
            const refreshedToken = this.refresh(token, payload);

            return {
                payload: jwt.verify(refreshedToken, this.secretKey, { complete }),
                token: refreshedToken,
                refreshed: true
            };
        }

        return { payload, token, refreshed: false };
    }

    // Refresh a JWT
    refresh(token, loadedPayload=null) {
        const payload = loadedPayload || jwt.verify(token, this.secretKey);
        delete payload.iat;
        delete payload.exp;
        delete payload.nbf;
        delete payload.jti;
        const jwtSignOptions = Object.assign({}, this.options);
        return jwt.sign(payload, this.secretKey, jwtSignOptions);
    }

    static default() {
        return new TokenManager(process.env.JWT_KEY, 60 * 10, { expiresIn: '1h' });
    }
}

// Default configuration
module.exports = TokenManager;