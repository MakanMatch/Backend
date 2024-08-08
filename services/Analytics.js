const { SystemAnalytics, ListingAnalytics, RequestAnalytics } = require('../models')
const Universal = require('./Universal')
const prompt = require("prompt-sync")({ sigint: true });

require('dotenv').config()

class Analytics {
    static #setup = false
    static #metadata = {
        systemMetricsInstance: null,
        updatePersistenceInterval: 50,
        lastUpdate: null,
        updates: 0
    }
    static cacheData = {
        listingUpdates: {},
        reqeustUpdates: {},
        systemUpdates: {}
    }

    static metricRegistry = {
        listingMetrics: ["impressions", "clicks"],
        requestMetrics: ["requestsCount", "successResponses", "lastRequest"],
        systemMetrics: ["lastBoot", "totalRequests", "accountCreations", "listingCreations", "emailDispatches", "logins"]
    }

    static nonNumericalMetricRegistry = {
        listingMetrics: [],
        requestMetrics: ["lastRequest"],
        systemMetrics: ["lastBoot"]
    }

    static checkPermission() {
        return process.env.ANALYTICS_ENABLED === "True"
    }

    static async setup(updatePersistenceInterval = 50) {
        if (!this.checkPermission()) {
            return "ERROR: Analytics service operation permission denied."
        }

        // Load data from SQL tables
        const systemSetupResult = this.createRecordIfNotExist("system");
        if (systemSetupResult !== true) {
            return systemSetupResult
        }
    }

    static async createRecordIfNotExist(mode = "system", listingID = null, requestURL = null, requestMethod = null) {
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
                    console.log("Metric record not found, creating...")
                    // Create new system metrics record
                    systemMetricsInstance = await SystemAnalytics.create({ instanceID: Universal.generateUniqueID() })
                    if (!systemMetricsInstance) {
                        throw new Error("Creation of default SystemAnalytics instance failed.")
                    }

                    console.log("Created new metric instance with ID:", systemMetricsInstance.instanceID);
                    this.#metadata.systemMetricsInstance = systemMetricsInstance.instanceID;
                } else {
                    console.log("Attaching to latest system metrics instance with ID:", systemMetrics[0].instanceID)
                    systemMetricsInstance = systemMetrics[0];
                    this.#metadata.systemMetricsInstance = systemMetricsInstance.instanceID;
                }

                return systemMetricsInstance;
            } else if (mode == "listing") {
                if (!listingID) {
                    throw new Error("Listing ID not provided.")
                }

                var listingMetrics = await ListingAnalytics.findByPk(listingID);
                if (!listingMetrics) {
                    console.log("Creating new listing metrics record...")
                    listingMetrics = await ListingAnalytics.create({ listingID: listingID })
                    if (!listingMetrics) {
                        throw new Error("Failed to create new listing metrics record.")
                    }
                } else {
                    console.log(`Found existing listing metrics record for listing: ${listingID}`)
                }

                return listingMetrics;
            } else if (mode == "request") {
                if (!requestURL || !requestMethod) {
                    throw new Error("Request URL or method not provided.")
                }

                var requestMetrics = await RequestAnalytics.findOne({
                    where: {
                        requestURL: requestURL,
                        requestMethod: requestMethod
                    }
                })
                if (!requestMetrics) {
                    console.log("Creating new request metrics record...")
                    requestMetrics = await RequestAnalytics.create({ requestURL: requestURL, requestMethod: requestMethod })
                    if (!requestMetrics) {
                        throw new Error("Failed to create new request metrics record.")
                    }
                } else {
                    console.log(`Found existing request metrics record for request: ${requestURL} (${requestMethod})`)
                }

                return requestMetrics;
            }

            return `ERROR: Invalid mode '${mode}' provided.`
        } catch (err) {
            return `ERROR: Failed to check existing record and create if not found; error: ${err}`
        }
    }

    static async persistData() {
        // Process listing metrics
        for (const listingID of Object.keys(this.cacheData.listingUpdates)) {
            var listingMetricsRecord = await this.createRecordIfNotExist("listing", listingID);
            if (typeof listingMetricsRecord === "string") {
                return listingMetricsRecord
            }

            var newData = listingMetricsRecord.toJSON()
            for (const metric of Object.keys(this.cacheData.listingUpdates[listingID])) {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric)) {
                    newData[metric] += this.cacheData.listingUpdates[listingID][metric]
                } else {
                    newData[metric] = this.cacheData.listingUpdates[listingID][metric]
                }
            }

            try {
                listingMetricsRecord.set(newData);
                await listingMetricsRecord.save();
                console.log("ListingAnalytics record updated:", listingMetricsRecord.toJSON())
                this.cacheData.listingUpdates[listingID] = {}
                console.log(`Listing updates for ID ${listingID} reset:`, this.cacheData.listingUpdates)
            } catch (err) {
                return `ERROR: Failed to persist ListingAnalytics updates for ID ${listingID}; error: ${err}`
            }
        }

        // Process request metrics
        for (const requestIdentifier of Object.keys(this.cacheData.reqeustUpdates)) {
            const requestMethod = requestIdentifier.split("_")[0]
            const requestURL = requestIdentifier.split("_")[1]

            var requestMetricsRecord = await this.createRecordIfNotExist("request", null, requestURL, requestMethod);
            if (typeof requestMetricsRecord === "string") {
                return requestMetricsRecord
            }

            var newData = requestMetricsRecord.toJSON()
            for (const metric of Object.keys(this.cacheData.reqeustUpdates[requestIdentifier])) {
                if (!this.nonNumericalMetricRegistry.requestMetrics.includes(metric)) {
                    newData[metric] += this.cacheData.reqeustUpdates[requestIdentifier][metric]
                } else {
                    newData[metric] = this.cacheData.reqeustUpdates[requestIdentifier][metric]
                }
            }

            try {
                requestMetricsRecord.set(newData);
                await requestMetricsRecord.save();
                console.log("RequestAnalytics record updated:", requestMetricsRecord.toJSON())
                this.cacheData.reqeustUpdates[requestIdentifier] = {}
                console.log(`Request updates for URL ${requestURL} (${requestMethod}) reset:`, this.cacheData.reqeustUpdates)
            } catch (err) {
                return `ERROR: Failed to persist RequestAnalytics updates for identifier ${requestIdentifier}; error: ${err}`
            }
        }

        // Process system metrics
        if (Object.keys(this.cacheData.systemUpdates).length !== 0) {
            var systemAnalyticsRecord = await this.createRecordIfNotExist("system");
            if (typeof systemAnalyticsRecord === "string") {
                return systemAnalyticsRecord
            }

            var newData = systemAnalyticsRecord.toJSON()
            console.log("Retrieved data:", newData)
            for (const metric of Object.keys(this.cacheData.systemUpdates)) {
                if (!this.nonNumericalMetricRegistry.systemMetrics.includes(metric)) {
                    console.log(`Updating numerical metric ${metric} with incoming value ${this.cacheData.systemUpdates[metric]}; new value: ${newData[metric] + this.cacheData.systemUpdates[metric]}`)
                    newData[metric] += this.cacheData.systemUpdates[metric]
                } else {
                    console.log(`Updating non-numerical metric ${metric} with incoming value ${this.cacheData.systemUpdates[metric]}; old value: ${newData[metric]}`)
                    newData[metric] = this.cacheData.systemUpdates[metric]
                }
            }

            try {
                systemAnalyticsRecord.set(newData);
                await systemAnalyticsRecord.save();
                console.log("SystemAnalytics record updated:", systemAnalyticsRecord.toJSON())
                this.cacheData.systemUpdates = {}
                console.log("System updates reset:", this.cacheData.systemUpdates)
            } catch (err) {
                return `ERROR: Failed to persist SystemAnalytics updates; error: ${err}`
            }
        }

        this.#metadata.updates = 0
        return true;
    }

    static async checkForUpdates() {
        // prompt("Continue? ");
        await this.persistData()
    }

    static async supplementListingMetricUpdate(requestURL, requestMethod, data) {
        if (!requestURL || !requestMethod) {
            return "ERROR: Provide a valid request URL and method."
        }

        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
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

        const requestIdentifier = `${requestMethod}_${requestURL}`

        if (this.cacheData.listingUpdates[requestIdentifier] == undefined) {
            this.cacheData.listingUpdates[requestIdentifier] = {}
        }
        for (const metric of Object.keys(processedData)) {
            // If metric doesn't exist, create and set to incoming value
            if (this.cacheData.listingUpdates[requestIdentifier][metric] === undefined) {
                this.cacheData.listingUpdates[requestIdentifier][metric] = processedData[metric]
            } else {
                if (!this.nonNumericalMetricRegistry.listingMetrics.includes(metric)) {
                    // If metric exists, and is not one of the non-integer metrics, add the incoming value to the existing value
                    this.cacheData.listingUpdates[requestIdentifier][metric] += processedData[metric]
                } else {
                    // If metric is a non-integer metric, replace the existing with the incoming value
                    this.cacheData.listingUpdates[requestIdentifier][metric] = processedData[metric]
                }
            }   
        }

        this.#metadata.updates += 1
        this.#metadata.lastUpdate = new Date().toISOString()
        await this.checkForUpdates();
        return true;
    }

    static supplementRequestMetricUpdate() {

    }

    static async supplementSystemMetricUpdate(data) {
        if (Array.isArray(data) || typeof data !== "object") {
            return "ERROR: Invalid data input. Input must be in the form of key-value attributes only."
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
                const systemMetricsInstance = await SystemAnalytics.findByPk(this.#metadata.systemMetricsInstance);
                if (!systemMetricsInstance) {
                    return "ERROR: Failed to retrieve SystemAnalytics record for reset."
                }

                systemMetricsInstance.set({
                    lastBoot: null,
                    totalRequests: 0,
                    accountCreations: 0,
                    listingCreations: 0,
                    emailDispatches: 0,
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

    static setListingMetrics() {

    }

    static setRequestMetrics() {

    }

    static setSystemMetrics() {

    }

    static getListingMetrics() {

    }

    static getRequestMetrics() {

    }

    static getSystemMetrics() {

    }

    static getAllMetrics() {

    }
}

module.exports = Analytics;