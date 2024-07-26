const { v4: uuidv4 } = require('uuid');
const Logger = require('../services/Logger');

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Guest = sequelize.define('Guest', {
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
        favCuisine: {
            type: DataTypes.STRING,
            allowNull: true
        },
        mealsMatched: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
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
        }
    }, { tableName: 'guests' })

    // Associations
    Guest.associate = (models) => {
        Guest.belongsToMany(models.FoodListing, {
            through: models.Reservation,
            foreignKey: "guestID"
        })

        // Like relationship
        Guest.belongsToMany(models.Review, {
            through: models.ReviewLike,
            as: "likes",
            foreignKey: 'guestID'
        })

        // Review poster relationship
        Guest.hasMany(models.Review, {
            onDelete: "cascade"
        })
    }

    Guest.hook = (models) => {
        Guest.afterCreate("createUserRecord", async (guest, options) => {
            try {
                await models.UserRecord.create({
                    recordID: uuidv4(),
                    hID: null,
                    gID: guest.userID,
                    aID: null
                })
            } catch (err) {
                Logger.log(`SEQUELIZE GUEST AFTERCREATE HOOK ERROR: Failed to auto-create UserRecord for new Guest with ID ${guest.userID}; error: ${err}`)
            }
        })
    }

    return Guest;
}