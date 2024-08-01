const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Admin = sequelize.define('Admin', {
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        fname: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lname: {
            type: DataTypes.STRING,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        contactNum: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        emailVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false
        },
        profilePicture: {
            type: DataTypes.STRING,
            allowNull: true
        },
        resetKey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        resetKeyExpiration: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, { tableName: 'admins' });

    // Associations
    Admin.associate = (models) => {
        Admin.belongsToMany(models.Host, {
            through: models.Warning,
            as: "warnings"
        })
    }

    Admin.hook = (models) => {
        Admin.afterCreate("createUserRecord", async (admin, options) => {
            try {
                await models.UserRecord.create({
                    recordID: uuidv4(),
                    hID: null,
                    gID: null,
                    aID: admin.userID
                })
            } catch (err) {
                Logger.log(`SEQUELIZE ADMIN AFTERCREATE HOOK ERROR: Failed to auto-create UserRecord for new Admin with ID ${admin.userID}; error: ${err}`)
            }
        })
    }

    return Admin;
}