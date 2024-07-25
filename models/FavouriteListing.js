/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const FavouriteListing = sequelize.define("FavouriteListing", {
        listingID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'foodListings',
                key: 'listingID'
            },
            primaryKey: true
        },
        userRecordID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'userRecords',
                key: 'recordID'
            },
            primaryKey: true,
            onDelete: 'cascade'
        }
    }, { tableName: 'favouriteListings' });

    // Associations

    return FavouriteListing;
}