'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config()
const process = require('process');
const FileOps = require('../services/FileOps');
const Universal = require('../services/Universal');
const basename = path.basename(__filename);
const env = process.env.DB_CONFIG || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

if (config.logging == true) {
    if (config.loggingOptions != undefined) {
        var queryLogsFile = "sqlQueries.txt"
        if (config.loggingOptions["logsFile"] !== undefined) { queryLogsFile = config.loggingOptions["logsFile"] }

        if (config.loggingOptions["useFileLogging"] === true) {
            if (config.loggingOptions["clearUponBoot"] === true) { FileOps.writeTo(queryLogsFile, "") }
            // Log SQL query executions to a file
            config.logging = (msg) => {
                // Check whether post-boot executions are to be logged only (Use Universal.booted to check if system has booted)
                if (config.loggingOptions["logPostBootOnly"] === true && Universal.booted !== true) { return }
                const date = new Date().toISOString()
                FileOps.appendTo(queryLogsFile, `${date} - ${msg}\n`)
            }
        } else {
            // Log normally to console
            config.logging = (msg) => {
                // Check whether post-boot executions are to be logged only (Use Universal.booted to check if system has booted)
                if (config.loggingOptions["logPostBootOnly"] === true && Universal.booted !== true) { return }
                console.log(msg)
            }
        }
    }
    // If logging options not provided, sequelize will default to console.log
}

let sequelize;
if (process.env.DB_MODE == "mysql") {
    if (config.use_env_variable) {
        sequelize = new Sequelize(process.env[config.use_env_variable], config);
    } else {
        sequelize = new Sequelize(config.database, config.username, config.password, config);
    }
} else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        logging: config["logging"]
    })
}

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js' &&
            file.indexOf('.test.js') === -1
        );
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
