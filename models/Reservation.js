module.exports = (sequelize, DataTypes) => {
    const Reservation = sequelize.define('Reservation', {
        guestID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        listingID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        portions: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        totalPrice: {
            type: DataTypes.DOUBLE,
            allowNull: false,
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

    return Reservation;
};