const FireStorage = require('./FireStorage');
const FileOps = require('./FileOps')
const path = require('path');

// Uses on-demand principle with a local file store for performance efficiency. Cloud remains the source of truth.
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

    static checkPermission() {
        return process.env.FILEMANAGER_ENABLED === "True"
    }

    static loadFileStoreContext() {
        if (!this.checkPermission()) { return "FILEMANAGER ERROR: FileManager operation permission denied." }
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
        if (!this.checkPermission()) { throw new Error("FILEMANAGER ERROR: FileManager operation permission denied.") }

        const fireStorageInit = FireStorage.initialize();
        if (fireStorageInit !== true) {
            throw new Error(`FILEMANAGER SETUP ERROR: Failed to initialize FireStorage; error: ${fireStorageInit}`)
        }
        if (!FileOps.exists(this.fileStorePath)) {
            var response = FileOps.createFolder(this.fileStorePath)
            if (response !== true) {
                throw new Error(`FILEMANAGER SETUP ERROR: Failed to setup file store directory; error: ${response}`)
            }
        }

        // Load existing file store context
        this.loadFileStoreContext()

        // Fetch list of files from Firebase Cloud Storage
        const cloudFiles = await FireStorage.listFiles();
        if (typeof cloudFiles === 'string') {
            throw new Error(`FILEMANAGER SETUP ERROR: Failed to retrieve list of files from cloud storage; error: ${cloudFiles}`)
        }

        // Compare file store context with cloud files
        Object.keys(this.#fileStoreContext).forEach(async file => {
            if (this.#fileStoreContext[file].forceExistence === true) {
                // Force declare file in cloud storage
                const fileUpload = await FireStorage.uploadFile(path.join(this.fileStorePath, this.#fileStoreContext[file].name), this.#fileStoreContext[file].name)
                if (fileUpload !== true) {
                    throw new Error(`FILEMANAGER SETUP ERROR: Failed to upload file ${this.#fileStoreContext[file].name}; error: ${fileUpload}`)
                }

                // Fetch and update metadata
                const metadata = await FireStorage.getMetadata(this.#fileStoreContext[file].name)
                if (typeof metadata === 'string') {
                    throw new Error(`FILEMANAGER SETUP ERROR: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`)
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
                    throw new Error(`FILEMANAGER SETUP ERROR: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`)
                }

                // Re-download file if file is outdated
                if (metadata.updated !== this.#fileStoreContext[file].updated) {
                    // Re-download file and update metadata
                    const fileDownload = await FireStorage.downloadFile(this.#fileStoreContext[file].name, path.join(this.fileStorePath, this.#fileStoreContext[file].name))
                    if (fileDownload !== true) {
                        throw new Error(`FILEMANAGER SETUP ERROR: Failed to update file ${file.name}; error: ${fileDownload}`)
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

        console.log("FILEMANAGER: Setup complete.")
        this.#initialized = true;
        return true;
    }

    static async exists(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        const fileExists = await FireStorage.fileExistsAt(file)
        if (typeof fileExists === 'string') {
            return `ERROR: ${fileExists}`
        }
        if (!fileExists) {
            // Remove from file store if file exists as file is not in cloud storage
            if (this.#fileStoreContext[file] !== undefined) {
                delete this.#fileStoreContext[file]
                this.persistFileStoreContext();
            }
            if (FileOps.exists(path.join(this.fileStorePath, file))) {
                FileOps.deleteFile(path.join(this.fileStorePath, file))
            }
        }

        return fileExists;
    }

    static async prepFile(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        const fileExists = await FireStorage.fileExistsAt(file)
        if (typeof fileExists === 'string') {
            return `ERROR: ${fileExists}`
        }
        if (!fileExists) {
            // Remove from file store if file exists as file is not in cloud storage
            if (this.#fileStoreContext[file] !== undefined) {
                delete this.#fileStoreContext[file]
                this.persistFileStoreContext();
            }
            if (FileOps.exists(path.join(this.fileStorePath, file))) {
                FileOps.deleteFile(path.join(this.fileStorePath, file))
            }

            return "ERROR: File does not exist."
        }

        const fileMetadata = await FireStorage.getMetadata(file)
        if (typeof fileMetadata === 'string') {
            return `ERROR: ${fileMetadata}`
        }

        if (this.#fileStoreContext[file] === undefined || this.#fileStoreContext[file].updated != fileMetadata.updated || !FileOps.exists(path.join(this.fileStorePath, file))) {
            // Download file
            const fileDownload = await FireStorage.downloadFile(file, path.join(this.fileStorePath, file))
            if (fileDownload !== true) {
                return `ERROR: ${fileDownload}`
            }

            this.#fileStoreContext[file] = {
                id: fileMetadata.id,
                name: file,
                contentType: fileMetadata.contentType,
                updated: fileMetadata.updated,
                updateMetadata: false,
                forceExistence: false
            }
            this.persistFileStoreContext();
        }

        return `SUCCESS: File path: ${path.join(this.fileStorePath, file)}`;
    }

    static async saveFile(file) {
        // To be run after a file is stored in the file store
        // Uploads new file to cloud storage and updates file store context

        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        if (!FileOps.exists(path.join(this.fileStorePath, file))) {
            return "ERROR: File does not exist in file store."
        }

        const fileUpload = await FireStorage.uploadFile(path.join(this.fileStorePath, file), file)
        if (fileUpload !== true) {
            return `ERROR: ${fileUpload}`
        }

        const fileMetadata = await FireStorage.getMetadata(file)
        if (typeof fileMetadata === 'string') {
            return `ERROR: ${fileMetadata}`
        }

        this.#fileStoreContext[file] = {
            id: fileMetadata.id,
            name: file,
            contentType: fileMetadata.contentType,
            updated: fileMetadata.updated,
            updateMetadata: false,
            forceExistence: false
        }
        this.persistFileStoreContext();

        return true;
    }

    static async deleteFile(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        // Check if file exists first
        const fileExists = await FireStorage.fileExistsAt(file)
        if (typeof fileExists === 'string') {
            return `ERROR: ${fileExists}`
        }
        if (!fileExists) {
            return "ERROR: File does not exist."
        }

        // Process file deletion and synchronize file store

        // Delete file from cloud storage
        const fileDelete = await FireStorage.deleteFile(file)
        if (fileDelete !== true) {
            return `ERROR: ${fileDelete}`
        }

        // Remove from file store context
        if (this.#fileStoreContext[file] !== undefined) {
            delete this.#fileStoreContext[file]
            this.persistFileStoreContext();
        }

        // Remove from file store, if exists
        if (FileOps.exists(path.join(this.fileStorePath, file))) {
            FileOps.deleteFile(path.join(this.fileStorePath, file))
        }

        return true;
    }

    static async deleteAll() {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        // Delete files on cloud storage
        const deleteAllResult = await FireStorage.deleteAll();
        if (deleteAllResult !== true) {
            return `ERROR: ${deleteAllResult}`
        }

        // Clear file store context and file store
        this.#fileStoreContext = {}
        this.persistFileStoreContext();
        this.cleanupNonmatchingFiles();

        return true;
    }
}

module.exports = FileManager;