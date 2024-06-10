const bcrypt = require('bcrypt');

class Encryption {
    static async hash(data, saltRounds=10) {
        let hashed = await bcrypt.hash(data, saltRounds);
        return hashed;
    }

    static async compare(data, hash) {
        let result = await bcrypt.compare(data, hash);
        return result;
    }

    static encodeToBase64(data) {
        return Buffer.from(data).toString('base64')
    }

    static decodeFromBase64(data) {
        return Buffer.from(data, 'base64').toString('ascii');
    }
}

module.exports = Encryption;