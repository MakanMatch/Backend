module.exports = (sequelize, DataTypes) => {
    const Reservation = sequelize.define('Reservation', {
        guestID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        listingID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        },
        portions: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        totalPrice: {
            type: DataTypes.DOUBLE,
            allowNull: false
        },
        markedPaid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        paidAndPresent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, { tableName: 'reservations' });

    // Associations
    // Reservation.associate = (models) => {
    //     // Reservation.belongsTo(models.Guest, {
    //     //     foreignKey: "guestID",
    //     //     as: "guest"
    //     // });
    //     // Reservation.belongsTo(models.FoodListing, {
    //     //     foreignKey: "listingID",
    //     //     as: "listing"
    //     // });
    //     Reservation.belongsTo(models.Guest, {foreignKey: 'guestID'})
    //     Reservation.belongsTo(models.FoodListing, {foreignKey: 'listingID'})
    // }

    return Reservation;
};