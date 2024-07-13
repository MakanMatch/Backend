const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage } = require("../../models");
const Universal = require("../../services/Universal");
const Logger = require("../../services/Logger");

function startWebSocketServer(app) {
    const PORT = 8080;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const clients = [];
    const connectedUsers = new Map();
    let chatID = null;

    async function getChatHistoryAndMessages(user1ID, user2ID) {
        try {
            // Check if a ChatHistory exists between user1 and user2
            let chatHistory = await ChatHistory.findOne({
                where: {
                    user1ID,
                    user2ID,
                },
            });

            if (!chatHistory) {
                // Create a new ChatHistory if it doesn't exist
                chatHistory = await ChatHistory.create({
                    chatID: Universal.generateUniqueID(),
                    user1ID,
                    user2ID,
                    datetime: new Date().toISOString(), // Replace with current datetime logic
                });
            }

            // Fetch previous chat messages
            const previousMessages = await ChatMessage.findAll({
                where: {
                    chatID: chatHistory.chatID,
                },
                order: [["datetime", "ASC"]], // Order messages by datetime ascending
            });

            // Fetch replyTo message content for each message
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

            // Prepare the message to broadcast
            const message = JSON.stringify({
                type: "chat_history",
                messages: messagesWithReplies,
            });

            // Broadcast the message to all clients
            broadcastMessage(message);
            return chatHistory.chatID;
        } catch (error) {
            console.error("Error fetching chat history and messages:", error);
        }
    }

    wss.on("connection", async (ws) => {
        console.log("WS connection arrived");

        // Store the WebSocket connection in an array
        clients.push(ws);

        // Handle WebSocket message events
        ws.on("message", async (message) => {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.action === "connect"){
              const userID = parsedMessage.userID;
              connectedUsers.set(userID, ws);
              if (connectedUsers.size === 2) {
                  const users = Array.from(connectedUsers.keys());
                  console.log("Users connected:", users);
                  chatID = await getChatHistoryAndMessages(users[0], users[1]);
              }
            }
            else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage);
            } else if (parsedMessage.action === "send") {
                try {
                    var replyToMessage;
                    if (parsedMessage.replyToID) {
                        replyToMessage = await ChatMessage.findByPk(parsedMessage.replyToID);
                        if (replyToMessage.messageID === null) {
                            const jsonMessage = {
                                action: "error",
                                message: "Reply to message not found",
                            };
                            broadcastMessage(JSON.stringify(jsonMessage));
                            return;
                        }
                    }

                    // Create ChatMessage in the database
                    const createdMessage = await ChatMessage.create({
                        messageID: Universal.generateUniqueID(),
                        message: parsedMessage.message,
                        sender: parsedMessage.sender,
                        datetime: parsedMessage.datetime,
                        chatID: chatID,
                        replyToID: parsedMessage.replyToID ? replyToMessage.messageID: null,
                        edited: false,
                    });

                    // Include the replyTo message content in the response
                    const responseMessage = {
                        ...createdMessage.get({ plain: true }),
                        replyTo: parsedMessage.replyToID ? replyToMessage.message: null,
                    };

                    // Broadcast the message to all clients
                    broadcastMessage(JSON.stringify(responseMessage), ws);
                } catch (error) {
                    console.error("Error creating message:", error);
                }
            } else {
                const jsonMessage = {
                    action: "error",
                    message: "Invalid action",
                };
                broadcastMessage(JSON.stringify(jsonMessage));
            }
        });

        ws.on("close", () => {
            const index = clients.indexOf(ws);
            if (index > -1) {
                clients.splice(index, 1);
            }
        });
    });

    wss.on("error", (error) => {
        console.error("WebSocket server error:", error);
        Logger.log("CHAT WEBSOCKETSERVER ERROR: WebSocket server error: " + error);
    });

    async function handleEditMessage(editedMessage) {
        const messageId = editedMessage.id;
        if (!messageId) {
            const jsonMessage = {
                action: "error",
                message: "ID not provided",
            };
            broadcastMessage(JSON.stringify(jsonMessage));
            return;
        }

        const findMessage = await ChatMessage.findByPk(messageId);
        if (!findMessage) {
            const jsonMessage = {
                action: "error",
                message: "Error occurred on the server",
            };
            broadcastMessage(JSON.stringify(jsonMessage));
            return;
        }

        findMessage.message = editedMessage.message;
        findMessage.edited = true;
        findMessage.save();
    }

    async function handleDeleteMessage(deletedMessage) {
        const messageId = deletedMessage.id;
        if (!messageId) {
            const jsonMessage = {
                action: "error",
                message: "ID not provided",
            };
            broadcastMessage(JSON.stringify(jsonMessage));
            return;
        }

        try {
            const findMessage = await ChatMessage.findByPk(messageId);
            if (!findMessage) {
                const jsonMessage = {
                    action: "error",
                    message: "Message not found",
                };
                broadcastMessage(JSON.stringify(jsonMessage));
                return;
            }
            findMessage.destroy();

            const jsonMessage = {
                action: "delete",
                id: messageId,
            };
            broadcastMessage(JSON.stringify(jsonMessage));
        } catch (error) {
            console.error("Error deleting message:", error);
            Logger.log("CHAT WEBSOCKETSERVER ERROR: Error deleting message: " + error);
            const jsonMessage = {
                action: "error",
                message: "Error occurred while deleting message",
            };
            broadcastMessage(JSON.stringify(jsonMessage));
        }
    }

    function broadcastMessage(message) {
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    server.listen(PORT, () => {
        console.log(`WebSocket Server running on port ${PORT}`);
    });
}

module.exports = startWebSocketServer;
