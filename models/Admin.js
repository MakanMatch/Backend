/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Admin = sequelize.define('Admin', {
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
        role: {
            type: DataTypes.STRING,
            allowNull: false
        },
        resetKey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        resetKeyExpiration: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, { tableName: 'admins' });

    // Associations
    Admin.associate = (models) => {
        Admin.belongsToMany(models.Host, {
            through: models.Warning,
            as: "warnings"
        })
    }

    return Admin;
}