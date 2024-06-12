const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
require('dotenv').config()

class FireStorage {
    static #bucket = null;
    static #initialized = false;

    static initialize() {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.STORAGE_BUCKET_URL
        });
        FireStorage.#bucket = admin.storage().bucket();
        FireStorage.#initialized = true;
    }

    static async uploadFile(filePath, destinationPath = null) {
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
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            await this.#bucket.file(filePath).delete();
            return true;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async getMetadata(filePath) {
        if (!this.#initialized) { return 'ERROR: FireStorage must be initialized first.' }
        try {
            const [metadata] = await this.#bucket.file(filePath).getMetadata();
            return metadata;
        } catch (err) {
            return `ERROR: ${err}`
        }
    }

    static async listFiles() {
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