const jwt = require('jsonwebtoken');
const Extensions = require('./Extensions');

/**
 * Adapted from https://gist.github.com/ziluvatar/a3feb505c4c0ec37059054537b38fc48
 */
class TokenManager {
    constructor(secretKey, refreshWindowInSeconds, options) {
        this.secretKey = secretKey;
        this.refreshWindow = refreshWindowInSeconds
        this.options = options; // algorithm + keyid + noTimestamp + expiresIn + notBefore
    }
    sign(payload) {
        const jwtSignOptions = Object.assign({}, this.options);
        console.log(jwtSignOptions);
        return jwt.sign(payload, this.secretKey, jwtSignOptions);
    }
    verify(token, autoRefresh=false, complete=false) {
        const payload = jwt.verify(token, this.secretKey, { complete });

        if (autoRefresh && Extensions.timeDiffInSeconds(new Date(), new Date(payload.exp * 1000)) < this.refreshWindow) {
            const refreshedToken = this.refresh(token, payload);
            return {
                payload: jwt.verify(refreshedToken, this.secretKey, { complete }),
                token: refreshedToken,
                refreshed: true
            };
        }
        
        return { payload, token, refreshed: false };
    }
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
        return new TokenManager(process.env.JWT_KEY, 60 * 10 , { expiresIn: '24h' });
    }
}

// Default configuration
module.exports = TokenManager;