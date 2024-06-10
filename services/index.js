const fs = require('fs');
const path = require('path');

services = {}

fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .forEach(file => {
        const service = require(path.join(__dirname, file));
        if (service.name != undefined) {
            services[service.name] = service;
        }
    })

module.exports = services;