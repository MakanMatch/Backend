const FireStorage = require('./FireStorage');
const FileOps = require('./FileOps')
const path = require('path');

// Uses on-demand principle with a cache local file store layer. File caches expire after one hour.
class FileManager {
    static #initialized = false;
    static fileStorePath = path.join(__dirname, '../FileStore')
    static fileStoreContextPath = path.join(this.fileStorePath, 'context.json')
    static #fileStoreContext = {};

    // File context schema:
    // {
    //     "id": "string",
    //     "name": "string",
    //     "contentType": "string",
    //     "updated": "string",
    //     "updateMetadata": "boolean"
    //     "forceExistence": "boolean"
    // }

    static loadFileStoreContext() {
        if (FileOps.exists(this.fileStoreContextPath)) {
            this.#fileStoreContext = JSON.parse(FileOps.read(this.fileStoreContextPath))
            var changesMade = false;
            Object.keys(this.#fileStoreContext).forEach(file => {
                if (!FileOps.exists(path.join(this.fileStorePath, file))) {
                    delete this.#fileStoreContext[file]
                    changesMade = true;
                    return;
                }

                // Check that all parameters exist, if not, set default values
                if (this.#fileStoreContext[file].id == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].id = ""
                }
                if (this.#fileStoreContext[file].name == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].name = file
                } else if (this.#fileStoreContext[file].name !== file) {
                    changesMade = true;
                    this.#fileStoreContext[file].name = file
                }
                if (this.#fileStoreContext[file].contentType == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].contentType = ""
                }
                if (this.#fileStoreContext[file].updated == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].updated = ""
                }
                if (this.#fileStoreContext[file].updateMetadata == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].updateMetadata = true
                }
                if (this.#fileStoreContext[file].forceExistence == undefined) {
                    changesMade = true;
                    this.#fileStoreContext[file].forceExistence = false
                }
            })
            if (changesMade) { this.persistFileStoreContext(); }
            this.cleanupNonmatchingFiles();
        } else {
            this.#fileStoreContext = {}
            const files = FileOps.getFilenames(this.fileStorePath)
            files.forEach(file => {
                this.#fileStoreContext[file] = {
                    id: "",
                    name: file,
                    contentType: "",
                    updated: "",
                    updateMetadata: true,
                    forceExistence: false
                }
            })

            this.persistFileStoreContext();
        }
    }

    static persistFileStoreContext() {
        FileOps.writeTo(this.fileStoreContextPath, JSON.stringify(this.#fileStoreContext))
    }

    static cleanupNonmatchingFiles() {
        const files = FileOps.getFilenames(this.fileStorePath)
        files.forEach(file => {
            if (!Object.keys(this.#fileStoreContext).includes(file) && file !== 'context.json') {
                FileOps.deleteFile(path.join(this.fileStorePath, file))
            }
        })
    }

    static async setup() {
        FireStorage.initialize()
        if (!FileOps.exists(this.fileStorePath)) {
            var response = FileOps.createFolder(this.fileStorePath)
            if (response !== true) {
                throw new Error(`FILEMANAGER SETUP: Failed to setup file store directory; error: ${response}`)
            }
        }

        // Load existing file store context
        this.loadFileStoreContext()

        // Fetch list of files from Firebase Cloud Storage
        const cloudFiles = await FireStorage.listFiles();
        if (typeof cloudFiles === 'string') {
            throw new Error(`FILEMANAGER SETUP: Failed to retrieve list of files from cloud storage; error: ${cloudFiles}`)
        }

        // Compare file store context with cloud files
        Object.keys(this.#fileStoreContext).forEach(async file => {
            if (this.#fileStoreContext[file].forceExistence === true) {
                // Force declare file in cloud storage
                const fileUpload = await FireStorage.uploadFile(path.join(this.fileStorePath, this.#fileStoreContext[file].name), this.#fileStoreContext[file].name)
                if (fileUpload !== true) {
                    return `FILEMANAGER SETUP: Failed to upload file ${this.#fileStoreContext[file].name}; error: ${fileUpload}`
                }

                // Fetch and update metadata
                const metadata = await FireStorage.getMetadata(this.#fileStoreContext[file].name)
                if (typeof metadata === 'string') {
                    return `FILEMANAGER SETUP: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`
                }

                this.#fileStoreContext[file].id = metadata.id
                this.#fileStoreContext[file].contentType = metadata.contentType
                this.#fileStoreContext[file].updated = metadata.updated
                this.#fileStoreContext[file].updateMetadata = false
                this.#fileStoreContext[file].forceExistence = false
            } else if (!cloudFiles.includes(this.#fileStoreContext[file].name)) {
                // Delete file from local store
                FileOps.deleteFile(path.join(this.fileStorePath, this.#fileStoreContext[file].name))
                delete this.#fileStoreContext[file]
            } else {
                // Carry out metadata-based processing
                const metadata = await FireStorage.getMetadata(this.#fileStoreContext[file].name)
                if (typeof metadata === 'string') {
                    return `FILEMANAGER SETUP: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`
                }

                // Re-download file if file is outdated
                if (metadata.updated !== this.#fileStoreContext[file].updated) {
                    // Re-download file and update metadata
                    const fileDownload = await FireStorage.downloadFile(this.#fileStoreContext[file].name, path.join(this.fileStorePath, this.#fileStoreContext[file].name))
                    if (fileDownload !== true) {
                        return `FILEMANAGER SETUP: Failed to update file ${file.name}; error: ${fileDownload}`
                    }

                    this.#fileStoreContext[file].id = metadata.id
                    this.#fileStoreContext[file].contentType = metadata.contentType
                    this.#fileStoreContext[file].updated = metadata.updated
                    this.#fileStoreContext[file].updateMetadata = false
                    this.#fileStoreContext[file].forceExistence = false
                } else if (file.updateMetadata === true) {
                    // Update metadata
                    this.#fileStoreContext[file].id = metadata.id
                    this.#fileStoreContext[file].contentType = metadata.contentType
                    this.#fileStoreContext[file].updated = metadata.updated
                    this.#fileStoreContext[file].updateMetadata = false
                    this.#fileStoreContext[file].forceExistence = false
                }
            }

            this.persistFileStoreContext();
        })

        return true;
    }
}

module.exports = FileManager;