const FireStorage = require('./FireStorage');
const FileOps = require('./FileOps')
const path = require('path');
const Analytics = require('./Analytics');
const Universal = require('./Universal');

/**
 * ## Introduction to FileManager
 * 
 * Uses on-demand principle with a local file store for performance efficiency. Cloud remains the source of truth.
 * 
 * Files are stored in `./FileStore` directory. File metadata is stored in `./FileStore/context.json`. Both data stores are maintained by this service.
 * 
 * Calling `prepFile` will guarantee the existence of the most updated version of the file in the `FileStore` directory if it exists in Firebase Cloud Storage.
 * 
 * Calling `saveFile` will persist a file in `FileStore` to Firebase Cloud Storage and will also synchronise with the file store context.
 * 
 * Example usage:
 * ```js
 * const FileManager = require('./services/FileManager');
 * 
 * // Setup FileManager
 * const setupResult = await FileManager.setup();
 * if (setupResult !== true) {
 *     console.log(`ERROR: ${setupResult}`);
 *     return;
 * }
 * 
 * // Check if file exists
 * const fileExists = await FileManager.exists('file.txt');
 * if (fileExists !== true) {
 *     console.log(`ERROR: ${fileExists}`);
 *     return;
 * }
 * 
 * // Prepare file
 * const prepResult = await FileManager.prepFile('file.txt');
 * if (prepResult.startsWith('ERROR')) {
 *     console.log(prepResult);
 *     return;
 * }
 * const filePath = prepResult.substring("SUCCESS: File path: ".length);
 * ```
 * 
 * ## Permissions and Internals
 * FileManager requires explicit permission to operate by setting `FILEMANAGER_ENABLED=True` in the environment.
 * 
 * FileManager internally uses the low-level FireStorage and FileOps services. It is recommended to understand these services before using FileManager.
 * 
 * FireStorage is a service wrapper for Firebase Cloud Storage operations and uses the `firebase-admin` SDK. The wrapper provides several methods to download, update and do other operations on files.
 * 
 * FireStorage requires:
 * - A `serviceAccountKey.json` file in the root directory
 * - Explicit permission to operate by setting `FIRESTORAGE_ENABLED=True` in the environment
 * - A `STORAGE_BUCKET_URL` environment variable set to the Firebase Cloud Storage bucket URL
 */
class FileManager {
    static #mode = "cloud"; // "cloud" or "local"
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

            // Check if context's persistence mode changed in this new loaded environment. If so, the entire FileStore context must be reset.
            if (this.#fileStoreContext.mode !== this.#mode) {
                this.#fileStoreContext = {
                    mode: this.#mode
                }
                const files = FileOps.getFilenames(this.fileStorePath)
                files.forEach(file => {
                    if (file === 'context.json') { return; }
                    this.#fileStoreContext[file] = {
                        id: this.#mode == "cloud" ? "" : Universal.generateUniqueID(),
                        name: file,
                        contentType: this.#mode == "cloud" ? "" : "Unavailable",
                        updated: this.#mode == "cloud" ? "" : new Date().toISOString(),
                        updateMetadata: this.#mode === "cloud",
                        forceExistence: false
                    }
                })
                this.persistFileStoreContext();
                return;
            }

            var changesMade = false;
            Object.keys(this.#fileStoreContext).forEach(file => {
                if (file === 'mode') { return; }
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
            this.#fileStoreContext = {
                mode: this.#mode
            }
            const files = FileOps.getFilenames(this.fileStorePath)
            files.forEach(file => {
                if (file === 'context.json') { return; }
                this.#fileStoreContext[file] = {
                    id: this.#mode == "cloud" ? "" : Universal.generateUniqueID(),
                    name: file,
                    contentType: this.#mode == "cloud" ? "" : "Unavailable",
                    updated: this.#mode == "cloud" ? "" : new Date().toISOString(),
                    updateMetadata: this.#mode === "cloud",
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

    static async setup(mode = "cloud") {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (this.#initialized) { return true; }

        // Programmatic mode configuration
        this.#mode = mode === "cloud" ? "cloud" : "local";

        // Process environment variable FILEMANAGER_MODE overrides if set
        if (process.env.FILEMANAGER_MODE) {
            this.#mode = process.env.FILEMANAGER_MODE === "local" ? "local" : "cloud";
        }

        if (this.#mode === "cloud") {
            const fireStorageInit = FireStorage.initialize();
            if (fireStorageInit !== true) {
                // Resort to local mode if FireStorage fails to initialize
                this.#mode = "local";
                console.log(`FILEMANAGER SETUP ERROR: Failed to initialize FireStorage, will resort to local mode; error: ${fireStorageInit}`)
            }
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
        var cloudFiles = [];
        if (this.#mode == "cloud") {
            cloudFiles = await FireStorage.listFiles();
            if (typeof cloudFiles === 'string') {
                return `ERROR: Failed to retrieve list of files from cloud storage; error: ${cloudFiles}`
            }
        }

        // Compare file store context with cloud files
        Object.keys(this.#fileStoreContext).forEach(async file => {
            if (file === 'mode') { return; }
            if (this.#fileStoreContext[file].forceExistence === true) {
                if (this.#mode == "cloud") {
                    // Force declare file in cloud storage
                    const fileUpload = await FireStorage.uploadFile(path.join(this.fileStorePath, this.#fileStoreContext[file].name), this.#fileStoreContext[file].name)
                    if (fileUpload !== true) {
                        return `ERROR: Failed to upload file ${this.#fileStoreContext[file].name}; error: ${fileUpload}`
                    }

                    // Fetch and update metadata
                    const metadata = await FireStorage.getMetadata(this.#fileStoreContext[file].name)
                    if (typeof metadata === 'string') {
                        return `ERROR: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`
                    }

                    this.#fileStoreContext[file].id = metadata.id
                    this.#fileStoreContext[file].contentType = metadata.contentType
                    this.#fileStoreContext[file].updated = metadata.updated
                    this.#fileStoreContext[file].updateMetadata = false
                    this.#fileStoreContext[file].forceExistence = false
                } else {
                    // Force declare file in local file store context
                    this.#fileStoreContext[file].id = Universal.generateUniqueID()
                    this.#fileStoreContext[file].contentType = "Unavailable"
                    this.#fileStoreContext[file].updated = new Date().toISOString()
                    this.#fileStoreContext[file].updateMetadata = false
                    this.#fileStoreContext[file].forceExistence = false
                }
            } else if (this.#mode == "cloud") {
                if (!cloudFiles.includes(this.#fileStoreContext[file].name)) {
                    // Delete file from local store
                    FileOps.deleteFile(path.join(this.fileStorePath, this.#fileStoreContext[file].name))
                    delete this.#fileStoreContext[file]
                } else {
                    // Carry out metadata-based processing
                    const metadata = await FireStorage.getMetadata(this.#fileStoreContext[file].name)
                    if (typeof metadata === 'string') {
                        return `ERROR: Failed to retrieve metadata for file ${this.#fileStoreContext[file].name}; error: ${metadata}`
                    }

                    // Re-download file if file is outdated
                    if (metadata.updated !== this.#fileStoreContext[file].updated) {
                        // Re-download file and update metadata
                        const fileDownload = await FireStorage.downloadFile(this.#fileStoreContext[file].name, path.join(this.fileStorePath, this.#fileStoreContext[file].name))
                        if (fileDownload !== true) {
                            return `ERROR: Failed to update file ${file.name}; error: ${fileDownload}`
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
            }

            this.persistFileStoreContext();
        })

        console.log("FILEMANAGER: Setup complete. Mode: " + this.#mode)
        this.#initialized = true;
        return true;
    }

    static async exists(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        if (this.#mode == "cloud") {
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
        } else {
            var fileExists = true;
            if (this.#fileStoreContext[file] === undefined) {
                fileExists = false;
            }

            // Remove file from file store if it exists but is not in file store context
            if (!fileExists && FileOps.exists(path.join(this.fileStorePath, file))) {
                FileOps.deleteFile(path.join(this.fileStorePath, file))
            }

            return fileExists;
        }
    }

    static async prepFile(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }

        if (this.#mode == "cloud") {
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
        } else {
            var fileExists = true;
            if (this.#fileStoreContext[file] === undefined) {
                fileExists = false;
            }

            // Remove file from file store if it exists but is not in file store context
            if (!fileExists && FileOps.exists(path.join(this.fileStorePath, file))) {
                FileOps.deleteFile(path.join(this.fileStorePath, file))
            } else if (!FileOps.exists(path.join(this.fileStorePath, file))) {
                return "ERROR: File does not exist."
            }
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

        if (this.#mode == "cloud") {
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
        } else {
            this.#fileStoreContext[file] = {
                id: Universal.generateUniqueID(),
                name: file,
                contentType: "Unavailable",
                updated: new Date().toISOString(),
                updateMetadata: false,
                forceExistence: false
            }
        }
        this.persistFileStoreContext();

        if (Analytics.checkPermission()) {
            Analytics.supplementSystemMetricUpdate({
                fileUploads: 1
            })
                .catch(err => {
                    console.log(`FILEMANAGER ANALYTICS: Failed to supplement file upload metric. Error: ${err}`)
                })
        }
        return true;
    }

    static async deleteFile(file) {
        if (!this.checkPermission()) { return "ERROR: FileManager operation permission denied." }
        if (!this.#initialized) { return 'ERROR: FileManager must be setup first.' }
        if (file == "mode") { return "ERROR: Cannot delete mode." }

        // Check if file exists first
        if (this.#mode == "cloud") {
            const fileExists = await FireStorage.fileExistsAt(file)
            if (typeof fileExists === 'string') {
                return `ERROR: ${fileExists}`
            }
            if (!fileExists) {
                return "ERROR: File does not exist."
            }
        } else {
            if (!FileOps.exists(path.join(this.fileStorePath, file))) {
                return "ERROR: File does not exist."
            }
        }

        // Process file deletion and synchronize file store
        if (this.#mode == "cloud") {
            // Delete file from cloud storage
            const fileDelete = await FireStorage.deleteFile(file)
            if (fileDelete !== true) {
                return `ERROR: ${fileDelete}`
            }
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

        if (this.#mode == "cloud") {
            // Delete files on cloud storage
            const deleteAllResult = await FireStorage.deleteAll();
            if (deleteAllResult !== true) {
                return `ERROR: ${deleteAllResult}`
            }
        }

        // Clear file store context and file store
        this.#fileStoreContext = {
            mode: this.#mode
        }
        this.persistFileStoreContext();
        this.cleanupNonmatchingFiles();

        return true;
    }
}

module.exports = FileManager;