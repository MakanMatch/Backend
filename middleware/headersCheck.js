require('dotenv').config()

const checkHeaders = (req, res, next) => {
    if (req.headers["content-type"] !== "application/json") {
        res.status(400).send("ERROR: Invalid request headers.")
        return
    } else if (process.env.API_KEY != undefined) {
        if (req.headers["mmapikey"] !== process.env.API_KEY) {
            res.status(400).send("ERROR: Invalid request headers.")
            return
        }
    }
    next()
}

module.exports = checkHeaders;