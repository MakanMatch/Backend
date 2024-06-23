'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config()
const process = require('process');
const FileOps = require('../services/FileOps');
const basename = path.basename(__filename);
const env = process.env.DB_CONFIG || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

if (config.logging && config.useFileLogging == true) {
    config.logging = (msg) => {
        const date = new Date().toISOString()
        FileOps.appendTo("sqlQueries.txt", `${date} - ${msg}\n`)
    }
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
