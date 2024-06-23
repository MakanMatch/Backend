module.exports = (sequelize, DataTypes) => {
    const Guest = sequelize.define('Guest', {
        userID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
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
        }
    }, { tableName: 'guests' })

    // Associations
    // Guest.associate = (models) => {
    //     Guest.belongsToMany(models.FoodListing, {
    //         through: 'Reservation',
    //         foreignKey: 'guestID',
    //         as: 'reservations'
    //     })
    // }

    return Guest;
}