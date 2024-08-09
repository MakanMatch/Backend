const accountCreation = require("./accountCreation");
const accountLogin = require("./accountLogin");
const newListing = require("./newListing");

const processors = {
    accountCreation,
    accountLogin,
    newListing
}

function runProcessors(requestURL, parsedBody) {
    Object.values(processors).forEach(processor => {
        processor(requestURL, parsedBody);
    });
}

module.exports = { ...processors, runProcessors }