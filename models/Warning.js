// Warning(issuingAdminID, hostID, reason, datetime)
// PK: (issuingAdminID, hostID)
// FK: 
// -	issuingAdminID references Admin(userID)
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
        }
    }, { tableName: 'warnings' })

    // Associations
    // Warning.associate = (models) => {

    // }

    return Warning;
}