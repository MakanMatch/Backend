/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const UserRecord = sequelize.define('UserRecord', {
        recordID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        hostID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'hosts',
                key: 'userID'
            },
            onDelete: 'cascade',
            onUpdate: 'cascade'
        },
        guestID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'guests',
                key: 'userID'
            },
            onDelete: 'cascade',
            onUpdate: 'cascade'
        },
        adminID: {
            type: DataTypes.STRING,
            allowNull: true,
            references: {
                model: 'admins',
                key: 'userID'
            },
            onDelete: 'cascade',
            onUpdate: 'cascade'
        }
    }, { tableName: 'userRecords' })

    // Associations
    UserRecord.associate = (models) => {
        UserRecord.belongsToMany(models.FoodListing, {
            through: models.FavouriteListing,
            as: 'favourites',
            foreignKey: 'userRecordID'
        })
    }

    return UserRecord;
}