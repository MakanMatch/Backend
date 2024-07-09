/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const ReviewLike = sequelize.define("ReviewLike", {
        reviewID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'reviews',
                key: 'reviewID'
            },
            primaryKey: true
        },
        guestID: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'guests',
                key: 'userID'
            },
            primaryKey: true
        }
    }, { tableName: 'reviewLikes' });

    // Associations

    return ReviewLike;
}
