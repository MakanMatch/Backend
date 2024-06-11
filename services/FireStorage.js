const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

class FireStorage {
    static initialize() {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: 'gs://makanmatch.appspot.com'
        });
    }

    static async uploadFile(filePath, destinationPath=null) {
        if (!destinationPath) {
            destinationPath = filePath;
        }
        const bucket = admin.storage().bucket();
        await bucket.upload(filePath, {
            destination: destinationPath
        });
        console.log('File uploaded successfully.');
    }

    static async downloadFile(sourcePath, destinationPath=null) {
        if (!destinationPath) {
            destinationPath = sourcePath;
        }
        const bucket = admin.storage().bucket();
        await bucket.file(sourcePath).download({
            destination: destinationPath
        });
        console.log('File downloaded successfully.');
    }

    static async deleteFile(filePath) {
        const bucket = admin.storage().bucket();
        await bucket.file(filePath).delete();
        console.log('File deleted successfully.');
    }

    static async getMetadata(filePath) {
        const bucket = admin.storage().bucket();
        const [metadata] = await bucket.file(filePath).getMetadata();
        console.log('File metadata:', metadata);
    }

    static async listFiles() {
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles();
        console.log('Files:');
        files.forEach(file => {
            console.log(file.name);
        });
    }
}

module.exports = FireStorage;