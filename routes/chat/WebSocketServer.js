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
    let clientStore = {};

    async function getChatAndMessages(chatID) {
        try {
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
        } catch (error) {
            console.error("Error fetching chat and messages:", error);
        }
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
        ws.on("message", async (message) => {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.action === "connect") {
                let userID = parsedMessage.userID;
                let chatPartnerUsername = null;
                let userType;
                let userName;

                try {
                    const user = await Guest.findByPk(userID) || await Host.findByPk(userID);
                    if (user) {
                        connectionID = Universal.generateUniqueID();
                        userType = user instanceof Guest ? "Guest" : "Host";
                        userName = user.username;
                        // Store user data in clientStore
                        clientStore[userID] = {
                            connectionID,
                            ws,
                            userID,
                            userType,
                            userName,
                            chatIDs: []  // Initialize chatIDs as an empty array
                        };
                    } else {
                        throw new Error("User not found");
                    }
                } catch (error) {
                    console.error("Error fetching user:", error);
                    const jsonMessage = { action: "error", message: "Error fetching user" };
                    ws.send(JSON.stringify(jsonMessage));
                    return;
                }

                // Handle connection for Guests
                if (userType === "Guest") {
                    try {
                        const reservations = await Reservation.findAll({ where: { guestID: userID } });
                        if (reservations.length === 0) {
                            ws.send(JSON.stringify({ action: "error", message: "Guest has no reservations" }));
                            return;
                        }

                        for (const reservation of reservations) {
                            if (reservation.listingID === null) {
                                ws.send(JSON.stringify({ action: "error", message: "Reservation has no listing" }));
                                return;
                            }

                            const listing = await FoodListing.findOne({ where: { listingID: reservation.listingID } });
                            if (!listing) {
                                ws.send(JSON.stringify({ action: "error", message: "Listing not found" }));
                                return;
                            }

                            let hostID = listing.hostID;
                            const host = await Host.findOne({ where: { userID: hostID } });
                            chatPartnerUsername = host.username;

                            let chatID = await getChatID(userID, hostID);
                            clientStore[userID].chatIDs.push(chatID);  // Add chatID to chatIDs list
                            let status = checkChatPartnerOnline(clientStore, chatID, userID);
                            if (status === true) {
                                ws.send(JSON.stringify({ action: "chat_partner_online" }));
                            } else {
                                ws.send(JSON.stringify({ action: "chat_partner_offline" }));
                            }
                        }
                    } catch (error) {
                        console.error("Error connecting guest:", error);
                        ws.send(JSON.stringify({ action: "error", message: "Error connecting guest" }));
                    }
                }
                // Handle connection for Hosts
                else if (userType === "Host") {
                    try {
                        const reservations = await Reservation.findAll({ where: { guestID: userID } });
                        const listings = await FoodListing.findAll({ where: { hostID: userID } });

                        if (listings.length === 0 && reservations.length === 0) {
                            ws.send(JSON.stringify({ action: "error", message: "User not found" }));
                            return;
                        }

                        // If the Host is also a Guest
                        if (reservations.length > 0) {
                            for (const reservation of reservations) {
                                if (reservation.listingID === null) {
                                    ws.send(JSON.stringify({ action: "error", message: "Guest has no listing" }));
                                    return;
                                }

                                const listing = await FoodListing.findOne({ where: { listingID: reservation.listingID } });
                                if (!listing) {
                                    ws.send(JSON.stringify({ action: "error", message: "Host not found" }));
                                    return;
                                }

                                let hostID = listing.hostID;
                                const host = await Host.findOne({ where: { userID: hostID } });
                                chatPartnerUsername = host.username;

                                let chatID = await getChatID(userID, hostID);
                                clientStore[userID].chatIDs.push(chatID);  // Add chatID to chatIDs list
                            }
                        }

                        // If the Host is managing listings
                        if (listings.length > 0) {
                            for (const listing of listings) {
                                const reservation = await Reservation.findOne({ where: { listingID: listing.listingID } });
                                if (!reservation) {
                                    ws.send(JSON.stringify({ action: "error", message: "Guest not found" }));
                                    return;
                                }

                                let guestID = reservation.guestID;
                                const guest = await Guest.findOne({ where: { userID: guestID } });
                                chatPartnerUsername = guest.username;

                                let chatID = await getChatID(userID, guestID);
                                clientStore[userID].chatIDs.push(chatID);  // Add chatID to chatIDs list
                            }
                        }
                    } catch (error) {
                        console.error("Error connecting host:", error);
                        ws.send(JSON.stringify({ action: "error", message: "Error connecting host" }));
                    }
                }
            } else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage);
            } else if (parsedMessage.action === "send") {
                handleMessageSend(parsedMessage, parsedMessage.chatID);
            } else if (parsedMessage.action === "chat_history") {
                getChatAndMessages(parsedMessage.chatID);
            } else {
                ws.send(JSON.stringify({ action: "error", message: "Invalid action" }));
            }
        });

        ws.on("close", () => {
            for (const userID in clientStore) {
                if (clientStore[userID].ws === ws) {
                    const chatIDs = clientStore[userID].chatIDs;
                    chatIDs.forEach((chatID) => {
                        const remainingUser = Object.entries(clientStore).find(([key, value]) => value.chatID === chatID && key !== userID);
                        if (remainingUser) {

                            const [remainingUserID, remainingUserData] = remainingUser;
                            if (remainingUserData.ws && remainingUserData.ws.readyState === WebSocket.OPEN) {
                                console.log("online");
                                const message = JSON.stringify({ action: "chat_partner_online" });
                                remainingUserData.ws.send(message);
                            }
                        } else {
                            console.log("offline");
                            const message = JSON.stringify({ action: "chat_partner_offline" });
                            broadcastMessage(message, [userID]);
                        }
                    });
                    delete clientStore[userID];
                    break;
                }
            }
        });
    });

    wss.on("error", (error) => {
        console.error("WebSocket server error:", error);
        Logger.log("CHAT WEBSOCKETSERVER ERROR: WebSocket server error: " + error);
    });

    async function handleEditMessage(editedMessage) {
        const messageId = editedMessage.id;
        const userID = editedMessage.userID;
        if (!messageId) {
            broadcastMessage({ action: "error", message: "ID not provided" }, [userID]);
            return;
        }

        const chatHistory = await ChatMessage.findByPk(messageId);
        if (!chatHistory) {
            broadcastMessage({ action: "error", message: "Chat ID for message not found" }, [userID]);
            return;
        }

        try {
            const findMessage = await ChatMessage.findByPk(messageId);
            if (!findMessage) {
                broadcastMessage({ action: "error", message: "Message not found" }, [userID]);
                return;
            }

            findMessage.message = editedMessage.message;
            findMessage.edited = true;
            await findMessage.save();

            const responseMessage = { action: "edit", message: findMessage.message, messageID: messageId };
            const recipient = Object.entries(clientStore).find(([key, value]) => value.chatIDs.includes(chatHistory.chatID) && key !== editedMessage.userID);
            if (recipient) {
                const [recipientKey, recipientValue] = recipient;
                broadcastMessage(JSON.stringify(responseMessage), [userID, recipientValue.userID]);
            }
        } catch (error) {
            console.error("Error editing message:", error);
            broadcastMessage({ action: "error", message: "Error editing message" }, [userID]);
        }
    }

    async function handleDeleteMessage(deletedMessage) {
        const messageId = deletedMessage.id;
        const userID = deletedMessage.userID;
        if (!messageId) {
            broadcastMessage({ action: "error", message: "ID not provided" }, [userID]);
            return;
        }

        const chatHistory = await ChatMessage.findOne({ where: { messageID: messageId } });
        if (!chatHistory) {
            broadcastMessage({ action: "error", message: "Chat ID for message not found" }, [userID]);
            return;
        }

        try {
            const findMessage = await ChatMessage.findByPk(messageId);
            if (!findMessage) {
                broadcastMessage({ action: "error", message: "Message not found" }, [userID]);
                return;
            }

            await findMessage.destroy();

            const responseMessage = { action: "delete", messageID: findMessage.messageID };
            const recipient = Object.entries(clientStore).find(([key, value]) => value.chatIDs.includes(chatHistory.chatID) && key !== deletedMessage.userID);
            if (recipient) {
                const [recipientKey, recipientValue] = recipient;
                broadcastMessage(JSON.stringify(responseMessage), [deletedMessage.userID, recipientValue.userID]);
            }
        } catch (error) {
            console.error("Error deleting message:", error);
            broadcastMessage({ action: "error", message: "Error deleting message" }, [userID]);
        }
    }

    async function handleMessageSend(receivedMessage, chatID) {
        try {
            const message = {
                messageID: Universal.generateUniqueID(),
                chatID,
                sender: receivedMessage.sender,
                message: receivedMessage.message,
                datetime: new Date().toISOString(),
            };

            const newMessage = await ChatMessage.create(message);

            const responseMessage = {
                action: "send",
                message: newMessage,
            };
            const recipient = Object.entries(clientStore).find(([key, value]) => value.chatIDs.includes(chatID) && key !== receivedMessage.userID);
            if (recipient) {
                const [recipientKey, recipientData] = recipient;
                broadcastMessage(JSON.stringify(responseMessage), [receivedMessage.userID, recipientData.userID]);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            broadcastMessage({ action: "error", message: "Error sending message" });
        }
    }

    async function checkChatPartnerOnline(clientStore, chatID, userID) {
        const chatPartner = Object.entries(clientStore).find(([key, value]) => value.chatIDs.includes(chatID) && key !== userID);
        console.log(chatPartner);
        if (!chatPartner) {
            console.log("Chat partner offline")
            return false;
        }

        const [partnerID, partnerData] = chatPartner;
        if (partnerData.ws && partnerData.ws.readyState === WebSocket.OPEN) {
            console.log("Chat partner online")
            return true;
        }

        return false;
    }

    function broadcastMessage(message, recipients) {
        for (const userID of recipients) {
            const client = clientStore[userID];
            if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        }
    }

    server.listen(PORT, () => {
        console.log(`WebSocket server is running on port ${PORT}`);
    });
}

module.exports = startWebSocketServer;
