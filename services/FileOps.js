const fs = require('fs');
const path = require('path');

/**
 * FileOps class to perform file operations. Helps you carry out file operations more easily. Uses `fs` module internally.
 * 
 * @method exists: Checks if a file or directory exists
 * @method read: Reads a file
 * @method writeTo: Writes to a file
 * @method appendTo: Appends to a file
 * @method getFilenames: Gets all filenames in a directory
 * @method deleteFile: Deletes a file
 * @method createFolder: Creates a directory
 * @method deleteFolder: Deletes a directory
 */
class FileOps {
    static exists(path) {
        return fs.existsSync(path);
    }

    static read(file, encoding='utf8') {
        try {
            const data = fs.readFileSync(file, encoding);
            return data;
        } catch (err) {
            return `ERROR: Failed to read file ${file}; error: ${err}`;
        }
    }

    static writeTo(file, data, encoding='utf8') {
        try {
            fs.writeFileSync(file, data, encoding);
            return true;
        } catch (err) {
            return `ERROR: Failed to write to file ${file}; error: ${err}`;
        }
    }

    static appendTo(file, data, encoding='utf8') {
        try {
            fs.appendFileSync(file, data, encoding);
            return true;
        } catch (err) {
            return `ERROR: Failed to append to file ${file}; error: ${err}`;
        }
    }

    static getFilenames(dir, fileNameEncoding='utf8') {
        try {
            const files = fs.readdirSync(dir, fileNameEncoding)
            return files;
        } catch (err) {
            return `ERROR: Failed to read directory ${dir}; error: ${err}`;
        }
    }

    static deleteFile(file) {
        try {
            fs.unlinkSync(file);
            return true;
        } catch (err) {
            return `ERROR: Failed to delete file ${file}; error: ${err}`;
        }
    }

    static createFolder(dir) {
        try {
            fs.mkdirSync(dir);
            return true;
        } catch (err) {
            return `ERROR: Failed to create directory ${dir}; error: ${err}`;
        }
    }

    static deleteFolder(dir) {
        try {
            fs.rmdirSync(dir, { recursive: true });
            return true;
        } catch (err) {
            return `ERROR: Failed to delete directory ${dir}; error: ${err}`;
        }
    }
}

module.exports = FileOps;