/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const RequestAnalytics = sequelize.define("RequestAnalytics", {
        requestURL: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        method: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        requestsCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        successResponses: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        lastRequest: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, { tableName: 'requestAnalytics' })

    // Associations

    return RequestAnalytics;
}