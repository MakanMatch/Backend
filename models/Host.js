module.exports = (sequelize, DataTypes) => {
    const Host = sequelize.define("Host", {
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
            allowNull: false
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
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
            allowNull: true,
            defaultValue: 0
        },
        foodRating: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        hygieneGrade: {
            type: DataTypes.DOUBLE,
            allowNull: true
        },
        paymentImage: {
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
    }, { tableName: 'hosts' })

    // Associations
    Host.associate = (models) => {
        Host.hasMany(models.FoodListing, {
            foreignKey: "hostID",
            onDelete: "cascade"
        })
    }

    return Host;
}