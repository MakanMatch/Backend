const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage, Host, Guest, Reservation, FoodListing } = require("../../models");
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
            console.log(`Fetching chat history for users: ${user1ID} and ${user2ID}`);
            
            let chatHistory = await ChatHistory.findOne({
                where: {
                    [Op.or]: [
                        { user1ID: user1ID, user2ID: user2ID },
                        { user1ID: user2ID, user2ID: user1ID }
                    ]
                },
            });
    
            if (!chatHistory) {
                console.log("Chat history not found. Creating a new one.");
                chatHistory = await ChatHistory.create({
                    chatID: Universal.generateUniqueID(),
                    user1ID,
                    user2ID,
                    datetime: new Date().toISOString(),
                });
            } else {
                console.log("Chat history found:", chatHistory);
            }
    
            const previousMessages = await ChatMessage.findAll({
                where: { chatID: chatHistory.chatID },
                order: [["datetime", "ASC"]],
            });
    
            console.log("Previous messages:", previousMessages);
    
            const messagesWithReplies = await Promise.all(
                previousMessages.map(async (message) => {
                    let replyToMessage = null;
                    if (message.replyToID) {
                        replyToMessage = await ChatMessage.findByPk(message.replyToID);
                    }
                    return {
                        ...message.get({ plain: true }),
                        datetime: new Date(message.datetime).toISOString(),
                        replyTo: replyToMessage ? replyToMessage.message : null,
                    };
                })
            );
    
            const message = JSON.stringify({
                type: "chat_history",
                messages: messagesWithReplies,
            });
    
            console.log("Broadcasting message:", message);
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
                const username = parsedMessage.username;
                const userType = parsedMessage.userType;

                if (userType === "Guest") {
                    // Check if the user is a guest
                    const findGuest = await Reservation.findOne({
                        where: { guestID: userID }
                    });

                    // Check if the user is a host
                    const findHost = await FoodListing.findOne({
                        where: { hostID: userID }
                    });

                    // Determine if the user is neither a guest nor a host
                    if (!findGuest && !findHost) {
                        const jsonMessage = { action: "error", message: "User not found as guest or host" };
                        ws.send(JSON.stringify(jsonMessage));
                        return;
                    }

                    // If user is a guest, find the listing ID
                    let listingID = null;
                    if (findGuest) {
                        listingID = findGuest.listingID;
                    }

                    // If user is a host, find their listing ID (assuming a host has only one listing)
                    if (findHost && !listingID) {
                        listingID = findHost.listingID;
                    }

                    // Ensure listingID is valid
                    if (!listingID) {
                        const jsonMessage = { action: "error", message: "Listing not found" };
                        ws.send(JSON.stringify(jsonMessage));
                        return;
                    }

                    // Find the host ID from the food listing using the listing ID
                    const foodListing = await FoodListing.findOne({
                        where: { listingID: listingID }
                    });

                    if (!foodListing) {
                        const jsonMessage = { action: "error", message: "Host not found" };
                        ws.send(JSON.stringify(jsonMessage));
                        return;
                    }

                    const hostID = foodListing.hostID;

                    // Connect the user (guest or host) to the host
                    connectedUsers.set(userID, ws);
                    connectedUsers.set(hostID, ws);


                    // Determine chatID using guestID and hostID
                    let chatID = await getChatHistoryAndMessages(userID, hostID);

                    // Store chatID and users in the chatRooms map
                    chatRooms.set(chatID, [userID, hostID]);
                    userRooms.set(username, chatID);
                }
                else if (userType === "Host") {
                    // Check if the user is a guest
                    const findGuest = await Reservation.findOne({
                        where: { guestID: userID }
                    });

                    if (!findGuest) {
                        // Check if the user is a host
                        const findHost = await FoodListing.findOne({
                            where: { hostID: userID }
                        });

                        // Determine if the user is neither a guest nor a host
                        if (!findHost) {
                            const jsonMessage = { action: "error", message: "User not found as guest or host" };
                            ws.send(JSON.stringify(jsonMessage));
                            return;
                        }

                        else {
                            // If user is a host, find their listing ID (assuming a host has only one listing)
                            let listingID = null;
                            if (findHost) {
                                listingID = findHost.listingID;
                            }

                            // Ensure listingID is valid
                            if (!listingID) {
                                const jsonMessage = { action: "error", message: "Listing not found" };
                                ws.send(JSON.stringify(jsonMessage));
                                return;
                            }

                            // Find the guest ID from the reservation using the listing ID
                            const reservation = await Reservation.findOne({
                                where: { listingID: listingID }
                            });

                            const guestID = reservation.guestID;

                            // Connect the user (guest or host) to the host
                            connectedUsers.set(guestID, ws);
                            connectedUsers.set(userID, ws);


                            // Determine chatID using guestID and hostID
                            let chatID = await getChatHistoryAndMessages(guestID, userID);

                            // Store chatID and users in the chatRooms map
                            chatRooms.set(chatID, [guestID, userID]);
                            userRooms.set(username, chatID);
                        }
                    }
                }

                } else if (parsedMessage.action === "edit") {
                    handleEditMessage(parsedMessage);
                } else if (parsedMessage.action === "delete") {
                    handleDeleteMessage(parsedMessage);
                } else if (parsedMessage.action === "send") {
                    const chatID = userRooms.get(parsedMessage.sender);
                    handleMessageSend(parsedMessage, chatID);
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

    async function handleMessageSend(parsedMessage, chatID) { // Add chatID as a parameter
        console.log(chatID);
        
        try {
            let replyToMessage = null;
            if (parsedMessage.replyToID) {
                replyToMessage = await ChatMessage.findByPk(parsedMessage.replyToID);
                if (!replyToMessage) {
                    const jsonMessage = { action: "error", message: "Reply to message not found" };
                    connectedUsers.get(parsedMessage.sender).send(JSON.stringify(jsonMessage)); // Send to sender
                    return;
                }
            }

            const createdMessage = await ChatMessage.create({
                messageID: Universal.generateUniqueID(),
                message: parsedMessage.message,
                sender: parsedMessage.sender,
                datetime: new Date().toISOString(), // Ensure proper date formatting
                chatID: chatID, // Use the passed chatID
                replyToID: replyToMessage ? replyToMessage.messageID : null,
                edited: false,
            });

            const responseMessage = {
                ...createdMessage.get({ plain: true }),
                datetime: new Date(createdMessage.datetime).toISOString(), // Ensure proper date formatting
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
        console.log(`WebSocket Server running on port ${PORT}`);
    });
}

module.exports = startWebSocketServer;