/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const SystemAnalytics = sequelize.define("SystemAnalytics", {
        instanceID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        lastBoot: {
            type: DataTypes.STRING,
            allowNull: true
        },
        totalRequests: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        accountCreations: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        listingCreations: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        emailDispatches: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        logins: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, { tableName: 'systemAnalytics' })

    // Associations

    return SystemAnalytics;
}