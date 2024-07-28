const admin = require('firebase-admin');
var serviceAccount;
require('dotenv').config()

/**
 * FireStorage class providing low-level interaction with Firebase Cloud Storage with `firebase-admin` module
 * 
 * To use this class, you must have a `serviceAccountKey.json` file in the root folder
 * 
 * To initialize the class, call the `initialize()` method. This must be done before any other operation.
 * 
 * @method checkPermission: Checks if the operation is allowed
 * @method initialize: Initializes the FireStorage class
 * @method uploadFile: Uploads a file to the storage
 * @method downloadFile: Downloads a file from the storage
 * @method deleteFile: Deletes a file from the storage
 * @method deleteAll: Deletes all files from the storage
 * @method fileExistsAt: Checks if a file exists at the specified path in cloud storage
 * @method getMetadata: Gets the metadata of a file in cloud storage
 * @method listFiles: Lists all files in cloud storage
 * @method generateSignedUrl: Generates a signed URL for a file in cloud storage
 */
class FireStorage {
    /**
     * @type {import('@google-cloud/storage').Bucket}
     */
    static #bucket = null;
    static #initialized = false;

    static checkPermission() {
        return process.env.FIRESTORAGE_ENABLED === "True"
    }

    static initialize() {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        try { serviceAccount = require('../serviceAccountKey.json') } catch (err) { throw new Error("FIRESTORAGE ERROR: serviceAccountKey.json not found.") }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.STORAGE_BUCKET_URL
        });
        FireStorage.#bucket = admin.storage().bucket();
        FireStorage.#initialized = true;
        return true;
    }

    static async uploadFile(filePath, destinationPath = null) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        if (!destinationPath) {
            destinationPath = filePath;
        }
        try {
            await this.#bucket.upload(filePath, {
                destination: destinationPath
            });
            return true;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async downloadFile(sourcePath, destinationPath = null) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        if (!destinationPath) {
            destinationPath = sourcePath;
        }
        try {
            await this.#bucket.file(sourcePath).download({
                destination: destinationPath
            });
            return true;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async deleteFile(filePath) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            await this.#bucket.file(filePath).delete();
            return true;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async deleteAll() {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }

        try {
            await this.#bucket.deleteFiles({ force: true });
            return true;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async fileExistsAt(filePath) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            const [fileExists] = await this.#bucket.file(filePath).exists();
            return fileExists;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async getMetadata(filePath) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            const [metadata] = await this.#bucket.file(filePath).getMetadata();
            return metadata;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async listFiles() {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            const [files] = await this.#bucket.getFiles();
            const fileNames = files.map(file => file.name);
            return fileNames;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async generateSignedUrl(filePath, expiration) {
        if (!this.checkPermission()) { return "ERROR: FireStorage operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            const file = this.#bucket.file(filePath);
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: expiration
            });
            return url;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }
}

module.exports = FireStorage;