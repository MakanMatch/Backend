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
        from: {
            type: DataTypes.STRING,
            allowNull: false
        },
        datetime: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, { tableName: 'chatMessages' })

    // Associations
    ChatMessage.associate = (models) => {
        ChatMessage.belongsTo(models.ChatHistory)
    }

    return ChatMessage;
}