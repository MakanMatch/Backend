const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage, Reservation, FoodListing, Host, Guest } = require("../../models");
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
    let chatID = null;

    async function getChatAndMessages(chatID){
        console.log(chatID);
            let chatHistory = await ChatHistory.findOne({
                where: { chatID: chatID },
            });
            const previousMessages = await ChatMessage.findAll({
                where: { chatID: chatID },
                order: [["datetime", "ASC"]],
            });

            const message = JSON.stringify({
                previousMessages: previousMessages,
                chatID: chatHistory.chatID,
            });
            broadcastMessage(message, [chatHistory.user1ID, chatHistory.user2ID]);
    }
    async function getChatID(user1ID, user2ID) {
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

            const username1 = await Guest.findOne({
                where: { userID: user1ID },
            }) || await Host.findOne({
                where: { userID: user1ID },
            });

            const username2 = await Guest.findOne({
                where: { userID: user2ID },
            }) || await Host.findOne({
                where: { userID: user2ID },
            });

            console.log("username1:", username1 ? username1.username : "not found");
            console.log("username2:", username2 ? username2.username : "not found");

            const message = JSON.stringify({
                action: "chat_id",
                username1: username1.username,
                username2: username2.username,
                chatID: chatHistory.chatID,
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
                let userID = parsedMessage.userID;
                let username = parsedMessage.username;
                let userType = parsedMessage.userType;
                let chatPartnerUsername = null;

                if (userType === "Guest") {
                    try {
                        const findGuest = await Reservation.findAll({
                            where: { guestID: userID },
                        });
                        if (findGuest.length === 0) {
                            const jsonMessage = { action: "error", message: "Guest not found" };
                            ws.send(JSON.stringify(jsonMessage));
                            return;
                        }

                        for (const guest of findGuest) {
                            if (guest.listingID === null) {
                                const jsonMessage = {
                                    action: "error",
                                    message: "Guest has no listing",
                                };
                                ws.send(JSON.stringify(jsonMessage));
                                return;
                            }

                            const listingID = guest.listingID;
                            const findHost = await FoodListing.findOne({
                                where: { listingID: listingID },
                            });

                            if (!findHost) {
                                const jsonMessage = {
                                    action: "error",
                                    message: "Host not found",
                                };
                                ws.send(JSON.stringify(jsonMessage));
                                return;
                            }

                            let hostID = findHost.hostID;
                            const findHostUser = await Host.findOne({
                                where: { userID: hostID },
                            });

                            chatPartnerUsername = findHostUser.username;
                            const compositeKey = { userID, hostID };
                            if (connectedUsers.has(compositeKey)) {
                                connectedUsers.delete(compositeKey);
                            }
                            connectedUsers.set(compositeKey, ws);
                            userRooms.set(userID, hostID);
                            chatID = await getChatID(userID, hostID);
                            chatRooms.set(chatID, [userID, hostID]);
                            const jsonMessage = JSON.stringify({
                                action: "connect",
                            });
                            broadcastMessage(jsonMessage, [userID, hostID]);
                        }
                    } catch (error) {
                        console.error("Error connecting user:", error);
                        const jsonMessage = {
                            action: "error",
                            message: "Error connecting user",
                        };
                        ws.send(JSON.stringify(jsonMessage));
                    }
                } else if (userType === "Host") {
                    // Check if the Host is a guest for a listing
                    try {
                        const findGuest = await Reservation.findAll({
                            where: { guestID: userID },
                        });

                        const findHost = await FoodListing.findAll({
                            where: { hostID: userID },
                        });

                        if (findHost.length === 0 && findGuest.length === 0) {
                            const jsonMessage = { action: "error", message: "User not found" };
                            ws.send(JSON.stringify(jsonMessage));
                            return;
                        }
                        console.log(findGuest.length)
                        if (findGuest.length > 0) {
                            for (const guest of findGuest) {
                                if (guest.listingID === null) {
                                    const jsonMessage = {
                                        action: "error",
                                        message: "Guest has no listing",
                                    };
                                    ws.send(JSON.stringify(jsonMessage));
                                    return;
                                }
                                const listingID = guest.listingID;
                                const findHost = await FoodListing.findOne({
                                    where: { listingID: listingID },
                                });
                                if (!findHost) {
                                    const jsonMessage = {
                                        action: "error",
                                        message: "Host not found",
                                    };
                                    ws.send(JSON.stringify(jsonMessage));
                                    return;
                                }
                                let hostID = findHost.hostID;
                                const findHostUser = await Host.findOne({
                                    where: { userID: hostID },
                                });
                                chatPartnerUsername = findHostUser.username;
                                const compositeKey = { userID, hostID };
                                if (connectedUsers.has(compositeKey)) {
                                    connectedUsers.delete(compositeKey);
                                }
                                connectedUsers.set(compositeKey, ws);
                                userRooms.set(userID, hostID);
                                chatID = await getChatID(userID, hostID);
                                chatRooms.set(chatID, [userID, hostID]);
                                const jsonMessage = JSON.stringify({
                                    action: "connect",
                                    chatPartnerUsername,
                                });
                                broadcastMessage(jsonMessage, [userID, hostID]);
                            }
                        }
                        console.log(findHost.length)
                        if (findHost.length > 0) {
                            for (const host of findHost) {
                                const listingID = host.listingID;
                                const findGuest = await Reservation.findOne({
                                    where: { listingID: listingID },
                                });
                                if (!findGuest) {
                                    const jsonMessage = {
                                        action: "error",
                                        message: "Guest not found",
                                    };
                                    ws.send(JSON.stringify(jsonMessage));
                                    return;
                                }
                                let guestID = findGuest.guestID;
                                const findGuestUser = await Guest.findOne({
                                    where: { userID: guestID },
                                });
                                chatPartnerUsername = findGuestUser.username;
                                const compositeKey = { userID, guestID };
                                if (connectedUsers.has(compositeKey)) {
                                    connectedUsers.delete(compositeKey);
                                }
                                connectedUsers.set(compositeKey, ws);
                                userRooms.set(userID, guestID);
                                chatID = await getChatID(userID, guestID);
                                chatRooms.set(chatID, [userID, guestID]);
                                const jsonMessage = JSON.stringify({
                                    action: "chat_id",
                                });
                                broadcastMessage(jsonMessage, [userID, guestID]);
                            }
                        }
                    } catch (error) {
                        console.error("Error connecting user:", error);
                        const jsonMessage = {
                            action: "error",
                            message: "Error connecting user",
                        };
                        ws.send(JSON.stringify(jsonMessage));
                    }
                }
            } else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage);
            } else if (parsedMessage.action === "send") {
                //Find the correct chatID for the message by using userID
                handleMessageSend(parsedMessage, parsedMessage.chatID);
            } else if (parsedMessage.action === "chat_history") {
                getChatAndMessages(parsedMessage.chatID);
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
                                broadcastMessage(
                                    JSON.stringify({ action: "user_left", userID }),
                                    users
                                );
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

    async function handleMessageSend(parsedMessage, chatID) {
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
                chatID: chatID,
                messageID: Universal.generateUniqueID(),
                message: parsedMessage.message,
                sender: parsedMessage.sender,
                datetime: parsedMessage.datetime,
                replyToID: replyToMessage ? replyToMessage.messageID : null,
                edited: false,
            });

            const responseMessage = {
                action: "send",
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
        console.log(1)
        connectedUsers.forEach((ws, key) => {
            console.log(2)
            if (userIDs.length === 0 || userIDs.includes(key.userID) && (userIDs.includes(key.hostID) || userIDs.includes(key.guestID))) {

                if (ws.readyState === WebSocket.OPEN) {
                    console.log(key);
                    console.log("sending", message);
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