/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Review = sequelize.define("Review", {
        reviewID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        foodRating: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        hygieneRating: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        comments: {
            type: DataTypes.STRING,
            allowNull: true
        },
        images: {
            type: DataTypes.STRING,
            allowNull: true
        },
        likeCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        dateCreated: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, { tableName: 'reviews' })

    // Associations
    Review.associate = (models) => {
        Review.belongsTo(models.Host, {
            foreignKey: 'hostID',
            as: 'host'
        }),
        Review.belongsTo(models.Guest, {
            foreignKey: 'guestID',
            as: 'guest'
        }),
        Review.hasMany(models.Like, {
            foreignKey: 'guestID',
            as: 'likes'
        });
    }

    return Review;
}