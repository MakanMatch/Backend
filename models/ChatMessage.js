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
        image:{
            type: DataTypes.STRING,
            allowNull: true
        },
        senderID: {
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
        },
        edited: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, { tableName: 'chatMessages' })

    // Associations
    ChatMessage.associate = (models) => {
        ChatMessage.belongsTo(models.ChatHistory, {
            foreignKey: "chatID"
        })
    }

    return ChatMessage;
}