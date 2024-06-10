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
            allowNull: true,
            defaultValue: "Not Provided"
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "Not Provided"
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
    }, { tableName: 'guests'})

    // Associations

    return Guest;
}