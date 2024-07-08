/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Like = sequelize.define("Like", {
        likeID: {
            type: DataTypes.STRING,
            primaryKey: true
        },
        reviewID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'reviews',
                key: 'reviewID'
            }
        },
        guestID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'guests',
                key: 'userID'
            }
        }
    }, { tableName: 'likes' });

    // Associations
    Like.associate = (models) => {
        Like.belongsTo(models.Review, {
            foreignKey: 'reviewID',
            as: 'review'
        });
        Like.belongsTo(models.Guest, {
            foreignKey: 'guestID',
            as: 'user'
        });
    }

    return Like;
}
