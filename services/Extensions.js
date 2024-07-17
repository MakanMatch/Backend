class Extensions {
    /**
     * Filter a dictionary with a predicate.
     * Example Usage: `Extensions.filterDictionary(dictionary, (key, value) => key.startsWith('a'))`
     * @param {object} dictionary 
     * @param {function(string, string)} predicate 
     * @returns object
     */
    static filterDictionary = (dictionary, predicate) => {
        return Object.fromEntries(Object.entries(dictionary).filter(([k, v]) => predicate(k, v)))
    }

    static timeDiffInSeconds(beforeDate, afterDate) {
        return (afterDate.getTime() - beforeDate.getTime()) / 1000;
    }

    static sanitiseData(data, allowedKeys, allowedTopLevelKeys=[]) {
        var dataToReturn = {}
        for (let attribute of Object.keys(data)) {
            if (allowedTopLevelKeys.includes(attribute)) {
                dataToReturn[attribute] = data[attribute]
            } else if (Array.isArray(data[attribute])) {
                var sanitisedArray = []
                for (let item of data[attribute]) {
                    if (item instanceof Object) {
                        sanitisedArray.push(Extensions.sanitiseData(item, allowedKeys, allowedTopLevelKeys))
                    } else {
                        sanitisedArray.push(item)
                    }
                }
                dataToReturn[attribute] = sanitisedArray
            } else if (data[attribute] instanceof Object) {
                dataToReturn[attribute] = Extensions.sanitiseData(data[attribute], allowedKeys, allowedTopLevelKeys)
            } else {
                if (allowedKeys.includes(attribute)) {
                    dataToReturn[attribute] = data[attribute]
                }
            }
        }
        return dataToReturn
    }
}

module.exports = Extensions;