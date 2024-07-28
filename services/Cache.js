const FileOps = require("./FileOps");

/**
 * Cache class to store data in memory and persist to disk. Key-value store for small persistence needs.
 * 
 * @method load: Load the cache from disk
 * @method save: Save the cache to disk
 * @method set: Set a key-value pair in the cache
 * @method get: Get a value from the cache using the key
 * @method delete: Delete a key-value pair from the cache
 */
class Cache {
    static cache = {};
    static dataFile = "cache.json"

    static load() {
        try {
            if (FileOps.exists(this.dataFile)) {
                const readResult = FileOps.read(this.dataFile)
                if (readResult.startsWith("ERROR")) {
                    throw new Error(readResult)
                }
                this.cache = JSON.parse(readResult)
            } else {
                FileOps.writeTo(this.dataFile, "{}")
            }
            return true
        } catch (err) {
            return `CACHE ERROR: Failed to load cache. Error: ${err}`
        }
    }

    static save() {
        const response = FileOps.writeTo(this.dataFile, JSON.stringify(this.cache))
        if (response === true) {
            return true
        } else {
            return `CACHE ERROR: Failed to persist cache; error: ${response}`
        }
    }

    static set(key, value) {
        this.cache[key] = value
        return this.save()
    }

    static get(key) {
        return this.cache[key]
    }

    static delete(key) {
        delete this.cache[key]
        return this.save()
    }
}

module.exports = Cache;