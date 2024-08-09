const fs = require('fs');
const path = require('path');
const BootCheck = require('./BootCheck');
const Cache = require('./Cache');
const Emailer = require('./Emailer');
const Encryption = require('./Encryption');
const Extensions = require('./Extensions');
const FileOps = require('./FileOps');
const FireStorage = require('./FireStorage');
const HTMLRenderer = require('./HTMLRenderer');
const Logger = require('./Logger');
const TokenManager = require('./TokenManager');
const Universal = require('./Universal');
const FileManager = require('./FileManager');
const Analytics = require('./Analytics');

const services = {
    Analytics,
    BootCheck,
    Cache,
    Emailer,
    Encryption,
    Extensions,
    FileManager,
    FileOps,
    FireStorage,
    HTMLRenderer,
    Logger,
    TokenManager,
    Universal
};

fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .forEach(file => {
        const service = require(path.join(__dirname, file));
        if (service.name != undefined && services[service.name] == undefined) {
            services[service.name] = service;
        }
    })

module.exports = services;