const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage, Reservation, FoodListing, Host, Guest } = require("../../models");
const Universal = require("../../services/Universal");
const Logger = require("../../services/Logger");
const { Op } = require('sequelize');
const { Json } = require("sequelize/lib/utils");
const TokenManager = require("../../services/TokenManager").default();
const util = require('util');

class ChatEvent {
    static errorEvent = "error";
    static error(message, errorType="error") {
        return JSON.stringify({
            event: "error",
            message: errorType == "user" ? "UERROR: " + message: "ERROR: " + message
        })
    }

    static responseEvent = "response";
    static response(message) {
        return {
            event: "response",
            message: "SUCCESS: " + message
        }
    }
}

async function authenticateConnection(authToken) {
    const { payload, token, refreshed } = TokenManager.verify(authToken, false)
    if (!payload || !payload.userID) {
        return "ERROR: Invalid JWT."
    }

    const user = await Host.findByPk(payload.userID) || await Guest.findByPk(guestID)
    if (!user) {
        return "ERROR: User not found."
    }

    return user;
}

function startWebSocketServer(app) {
    const PORT = 8080;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    // {
    //     "urmomconnection": {
    //         "urmomID",
    //         "urmomUserType",
    //         "urmom",
    //         "urmomWS",
    //         "conversations": {
    //             "urmomchatID": "urmomrecipientID"
    //         }
    //     }
    // }

    /**
     * connectionID:
     * - ws
     * - userID (nullable, required for chat which is authorised)
     * - user
     * - userType
     * - conversations
     *   - chatID: { recipientID, reservationReferenceNum }
     */
    let clientStore = {};

    async function getChatAndMessages(connectionID, parsedMessage) {
        const ws = clientStore[connectionID].ws;

        const chatID = parsedMessage.chatID;

        // Quick vibe check
        if (!Object.keys(clientStore[connectionID].conversations).includes(chatID)) {
            ws.send(ChatEvent.error("Chat history not found."))
            return;
        }

        try {
            let chatHistory = await ChatHistory.findByPk(chatID);
            if (!chatHistory) {
                ws.send(ChatEvent.error("Chat history not found."))
                return;
            }

            var previousMessages = await ChatMessage.findAll({
                where: {
                    chatID: chatID
                },
                order: [["datetime", "ASC"]]
            })
            if (!Array.isArray(previousMessages)) {
                ws.send(ChatEvent.error("Failed to retrieve chat messages. Please try again."))
                return;
            }

            // Convert messages to JSON
            previousMessages = previousMessages.map(msg => msg.toJSON());

            // Process and add the replyTo parameter for messages with replies
            const processedMessages = previousMessages.map(msg => {
                if (msg.replyToID) {
                    const targetMessage = previousMessages.filter(filterMsg => filterMsg.messageID == msg.messageID)
                    if (targetMessage[0]) {
                        msg.replyTo = targetMessage[0].message
                    }
                }

                return msg;
            })

            const message = {
                action: "chat_history",
                previousMessages: processedMessages,
                chatID: chatHistory.chatID,
            };

            console.log(processedMessages)

            broadcastMessage(message, chatID);
            return;
        } catch (error) {
            Logger.log(`CHAT WEBSOCKETSERVER GETCHATANDMESSAGES ERROR: Failed to retrieve chat history for connection ${connectionID}; error: ${error}`)
            ws.send(ChatEvent.error("Failed to retrieve chat history. Please try again."))
            return;
        }
    }

    async function getChatID(guestID, hostID) {
        try {
            let chatHistory = await ChatHistory.findOne({
                where: {
                    user1ID: hostID,
                    user2ID: guestID
                },
                attributes: ["chatID"]
            });

            if (!chatHistory) {
                chatHistory = await ChatHistory.create({
                    chatID: Universal.generateUniqueID(),
                    user1ID: hostID,
                    user2ID: guestID,
                    datetime: new Date().toISOString(),
                });
            }

            return chatHistory.chatID;
        } catch (error) {
            return `ERROR: Failed to retrieve/create chat history. Error: ${error}`
        }
    }

    wss.on("connection", (ws) => {
        console.log("New connection! Generating unique ID.")
        const connectionID = Universal.generateUniqueID();
        clientStore[connectionID] = {
            ws: ws,
            userID: null,
            user: null,
            userType: null,
            conversations: {}
        }

        ws.on("message", async (message) => {
            const parsedMessage = JSON.parse(message);
            console.log(`Action ${parsedMessage.action || "NULL"}; client store:`)
            console.log(util.inspect(clientStore, true))

            if (parsedMessage.action != "connect" && clientStore[connectionID].userID == null) {
                ws.send(ChatEvent.error("Connect and authenticate this connection before proceeding with other actions."))
                return;
            }

            if (parsedMessage.action === "connect") {
                // Retrieve the user record
                /// (needs to be changed to use authenticateConnection later on)
                const userID = parsedMessage.userID
                if (!userID) {
                    ws.send(ChatEvent.error("User ID not provided."))
                    return;
                }

                var user = await Host.findByPk(userID)
                var userType = "Host"
                if (!user) {
                    user = await Guest.findByPk(userID);
                    if (!user) {
                        ws.send(ChatEvent.error("User not found."));
                        return;
                    }

                    userType = "Guest"
                }

                // Store in client store
                clientStore[connectionID].userID = userID
                clientStore[connectionID].user = user
                clientStore[connectionID].userType = userType

                // Identify whether host or guest
                if (userType == "Guest") {
                    /// Get reservations if guest
                    const reservations = await Reservation.findAll({
                        where: {
                            guestID: userID
                        }
                    })
                    if (!reservations) {
                        ws.send(ChatEvent.error("Failed to retrieve your reservations. Please try again.", "user"))
                        return;
                    }
                    const reservationsJSON = reservations.map(reservation => reservation.toJSON());
                    const listingIDs = reservationsJSON.map(reservation => reservation.listingID);

                    const listings = await FoodListing.findAll({
                        where: {
                            listingID: {
                                [Op.in]: listingIDs
                            }
                        },
                        include: [
                            {
                                model: Host,
                                as: "Host",
                                attributes: ["userID", "username"]
                            }
                        ]
                    })
                    const listingsJSON = listings.map(listing => listing.toJSON());
    
                    /// Add recipients with chatID
                    for (const reservation of reservationsJSON) {
                        // Get host of reservation
                        const reservationListing = listingsJSON.find(listing => listing.listingID == reservation.listingID)
                        const hostID = reservationListing.Host.userID;
                        const hostUsername = reservationListing.Host.username;

                        // Get/create chat history ID
                        const chatID = await getChatID(userID, hostID);
                        if (typeof chatID == "string" && chatID.startsWith("ERROR")) {
                            Logger.log(`CHAT WEBSOCKETSERVER CONNECTION ERROR: Failed to retrieve/generate chat history for guest ${userID} and host ${hostID}; error: ${chatID}`)
                            ws.send(ChatEvent.error("Failed to formulate chat history. Please try again."))
                            return;
                        }
                        // Add conversation to clientStore
                        clientStore[connectionID]["conversations"][chatID] = {
                            recipientID: hostID,
                            reservationReferenceNum: reservation.referenceNum
                        }

                        // Send down chat ID event
                        const message = JSON.stringify({
                            action: "chat_id",
                            chatID: chatID,
                            username1: hostUsername,
                            username2: user.username,
                        })
                        ws.send(message);
                    }
                } else {
                    /// Get listings hosted
                    const listings = await FoodListing.findAll({
                        where: {
                            hostID: user.userID
                        },
                        include: [
                            {
                                model: Guest,
                                as: "guests",
                                attributes: ["userID", "username"]
                            }
                        ]
                    })
                    const listingsJSON = listings.map(listing => listing.toJSON());

                    for (const listing of listingsJSON) {
                        // Get guests of listing
                        const guests = listing.guests;

                        for (const listingGuest of guests) {
                            // Get guest information
                            const guestID = listingGuest.userID
                            const reservationReferenceNum = listingGuest.Reservation.referenceNum;
                            const guestUsername = listingGuest.username;

                            // Get chat ID
                            const chatID = await getChatID(guestID, user.userID)
                            if (typeof chatID == "string" && chatID.startsWith("ERROR")) {
                                Logger.log(`CHAT WEBSOCKETSERVER CONNECTION ERROR: Failed to retrieve/generate chat history for guest ${guestID} and host ${userID}; error: ${chatID}`)
                                ws.send(ChatEvent.error("Failed to formulate chat history. Please try again."))
                                return
                            }

                            // Add guest information to client store, including reservation reference
                            clientStore[connectionID]["conversations"][chatID] = {
                                recipientID: guestID,
                                reservationReferenceNum: reservationReferenceNum
                            }

                            // Send down the chat ID event
                            const message = JSON.stringify({
                                action: "chat_id",
                                chatID: chatID,
                                username1: user.username,
                                username2: guestUsername
                            })
                            ws.send(message);
                        }
                    }
                }
            } else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage, connectionID, parsedMessage.chatID);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage, connectionID, parsedMessage.chatID);
            } else if (parsedMessage.action === "send") {
                handleMessageSend(parsedMessage, connectionID, parsedMessage.chatID);
            } else if (parsedMessage.action === "chat_history") {
                getChatAndMessages(connectionID, parsedMessage);
            } else {
                ws.send(JSON.stringify({ action: "error", message: "Invalid action" }));
            }
        })

        ws.on("close", () => {
            delete clientStore[connectionID];
        })

        ws.on("error", (error) => {
            Logger.log(`CHAT WEBSOCKETSERVER WEBSOCKET ONERROR: Error occurred in web socket with connection ID ${connectionID}; error: ${error}`)
        })
    })

    wss.on("error", (error) => {
        Logger.log("CHAT WEBSOCKETSERVER ERROR: WebSocket server error: " + error);
    })

    async function handleEditMessage(editedMessage, connectionID, chatID) {
        const ws = clientStore[connectionID].ws;

        // Quick vibe check
        if (!Object.keys(clientStore[connectionID].conversations).includes(chatID)) {
            ws.send(ChatEvent.error("Chat history not found."))
            return;
        }

        const messageId = editedMessage.id;
        if (!messageId) {
            ws.send(ChatEvent.error("Target message ID not provided."))
            return;
        }

        const targetMessage = await ChatMessage.findByPk(messageId);
        if (!targetMessage) {
            ws.send(ChatEvent.error("Target message not found."))
            return;
        }

        try {
            targetMessage.message = editedMessage.message;
            targetMessage.edited = true;
            const saveResult = await targetMessage.save();
            if (!saveResult) {
                ws.send(ChatEvent.error("Failed to update message. Please try again."))
                return;
            }

            const responseMessage = { action: "edit", message: targetMessage.message, messageID: messageId };
            broadcastMessage(responseMessage, chatID)
            return;
        } catch (error) {
            Logger.log(`CHAT WEBSOCKETSERVER HANDLEEDITMESSAGE ERROR: Failed to edit message with ID ${messageId} by user ${clientStore[connectionID].userID} in chat ${chatID}; error: ${error}`)
            ws.send(ChatEvent.error("Failed to edit message. Please try again."))
            return;
        }
    }

    async function handleDeleteMessage(deletedMessage, connectionID, chatID) {
        const ws = clientStore[connectionID].ws;

        // Quick vibe check
        if (!Object.keys(clientStore[connectionID].conversations).includes(chatID)) {
            ws.send(ChatEvent.error("Chat history not found."))
            return;
        }

        const messageId = deletedMessage.id;
        const userID = deletedMessage.userID;
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

            await chatHistory.destroy();

            const responseMessage = { action: "delete", messageID: chatHistory.messageID };
            const chathistoryID = await ChatHistory.findByPk(chatHistory.chatID);
            if (chathistoryID) {
                const user1ID = chathistoryID.user1ID;
                const user2ID = chathistoryID.user2ID;
                broadcastMessage(JSON.stringify(responseMessage), [user1ID, user2ID]);
            }
        } catch (error) {
            console.error("Error deleting message:", error);
            broadcastMessage({ action: "error", message: "Error deleting message" }, [userID]);
        }
    }

    async function handleMessageSend(receivedMessage, connectionID, chatID) {
        const ws = clientStore[connectionID].ws;

        // Quick vibe check
        if (!Object.keys(clientStore[connectionID].conversations).includes(chatID)) {
            ws.send(ChatEvent.error("Chat history not found."))
            return;
        }
        
        try {
            var message = {
                messageID: Universal.generateUniqueID(),
                chatID,
                sender: receivedMessage.sender,
                message: receivedMessage.message,
                datetime: new Date().toISOString(),
            };
            var broadcastJSON = message;

            if (receivedMessage.replyToID && typeof receivedMessage.replyToID == "string") {
                const replyTargetMessage = await ChatMessage.findByPk(receivedMessage.replyToID, { attributes: ["messageID", "message"] })
                if (replyTargetMessage) {
                    message.replyToID = replyTargetMessage.messageID
                    broadcastJSON.replyTo = replyTargetMessage.message
                }
            }

            const newMessage = await ChatMessage.create(message);

            if (!newMessage) {
                ws.send(ChatEvent.error("Failed to create message. Please try again."))
                return;
            }

            const responseMessage = {
                action: "send",
                message: broadcastJSON,
            };

            console.log("SQL Message:")
            console.log(message)
            console.log("Broadcast message:")
            console.log(broadcastJSON)
            
            broadcastMessage(responseMessage, chatID)
        } catch (error) {
            Logger.log(`CHAT WEBSOCKETSERVER HANDLEMESSAGESEND ERROR: Failed to create message sent by user ${clientStore[connectionID].userID} for chat ${chatID}; error: ${error}`)
            ws.send(ChatEvent.error("Failed to create message. Please try again."))
        }
    }

    async function checkChatPartnerOnline(clientStore, chatID, userID) {
        const chatPartner = Object.entries(clientStore).find(([key, value]) => value.chatIDs.includes(chatID) && key !== userID);
        if (!chatPartner) {
            return false;
        }

        const [partnerID, partnerData] = chatPartner;
        if (partnerData.ws && partnerData.ws.readyState === WebSocket.OPEN) {
            return true;
        }

        return false;
    }

    function broadcastMessage(message, chatID) {
        const processedMessage = JSON.stringify(message);
        var sockets = [];
        for (const connectionID of Object.keys(clientStore)) {
            const connectionConversations = clientStore[connectionID]["conversations"]
            if (Object.keys(connectionConversations).includes(chatID)) {
                sockets.push(clientStore[connectionID]["ws"])
            }
        }

        for (const socket of sockets) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(processedMessage);
            }
        }
    }

    server.listen(PORT, () => {
        console.log(`WebSocket server is running on port ${PORT}`);
    });
}

module.exports = startWebSocketServer;