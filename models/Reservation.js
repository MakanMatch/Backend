/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Reservation = sequelize.define('Reservation', {
        guestID: {
            type: DataTypes.STRING,
            references: {
                model: 'guests',
                key: 'userID'
            },
            primaryKey: true
        },
        listingID: {
            type: DataTypes.STRING,
            references: {
                model: 'foodListings',
                key: 'listingID'
            },
            primaryKey: true
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

    return Reservation;
};