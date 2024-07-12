/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const FoodListing = sequelize.define("FoodListing", {
        listingID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        images: {
            type: DataTypes.STRING,
            allowNull: true
        },
        shortDescription: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        longDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        portionPrice: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        approxAddress: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        totalSlots: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        },
        published: {
            type: DataTypes.BOOLEAN,
            alowNull: false,
            defaultValue: false
        }
    }, { tableName: 'foodListings' })

    // Associations
    FoodListing.associate = (models) => {
        FoodListing.belongsTo(models.Host, {
            foreignKey: "hostID",
            onDelete: "cascade"
        })
        FoodListing.belongsToMany(models.Guest, {
            through: models.Reservation,
            as: "guests",
            foreignKey: "listingID"
        })
    }

    return FoodListing;
}