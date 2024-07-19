/**
 * Just few lines to test behaviour of TokenGenerator
 */

const TokenManager = require('../services/TokenManager');
const jwt = require('jsonwebtoken');

const tokenManager = new TokenManager('a', 60 * 9, { expiresIn: '10m' });
var token = tokenManager.sign({ myclaim: 'something' })
console.log(token)
console.log(tokenManager.verify(token, false, true))
setTimeout(function () {
    try {
        var token2 = tokenManager.refresh(token)
    } catch (err) {
        console.log(err)
        process.exit();
    }
    console.log(jwt.decode(token, { complete: true }))
    console.log(jwt.decode(token2, { complete: true }))
}, 3000)