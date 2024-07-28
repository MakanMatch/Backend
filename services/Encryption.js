const bcrypt = require('bcrypt');

/**
 * Encryption class to perform encryption operations
 * 
 * @method hash: Hashes a string
 * @method compare: Compares a string with a hash
 * @method encodeToBase64: Encodes a string to base64
 * @method decodeFromBase64: Decodes a base64 string
 */
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