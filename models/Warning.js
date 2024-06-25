// Warning(adminID, hostID, reason, datetime, acknowledged)
// PK: (adminID, hostID)
// FK: 
// -	adminID references Admin(userID)
// -	hostID references Host(userID)

/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Warning = sequelize.define("Warning", {
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        },
        acknowledged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
    }, { tableName: 'warnings' })

    // Associations
    // Warning.associate = (models) => {

    // }

    return Warning;
}