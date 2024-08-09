const { SystemAnalytics, ListingAnalytics, RequestAnalytics } = require('../models');
const Extensions = require('./Extensions');
const Logger = require('./Logger');
const Universal = require('./Universal')
const prompt = require("prompt-sync")({ sigint: true });
require('dotenv').config()

/**
 * Analytics service for tracking and persisting metrics.
 * 
 * Tracks system, listing-specific, and request-specific metrics in the `SystemAnalytics`, `ListingAnalytics`, and `RequestAnalytics` SQL tables respectively.
 * 
 * Sequelize synchronisation needs to be done prior to setup and operation.
 * 
 * Uses a metric registry to validate and process incoming data. Add new metrics to the registry to track them. Ensure to also make them available in the SQL columns.
 * 
 * @class Analytics
 * @method setup - Set up the analytics service. Must be called before any other method. Set withLastBoot to true to update last boot time in system metrics instance. Set updatePersistenceInterval to change the interval at which data is persisted.
 * @method createRecordIfNotExist - Create a new record if it doesn't exist. Mode can be "system", "listing", or "request". For "listing" and "request", provide listingID or requestURL and requestMethod respectively.
 * @method persistData - Persist all cached data to the database.
 * @method checkForUpdates - Check if there are enough updates to persist data.
 * @method supplementListingMetricUpdate - Update listing metrics. Provide listingID and data in the form of key-value pairs.
 * @method supplementRequestMetricUpdate - Update request metrics. Provide requestURL, requestMethod, and data in the form of key-value pairs.
 * @method supplementSystemMetricUpdate - Update system metrics. Provide data in the form of key-value pairs.
 * @method reset - Reset metrics. Mode can be "system", "listing", "request", or "all". For "listing" and "request", you can provide listingID or requestURL and requestMethod respectively to reset a specific listing/request's metrics.
 * @method setListingMetrics - Set listing metrics. Provide listingID and data in the form of key-value pairs. Removes any associated updates from the cache.
 * @method setRequestMetrics - Set request metrics. Provide requestURL, requestMethod, and data in the form of key-value pairs. Removes any associated updates from the cache.
 * @method setSystemMetrics - Set system metrics. Provide data in the form of key-value pairs. Removes any associated updates from the cache.
 * @method getListingMetrics - Get listing metrics. Provide listingID to get a specific listing's metrics, or leave blank to get all listings' metrics.
 * @method getRequestMetrics - Get request metrics. Provide requestURL and method to get a specific request's metrics, or leave blank to get all requests' metrics.
 * @method getSystemMetrics - Get system metrics.
 * @method checkPermission - Check if the analytics service is enabled.
 * @method ignoreCDN - Check if the analytics service should ignore CDN requests.
 */
class Analytics {
    static defaultInterval = 20;
    static #setup = false
    static #metadata = {
        systemMetricsInstanceID: null,
        updatePersistenceInterval: this.defaultInterval,
        lastUpdate: null,
        lastPersistence: null,
        updates: 0
    }
    static cacheData = {
        listingUpdates: {},
        requestUpdates: {},
        systemUpdates: {}
    }

    static metricRegistry = {
        listingMetrics: ["impressions", "clicks"],
        requestMetrics: ["requestsCount", "successResponses", "lastRequest"],
        systemMetrics: ["lastBoot", "accountCreations", "listingCreations", "emailDispatches", "fileUploads", "logins"]
    }

    static nonNumericalMetricRegistry = {
        listingMetrics: [],
        requestMetrics: ["lastRequest"],
        systemMetrics: ["lastBoot"]
    }

    static checkPermission() {
        return process.env.ANALYTICS_ENABLED === "True"
    }

    static ignoreCDN() {
        return process.env.ANALYTICS_CDN_IGNORE !== "False"
    }

    static async setup(withLastBoot = false, updatePersistenceInterval = null) {
        if (!this.checkPermission()) {
            return "ERROR: Analytics service operation permission denied."
        }

        var interval;
        if (updatePersistenceInterval) {
            interval = updatePersistenceInterval
        } else if (process.env.ANALYTICS_PERSISTENCE_INTERVAL) {
            try {
                interval = parseInt(process.env.ANALYTICS_PERSISTENCE_INTERVAL)
            } catch (err) {
                interval = this.defaultInterval
                return `WARNING: Invalid value for ANALYTICS_PERSISTENCE_INTERVAL; error: ${err}. Defaulting to 10.`
            }
        } else {
            interval = this.defaultInterval
        }

        this.#metadata.updatePersistenceInterval = interval;

        // Load data from SQL tables
        this.#setup = true;
        const systemSetupResult = await this.createRecordIfNotExist("system");
        if (typeof systemSetupResult === "string") {
            return systemSetupResult
        }
        if (withLastBoot) {
            try {
                systemSetupResult.lastBoot = new Date().toISOString()
                await systemSetupResult.save()
            } catch (err) {
                Logger.log("ANALYTICS SETUP WARNING: Failed to update last boot in system metrics; error:", err)
            }
        }

        console.log("ANALYTICS: Setup complete.")
        return true;
    }

    static async createRecordIfNotExist(mode = "system", listingID = null, requestURL = null, requestMethod = null) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        try {
            if (mode == "system") {
                const systemMetrics = await SystemAnalytics.findAll({
                    order: [["createdAt", "DESC"]]
                });
                if (!systemMetrics || !Array.isArray(systemMetrics)) {
                    throw new Error("Failed to retrieve from SystemAnalytics.")
                }

                var systemMetricsInstance;
                if (systemMetrics.length == 0) {
                    // Create new system metrics record
                    systemMetricsInstance = await SystemAnalytics.create({ instanceID: Universal.generateUniqueID() })
                    if (!systemMetricsInstance) {
                        throw new Error("Creation of default SystemAnalytics instance failed.")
                    }

                    // console.log("Created new metric instance with ID:", systemMetricsInstance.instanceID);
                } else {
                    // console.log("Attaching to latest system metrics instance with ID:", systemMetrics[0].instanceID)
                    systemMetricsInstance = systemMetrics[0];
                }

                this.#metadata.systemMetricsInstanceID = systemMetricsInstance.instanceID;
                return systemMetricsInstance;
            } else if (mode == "listing") {
                if (!listingID) {
                    throw new Error("Listing ID not provided.")
                }

                var listingMetrics = await ListingAnalytics.findByPk(listingID);
                if (!listingMetrics) {
                    listingMetrics = await ListingAnalytics.create({ listingID: listingID })
                    if (!listingMetrics) {
                        throw new Error("Failed to create new listing metrics record.")
                    }
                }

                return listingMetrics;
            } else if (mode == "request") {
                if (!requestURL || !requestMethod) {
                    throw new Error("Request URL or method not provided.")
                }

                var requestMetrics = await RequestAnalytics.findOne({
                    where: {
                        requestURL: requestURL,
                        method: requestMethod
                    }
                })
                if (!requestMetrics) {
                    requestMetrics = await RequestAnalytics.create({ requestURL: requestURL, method: requestMethod })
                    if (!requestMetrics) {
                        throw new Error("Failed to create new request metrics record.")
                    }
                }

                return requestMetrics;
            }

            return `ERROR: Invalid mode '${mode}' provided.`
        } catch (err) {
            return `ERROR: Failed to check existing record and create if not found; error: ${err}`
        }
    }

    static async persistData() {
        const cacheCopy = structuredClone(this.cacheData)

        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (process.env.DEBUG_MODE === "True") {
            console.log("Persisting data...")
        }

        // Process listing metrics
        for (const listingID of Object.keys(cacheCopy.listingUpdates)) {
            var listingMetricsRecord = await this.createRecordIfNotExist("listing", listingID);
            if (typeof listingMetricsRecord === "string") {
                return listingMetricsRecord
            }

            var newData = listingMetricsRecord.toJSON()
            for (const metric of Object.keys(cacheCopy.listingUpdates[listingID])) {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric)) {
                    newData[metric] += cacheCopy.listingUpdates[listingID][metric]
                } else {
                    newData[metric] = cacheCopy.listingUpdates[listingID][metric]
                }
            }

            try {
                listingMetricsRecord.set(newData);
                await listingMetricsRecord.save();
                // console.log("ListingAnalytics record updated:", listingMetricsRecord.toJSON())
                if (this.cacheData.listingUpdates[listingID] !== undefined) {
                    delete this.cacheData.listingUpdates[listingID]
                }
            } catch (err) {
                return `ERROR: Failed to persist ListingAnalytics updates for ID ${listingID}; error: ${err}`
            }
        }

        // Process request metrics
        for (const requestIdentifier of Object.keys(cacheCopy.requestUpdates)) {
            const requestMethod = requestIdentifier.split("_")[0]
            const requestURL = requestIdentifier.split("_")[1]

            var requestMetricsRecord = await this.createRecordIfNotExist("request", null, requestURL, requestMethod);
            if (typeof requestMetricsRecord === "string") {
                return requestMetricsRecord
            }

            var newData = requestMetricsRecord.toJSON()
            for (const metric of Object.keys(cacheCopy.requestUpdates[requestIdentifier])) {
                if (!this.nonNumericalMetricRegistry.requestMetrics.includes(metric)) {
                    newData[metric] += cacheCopy.requestUpdates[requestIdentifier][metric]
                } else {
                    newData[metric] = cacheCopy.requestUpdates[requestIdentifier][metric]
                }
            }

            try {
                requestMetricsRecord.set(newData);
                await requestMetricsRecord.save();
                // console.log("RequestAnalytics record updated:", requestMetricsRecord.toJSON())
                if (this.cacheData.requestUpdates[requestIdentifier] !== undefined) {
                    delete this.cacheData.requestUpdates[requestIdentifier]
                }
            } catch (err) {
                return `ERROR: Failed to persist RequestAnalytics updates for identifier ${requestIdentifier}; error: ${err}`
            }
        }

        // Process system metrics
        if (Object.keys(cacheCopy.systemUpdates).length !== 0) {
            var systemAnalyticsRecord = await this.createRecordIfNotExist("system");
            if (typeof systemAnalyticsRecord === "string") {
                return systemAnalyticsRecord
            }

            var newData = systemAnalyticsRecord.toJSON()
            for (const metric of Object.keys(cacheCopy.systemUpdates)) {
                if (!this.nonNumericalMetricRegistry.systemMetrics.includes(metric)) {
                    newData[metric] += cacheCopy.systemUpdates[metric]
                } else {
                    newData[metric] = cacheCopy.systemUpdates[metric]
                }
            }

            try {
                systemAnalyticsRecord.set(newData);
                await systemAnalyticsRecord.save();
                // console.log("SystemAnalytics record updated:", systemAnalyticsRecord.toJSON())
                this.cacheData.systemUpdates = {}
            } catch (err) {
                return `ERROR: Failed to persist SystemAnalytics updates; error: ${err}`
            }
        }

        this.#metadata.updates = 0
        this.#metadata.lastPersistence = new Date().toISOString();
        return true;
    }

    static async checkForUpdates() {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (process.env.DEBUG_MODE === "True") {
            console.log(`Update ${this.#metadata.updates} queued.`)
        }

        if (this.#metadata.updates >= this.#metadata.updatePersistenceInterval || Extensions.timeDiffInSeconds(new Date(this.#metadata.lastPersistence), new Date()) >= 180) {
            return await this.persistData()
        }

        return true;
    }

    static async supplementListingMetricUpdate(listingID, data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (!listingID) {
            return "ERROR: Provide a valid listing ID."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.listingMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        if (this.cacheData.listingUpdates[listingID] == undefined) {
            this.cacheData.listingUpdates[listingID] = {}
        }
        for (const metric of Object.keys(processedData)) {
            // If metric doesn't exist, create and set to incoming value
            if (this.cacheData.listingUpdates[listingID][metric] === undefined) {
                this.cacheData.listingUpdates[listingID][metric] = processedData[metric]
            } else {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric)) {
                    // If metric exists, and is not one of the non-integer metrics, add the incoming value to the existing value
                    this.cacheData.listingUpdates[listingID][metric] += processedData[metric]
                } else {
                    // If metric is a non-integer metric, replace the existing with the incoming value
                    this.cacheData.listingUpdates[listingID][metric] = processedData[metric]
                }
            }
        }

        this.#metadata.updates += 1
        this.#metadata.lastUpdate = new Date().toISOString()
        await this.checkForUpdates();
        return true;
    }

    static async supplementRequestMetricUpdate(requestURL, requestMethod, data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (!requestURL || !requestMethod) {
            return "ERROR: Provide a valid request URL and method."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.requestMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.requestMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        const requestIdentifier = `${requestMethod}_${requestURL}`
        if (this.cacheData.requestUpdates[requestIdentifier] == undefined) {
            this.cacheData.requestUpdates[requestIdentifier] = {}
        }
        for (const metric of Object.keys(processedData)) {
            // If metric doesn't exist, create and set to incoming value
            if (this.cacheData.requestUpdates[requestIdentifier][metric] === undefined) {
                this.cacheData.requestUpdates[requestIdentifier][metric] = processedData[metric]
            } else {
                if (!this.nonNumericalMetricRegistry.requestMetrics.includes(metric)) {
                    // If metric exists, and is not one of the non-integer metrics, add the incoming value to the existing value
                    this.cacheData.requestUpdates[requestIdentifier][metric] += processedData[metric]
                } else {
                    // If metric is a non-integer metric, replace the existing with the incoming value
                    this.cacheData.requestUpdates[requestIdentifier][metric] = processedData[metric]
                }
            }
        }

        this.#metadata.updates += 1
        this.#metadata.lastUpdate = new Date().toISOString()
        await this.checkForUpdates();
        return true;
    }

    static async supplementSystemMetricUpdate(data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.systemMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.systemMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        for (const metric of Object.keys(processedData)) {
            // If metric doesn't exist, create and set to incoming value
            if (this.cacheData.systemUpdates[metric] === undefined) {
                this.cacheData.systemUpdates[metric] = processedData[metric]
            } else {
                if (!this.nonNumericalMetricRegistry.systemMetrics.includes(metric)) {
                    // If metric exists, and is not one of the non-integer metrics, add the incoming value to the existing value
                    this.cacheData.systemUpdates[metric] = this.cacheData.systemUpdates[metric] + processedData[metric]
                } else {
                    // If metric is a non-integer metric, replace the existing with the incoming value
                    this.cacheData.systemUpdates[metric] = processedData[metric]
                }
            }
        }

        this.#metadata.updates += 1
        this.#metadata.lastUpdate = new Date().toISOString()
        await this.checkForUpdates();
        return true;
    }

    static async reset(mode = "system", listingID = null, requestURL = null, requestMethod = null) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (mode == "all") {
            const resetListingsResult = await this.reset("listing")
            if (resetListingsResult !== true) {
                return resetListingsResult
            }

            const resetRequestsResult = await this.reset("request")
            if (resetRequestsResult !== true) {
                return resetRequestsResult
            }

            const resetSystemResult = await this.reset("system")
            if (resetSystemResult !== true) {
                return resetSystemResult
            }

            return true;
        }

        if (mode == "system") {
            try {
                const systemMetricsInstance = await SystemAnalytics.findByPk(this.#metadata.systemMetricsInstanceID);
                if (!systemMetricsInstance) {
                    return "ERROR: Failed to retrieve SystemAnalytics record for reset."
                }

                systemMetricsInstance.set({
                    lastBoot: null,
                    accountCreations: 0,
                    listingCreations: 0,
                    emailDispatches: 0,
                    fileUploads: 0,
                    logins: 0
                })
                await systemMetricsInstance.save()

                return true;
            } catch (err) {
                return `ERROR: Failed to reset system metrics; error: ${err}`
            }
        } else if (mode == "listing") {
            if (listingID == null) {
                try {
                    await ListingAnalytics.destroy();
                } catch (err) {
                    return `ERROR: Failed to reset listing metrics; error: ${err}`
                }
            } else {
                try {
                    const listingMetricsInstance = await ListingAnalytics.findByPk(listingID);
                    if (!listingMetricsInstance) {
                        return "ERROR: Failed to retrieve ListingAnalytics record for reset."
                    }

                    listingMetricsInstance.set({
                        impressions: 0,
                        clicks: 0
                    })
                    await listingMetricsInstance.save()

                    return true;
                } catch (err) {
                    return `ERROR: Failed to reset listing metrics; error: ${err}`
                }
            }
        } else if (mode == "request") {
            if (requestURL == null || requestMethod == null) {
                try {
                    await RequestAnalytics.destroy();
                } catch (err) {
                    return `ERROR: Failed to reset request metrics; error: ${err}`
                }
            } else {
                try {
                    const requestMetricsInstance = await RequestAnalytics.findOne({
                        where: {
                            requestURL: requestURL,
                            requestMethod: requestMethod
                        }
                    })
                    if (!requestMetricsInstance) {
                        return "ERROR: Failed to retrieve RequestAnalytics record for reset."
                    }

                    requestMetricsInstance.set({
                        requestsCount: 0,
                        successResponses: 0,
                        lastRequest: null
                    })
                    await requestMetricsInstance.save()

                    return true;
                } catch (err) {
                    return `ERROR: Failed to reset request metrics; error: ${err}`
                }
            }
        }

        return `ERROR: Invalid mode '${mode}' provided.`
    }

    static async setListingMetrics(listingID, data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (!listingID) {
            return "ERROR: Provide a valid listing ID."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.listingMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        const listingMetricsRecord = await this.createRecordIfNotExist("listing", listingID);
        if (typeof listingMetricsRecord === "string") {
            return listingMetricsRecord
        }

        var newData = listingMetricsRecord.toJSON()
        for (const metric of Object.keys(newData)) {
            if (["listingID", "createdAt", "updatedAt"].includes(metric)) { continue; }

            if (processedData[metric] !== undefined) {
                newData[metric] = processedData[metric]
            }
        }

        try {
            listingMetricsRecord.set(newData);
            await listingMetricsRecord.save();

            if (this.cacheData.listingUpdates[listingID] !== undefined) {
                delete this.cacheData.listingUpdates[listingID];
            }
            // console.log("ListingAnalytics record updated:", listingMetricsRecord.toJSON())
            return true;
        } catch (err) {
            return `ERROR: Failed to set data for ListingAnalytics record; error: ${err}`
        }
    }

    static async setRequestMetrics(requestURL, requestMethod, data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (!requestURL || !requestMethod) {
            return "ERROR: Provide a valid request URL and method."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.requestMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.requestMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        const requestMetricsRecord = await this.createRecordIfNotExist("request", null, requestURL, requestMethod);
        if (typeof requestMetricsRecord === "string") {
            return requestMetricsRecord
        }

        var newData = requestMetricsRecord.toJSON()
        for (const metric of Object.keys(newData)) {
            if (["requestURL", "method", "createdAt", "updatedAt"].includes(metric)) { continue; }

            if (processedData[metric] !== undefined) {
                newData[metric] = processedData[metric]
            }
        }

        try {
            requestMetricsRecord.set(newData);
            await requestMetricsRecord.save();

            const requestIdentifier = `${requestMethod}_${requestURL}`
            if (this.cacheData.requestUpdates[requestIdentifier] !== undefined) {
                delete this.cacheData.requestUpdates[requestIdentifier];
            }
            // console.log("RequestAnalytics record updated:", requestMetricsRecord.toJSON())
            return true;
        } catch (err) {
            return `ERROR: Failed to set data for RequestAnalytics record; error: ${err}`
        }
    }

    static async setSystemMetrics(data) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
        }

        if (Object.keys(data).length == 0) {
            return true;
        }

        var processedData = {};
        for (const metric of this.metricRegistry.systemMetrics) {
            if (data[metric] !== undefined) {
                if (!this.nonNumericalMetricRegistry.systemMetrics.includes(metric) && typeof data[metric] !== "number") {
                    return `ERROR: Value of given metric '${metric}' is invalid.`
                }

                processedData[metric] = data[metric]
            }
        }

        const systemMetricsRecord = await this.createRecordIfNotExist("system");
        if (typeof systemMetricsRecord === "string") {
            return systemMetricsRecord
        }

        var newData = systemMetricsRecord.toJSON()
        for (const metric of Object.keys(newData)) {
            if (["instanceID", "createdAt", "updatedAt"].includes(metric)) { continue; }

            if (processedData[metric] !== undefined) {
                newData[metric] = processedData[metric]
            }
        }

        try {
            systemMetricsRecord.set(newData);
            await systemMetricsRecord.save();

            this.cacheData.systemUpdates = {}
            // console.log("SystemAnalytics record updated:", systemMetricsRecord.toJSON())
            return true;
        } catch (err) {
            return `ERROR: Failed to set data for SystemAnalytics record; error: ${err}`
        }
    }

    static async getListingMetrics(listingID = null) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (!listingID) {
            try {
                const listings = await ListingAnalytics.findAll();
                if (!listings || !Array.isArray(listings)) {
                    throw new Error("Failed to retrieve all listings' metrics.")
                }

                return listings.map(listing => listing.toJSON())
            } catch (err) {
                return `ERROR: Failed to retrieve all listings' metrics; error: ${err}`
            }
        } else {
            try {
                const listing = await ListingAnalytics.findByPk(listingID);
                if (!listing) {
                    return "ERROR: Listing metrics record not found."
                }

                return listing.toJSON()
            } catch (err) {
                return `ERROR: Failed to retrieve listing metrics; error: ${err}`
            }
        }
    }

    static async getRequestMetrics(requestURL = null, method = null) {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        if (requestURL && method) {
            try {
                const request = await RequestAnalytics.findOne({
                    where: {
                        requestURL: requestURL,
                        method: method
                    }
                })
                if (!request) {
                    return "ERROR: Request metrics record not found."
                }

                return request.toJSON()
            } catch (err) {
                return `ERROR: Failed to retrieve request metrics; error: ${err}`
            }
        } else {
            try {
                const requests = await RequestAnalytics.findAll();
                if (!requests || !Array.isArray(requests)) {
                    throw new Error("Failed to retrieve all requests' metrics.")
                }

                return requests.map(request => request.toJSON())
            } catch (err) {
                return `ERROR: Failed to retrieve all requests' metrics; error: ${err}`
            }
        }
    }

    static async getSystemMetrics() {
        if (!this.#setup) {
            return "ERROR: Analytics service not yet set up."
        }

        try {
            const systemMetricsRecord = await SystemAnalytics.findByPk(this.#metadata.systemMetricsInstanceID);
            if (!systemMetricsRecord) {
                return "ERROR: System metrics record not found."
            }

            return systemMetricsRecord.toJSON()
        } catch (err) {
            return `ERROR: Failed to retrieve system metrics; error: ${err}`
        }
    }

    static async getAllMetrics() {
        const listingMetricResults = await this.getListingMetrics();
        if (typeof listingMetricResults === "string") {
            return listingMetricResults
        }

        const requestMetricResults = await this.getRequestMetrics();
        if (typeof requestMetricResults === "string") {
            return requestMetricResults
        }

        const systemMetricResults = await this.getSystemMetrics();
        if (typeof systemMetricResults === "string") {
            return systemMetricResults
        }

        var allData = {
            listingMetrics: listingMetricResults,
            requestMetrics: requestMetricResults,
            systemMetrics: systemMetricResults
        }

        return allData;
    }
}

module.exports = Analytics;