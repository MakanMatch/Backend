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

        // Like relationship (reviews can get many likes from guests)
        Review.belongsToMany(models.Guest, {
            through: models.ReviewLike,
            as: "likes",
            foreignKey: 'reviewID'
        })

        // Original poster relationship (a review is posted by a guest)
        Review.belongsTo(models.Guest, {
            foreignKey: 'guestID',
            as: 'reviewPoster'
        })
    }

    return Review;
}