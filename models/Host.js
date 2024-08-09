const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Host = sequelize.define("Host", {
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
            allowNull: false
        },
        approxAddress: {
            type: DataTypes.STRING,
            allowNull: false
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        approxCoordinates: {
            type: DataTypes.STRING,
            allowNull: false
        },
        coordinates: {
            type: DataTypes.STRING,
            allowNull: false
        },
        emailVerified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        emailVerificationTime: {
            type: DataTypes.STRING,
            allowNull: true
        },
        favCuisine: {
            type: DataTypes.STRING,
            allowNull: true
        },
        mealsMatched: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        foodRating: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: 0
        },
        hygieneGrade: {
            type: DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: 0
        },
        paymentImage: {
            type: DataTypes.STRING,
            allowNull: true
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
        },
        emailVerificationToken: {
            type: DataTypes.STRING,
            allowNull: true
        },
        emailVerificationTokenExpiration: {
            type: DataTypes.STRING,
            allowNull: true
        },
        reviewsCount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        flaggedForHygiene: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, { tableName: 'hosts' })

    // Associations
    Host.associate = (models) => {
        Host.hasMany(models.FoodListing, {
            foreignKey: "hostID"
        })

        Host.hasMany(models.Review)

        Host.belongsToMany(models.Admin, {
            through: models.Warning,
            as: "warnings",
            foreignKey: "hostID"
        })
    }

    Host.hook = (models) => {
        Host.afterCreate("createUserRecord", async (host, options) => {
            try {
                await models.UserRecord.create({
                    recordID: uuidv4(),
                    hID: host.userID,
                    gID: null,
                    aID: null
                })
            } catch (err) {
                Logger.log(`SEQUELIZE HOST AFTERCREATE HOOK ERROR: Failed to auto-create UserRecord for new Host with ID ${host.userID}; error: ${err}`)
            }
        })
    }

    return Host;
}