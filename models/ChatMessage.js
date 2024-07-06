/**
 * 
 * @param {import('sequelize').Sequelize} sequelize 
 * @param {import('sequelize').DataTypes} DataTypes 
 * @returns 
 */
module.exports = (sequelize, DataTypes) => {
    const ChatMessage = sequelize.define("ChatMessage", {
        messageID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true
        },
        message: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sender: {
            type: DataTypes.STRING,
            allowNull: false
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        },
        replyToID: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, { tableName: 'chatMessages' })

    // Associations
    ChatMessage.associate = (models) => {
        ChatMessage.belongsTo(models.ChatHistory)
    }

    return ChatMessage;
}