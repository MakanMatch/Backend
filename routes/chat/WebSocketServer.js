const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage } = require("../../models");
const Universal = require("../../services/Universal");
const Logger = require("../../services/Logger");
const { Op } = require('sequelize');

function startWebSocketServer(app) {
    const PORT = 8080;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const connectedUsers = new Map(); // Map to store user connections and their WebSocket instances
    const userRooms = new Map(); // Map to store user IDs and their associated room IDs
    const chatRooms = new Map(); // Map to store chatID and userIDs in the room

    async function getChatHistoryAndMessages(user1ID, user2ID) {
        try {
            let chatHistory = await ChatHistory.findOne({
                where: {
                    [Op.or]: [
                        { user1ID: user1ID, user2ID: user2ID },
                        { user1ID: user2ID, user2ID: user1ID }
                    ]
                },
            });
    
            if (!chatHistory) {
                chatHistory = await ChatHistory.create({
                    chatID: Universal.generateUniqueID(),
                    user1ID,
                    user2ID,
                    datetime: new Date().toISOString(),
                });
            }
    
            const previousMessages = await ChatMessage.findAll({
                where: { chatID: chatHistory.chatID },
                order: [["datetime", "ASC"]],
            });
    
            const messagesWithReplies = await Promise.all(
                previousMessages.map(async (message) => {
                    let replyToMessage = null;
                    if (message.replyToID) {
                        replyToMessage = await ChatMessage.findByPk(message.replyToID);
                    }
                    return {
                        ...message.get({ plain: true }),
                        replyTo: replyToMessage ? replyToMessage.message : null,
                    };
                })
            );
            const message = JSON.stringify({
                type: "chat_history",
                messages: messagesWithReplies,
            });
    
            broadcastMessage(message, [user1ID, user2ID]);
            return chatHistory.chatID;
        } catch (error) {
            console.error("Error fetching chat history and messages:", error);
            const errorMessage = JSON.stringify({
                action: "error",
                message: "Error fetching chat history and messages",
            });
            broadcastMessage(errorMessage, [user1ID, user2ID]);
        }
    }

    wss.on("connection", (ws) => {
        ws.id = Universal.generateUniqueID();

        ws.on("message", async (message) => {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.action === "connect") {
                const userID = parsedMessage.userID;
                connectedUsers.set(userID, ws);

                // Determine if user joins an existing room or creates a new one
                let roomID;
                if (userRooms.size === 0 || userRooms.size % 2 === 0) {
                    // Create a new room
                    roomID = Universal.generateUniqueID();
                } else {
                    // Join existing room
                    roomID = Array.from(userRooms.values()).pop();
                }
                
                userRooms.set(userID, roomID);

                // Get all users in the current room
                const usersInRoom = Array.from(userRooms.entries())
                    .filter(([_, room]) => room === roomID)
                    .map(([user, _]) => user);

                // Check if the room has exactly two users, then fetch or create chat history
                if (usersInRoom.length === 2) {
                    chatID = await getChatHistoryAndMessages(usersInRoom[0], usersInRoom[1]);
                    chatRooms.set(chatID, usersInRoom); // Store chatID and users in the room
                }

            } else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage);
            } else if (parsedMessage.action === "send") {
                handleMessageSend(parsedMessage);
            } else {
                const jsonMessage = { action: "error", message: "Invalid action" };
                ws.send(JSON.stringify(jsonMessage));
            }
        });

        ws.on("close", () => {
            connectedUsers.forEach((connection, userID) => {
                if (connection === ws) {
                    connectedUsers.delete(userID);
                    userRooms.delete(userID);

                    // Remove the user from the chat room
                    chatRooms.forEach((users, chatID) => {
                        if (users.includes(userID)) {
                            users.splice(users.indexOf(userID), 1);
                            if (users.length === 0) {
                                chatRooms.delete(chatID); // Remove the chat room if no users are left
                            } else {
                                broadcastMessage(JSON.stringify({ action: "user_left", userID }), users);
                            }
                        }
                    });
                }
            });
        });
    });

    wss.on("error", (error) => {
        console.error("WebSocket server error:", error);
        Logger.log("CHAT WEBSOCKETSERVER ERROR: WebSocket server error: " + error);
    });

    async function handleEditMessage(editedMessage) {
        const messageId = editedMessage.id;
        if (!messageId) {
            const jsonMessage = { action: "error", message: "ID not provided" };
            broadcastMessage(jsonMessage);
            return;
        }

        try {
            const findMessage = await ChatMessage.findByPk(messageId);
            if (!findMessage) {
                const jsonMessage = { action: "error", message: "Message not found" };
                broadcastMessage(jsonMessage);
                return;
            }

            findMessage.message = editedMessage.message;
            findMessage.edited = true;
            await findMessage.save();

            const responseMessage = { action: "edit", message: findMessage };
            const users = chatRooms.get(findMessage.chatID);
            broadcastMessage(JSON.stringify(responseMessage), users);

        } catch (error) {
            console.error("Error editing message:", error);
        }
    }

    async function handleDeleteMessage(deletedMessage) {
        const messageId = deletedMessage.id;
        if (!messageId) {
            const jsonMessage = { action: "error", message: "ID not provided" };
            broadcastMessage(jsonMessage);
            return;
        }

        try {
            const findMessage = await ChatMessage.findByPk(messageId);
            if (!findMessage) {
                const jsonMessage = { action: "error", message: "Message not found" };
                broadcastMessage(jsonMessage);
                return;
            }
            await findMessage.destroy();

            const jsonMessage = { action: "delete", id: messageId };
            const users = chatRooms.get(findMessage.chatID);
            broadcastMessage(JSON.stringify(jsonMessage), users);

        } catch (error) {
            console.error("Error deleting message:", error);
            Logger.log("CHAT WEBSOCKETSERVER ERROR: Error deleting message: " + error);
            const jsonMessage = { action: "error", message: "Error occurred while deleting message" };
            broadcastMessage(jsonMessage);
        }
    }

    async function handleMessageSend(parsedMessage) {
        try {
            let replyToMessage = null;
            if (parsedMessage.replyToID) {
                replyToMessage = await ChatMessage.findByPk(parsedMessage.replyToID);
                if (!replyToMessage) {
                    const jsonMessage = { action: "error", message: "Reply to message not found" };
                    ws.send(JSON.stringify(jsonMessage));
                    return;
                }
            }

            const createdMessage = await ChatMessage.create({
                messageID: Universal.generateUniqueID(),
                message: parsedMessage.message,
                sender: parsedMessage.sender,
                datetime: parsedMessage.datetime,
                chatID: chatID,
                replyToID: replyToMessage ? replyToMessage.messageID : null,
                edited: false,
            });

            const responseMessage = {
                ...createdMessage.get({ plain: true }),
                replyTo: replyToMessage ? replyToMessage.message : null,
            };

            const users = chatRooms.get(createdMessage.chatID);
            broadcastMessage(JSON.stringify(responseMessage), users);
        } catch (error) {
            console.error("Error creating message:", error);
        }
    }

    function broadcastMessage(message, userIDs = []) {
        connectedUsers.forEach((ws, userID) => {
            if (userIDs.length === 0 || userIDs.includes(userID)) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            }
        });
    }

    server.listen(PORT, () => {
        console.log("WebSocket Server running on port ${PORT}");
    });
}

module.exports = startWebSocketServer;