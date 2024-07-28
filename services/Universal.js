const { v4: uuidv4 } = require('uuid');

/**
 * Universal class to store standardised data and functions.
 * 
 * @var data: Object - Data store
 * @var booted: boolean - Whether the class has been booted
 * @method generateUniqueID: Generate a unique ID. Default generation is with `uuid`. Provide custom length to generate a custom length ID. Provide an array of IDs to avoid in the `notIn` parameter (recommended if specifying custom length).
 */
class Universal {
    static data = {};
    static booted = false;
    
    static generateUniqueID(customLength=0, notIn=[]) {
        if (customLength == 0) {
            return uuidv4();
        } else {
            let id = ''
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            while (id.length == 0 || (notIn.length != 0 && notIn.includes(id))) {
                id = '';
                for (let i = 0; i < customLength; i++) {
                    id += characters.charAt(Math.floor(Math.random() * characters.length));
                }
            }

            return id;
        }
    }
}

module.exports = Universal;