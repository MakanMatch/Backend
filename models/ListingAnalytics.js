/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const ListingAnalytics = sequelize.define("ListingAnalytics", {
        listingID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        impressions: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        clicks: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, { tableName: 'listingAnalytics' })

    // Associations

    return ListingAnalytics;
}