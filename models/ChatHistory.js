/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const ChatHistory = sequelize.define("ChatHistory", {
        chatID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        user1ID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        user2ID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, { tableName: 'chatHistories' })

    // Associations
    ChatHistory.associate = (models) => {
        ChatHistory.hasMany(models.ChatMessage, {
            foreignKey: 'chatID',
            onDelete: 'cascade'
        })
    }

    return ChatHistory;
}