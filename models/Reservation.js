/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const Reservation = sequelize.define('Reservation', {
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