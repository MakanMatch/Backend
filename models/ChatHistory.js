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
        user1ID: { // Host ID
            type: DataTypes.STRING,
            allowNull: false
        },
        user2ID: { // Guest ID
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
            as: "messages",
            onDelete: 'cascade'
        })
    }

    return ChatHistory;
}