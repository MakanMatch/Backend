const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage, Reservation, FoodListing, Host, Guest } = require("../../models");
const Universal = require("../../services/Universal");
const Logger = require("../../services/Logger");
const { Op } = require('sequelize');
const TokenManager = require("../../services/TokenManager").default();
const manageChat = require("./manageChat");
const FileManager  = require("../../services/FileManager");

class ChatEvent {
    static errorEvent = "error";
    static error(message, errorType="error") {
        return JSON.stringify({
            event: "error",
            message: errorType == "user" ? "UERROR: " + message: "ERROR: " + message
        })
    }

    static tokenRefreshedEvent = "refreshToken"
    static tokenRefreshed(token) {
        return JSON.stringify({
            event: "refreshToken",
            message: "Token refreshed.",
            token: token
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
    var verifyPayload;
    try {
        verifyPayload = TokenManager.verify(authToken, false)
        if (!verifyPayload.payload || !verifyPayload.payload.userID) {
            return "ERROR: Invalid JWT."
        }
    } catch (error) {
         // Handle token verification/refreshing errors
         if (error.name == "TokenExpiredError") {
            return "ERROR: " + error.name;
        } else {
            Logger.log(`AUTH VALIDATETOKEN: Failed to verify token; error: ${error}`);
            return "ERROR: Failed to verify token.";
        }
    }

    return verifyPayload;
}

function startWebSocketServer(app) {
    const PORT = 8080;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
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
                    const targetMessage = previousMessages.filter(filterMsg => filterMsg.messageID == msg.replyToID)
                    if (targetMessage[0]) {
                        msg.replyTo = targetMessage[0].message
                    }
                }

                if (msg.senderID == clientStore[connectionID].userID) {
                    msg.sender = clientStore[connectionID].user.username
                } else {
                    msg.sender = clientStore[connectionID].conversations[chatID].recipientUsername
                }

                return msg;
            })

            // Active users is a userID to connectionID map
            var activeUsers = {};
            for (const connectionID of Object.keys(clientStore)) {
                activeUsers[clientStore[connectionID].userID] = connectionID
            }
            const partnerIsActive = Object.keys(activeUsers).includes(clientStore[connectionID].conversations[chatID].recipientID)

            const message = {
                action: "chat_history",
                previousMessages: processedMessages,
                chatID: chatHistory.chatID,
                currentStatus: partnerIsActive
            };

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
        const connectionID = Universal.generateUniqueID();
        clientStore[connectionID] = {
            ws: ws,
            userID: null,
            user: null,
            userType: null,
            authToken: null,
            lastUpdate: new Date().toISOString(),
            conversations: {}
        }

        ws.on("message", async (message) => {
            if (!clientStore[connectionID]) { ws.close(); return; }

            // Close connection due to inactivity. Update lastUpdate otherwise.
            const TEN_MINUTES = 10 * 60 * 1000;
            const ONE_HOUR = 60 * 60 * 1000;
            if (clientStore[connectionID].authToken == null && (Date.now() - new Date(clientStore[connectionID].lastUpdate).getTime()) > TEN_MINUTES) {
                Logger.log(`WEBSOCKETSERVER: Closing connection ${connectionID} due to unauthenticated state for 10 minutes.`);
                ws.close(1008)
                delete clientStore[connectionID]
                return;
            } else if (Date.now() - new Date(clientStore[connectionID].lastUpdate).getTime() > ONE_HOUR) {
                Logger.log(`WEBSOCKETSERVER: Closing connection ${connectionID} due to inactivity for 1 hour.`);
                ws.close(1008)
                delete clientStore[connectionID]
                return;
            } else {
                clientStore[connectionID].lastUpdate = new Date().toISOString();
            }

            // Parse the received message
            var parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
            } catch (err) {
                Logger.log(`CHAT WEBSOCKETSERVER ONMESSAGE ERROR: Failed to parse message from client; error: ${err}`)
                ws.send(ChatEvent.error("Invalid message event."))
                return;
            }

            // Check connection authorisation
            if (parsedMessage.action != "connect" && clientStore[connectionID].authToken == null) {
                ws.send(ChatEvent.error("Connect and authenticate this connection before proceeding with other actions."))
                return;
            } else if (parsedMessage.action != "connect" && clientStore[connectionID].authToken != null) {
                const refreshResult = await authenticateConnection(clientStore[connectionID].authToken);
                if (typeof refreshResult == "string" && refreshResult.startsWith("ERROR")) {
                    // Failed to verify authorised connection's credential. De-authorise connection.
                    clientStore[connectionID]["authToken"] = null;
                    clientStore[connectionID]["userID"] = null;
                    clientStore[connectionID]["user"] = null;
                    clientStore[connectionID]["userType"] = null;
                    clientStore[connectionID]["conversations"] = {};
                    ws.send(JSON.stringify({
                        event: "error",
                        message: refreshResult
                    }))
                    return;
                }
                const { payload, token, refreshed } = refreshResult;
                if (refreshed) {
                    Logger.log(`CHAT WEBSOCKETSERVER CONNECTION: Token refreshed for user ${payload.userID} (Connection ID: ${connectionID}).`)
                    ws.send(ChatEvent.tokenRefreshed(token))
                    clientStore[connectionID]["authToken"] = token;
                    return;
                }
            }

            if (parsedMessage.action === "connect") {
                // Use authentication connection to verify authorisation
                const authToken = parsedMessage.authToken;
                if (!authToken) {
                    ws.send(ChatEvent.error("Provide an auth token to authorise this connection."))
                    return;
                }
                const verificationResult = await authenticateConnection(authToken);
                if (typeof verificationResult == "string" && verificationResult.startsWith("ERROR")) {
                    ws.send(JSON.stringify({
                        event: "error",
                        message: verificationResult
                    }))
                    return;
                }
                const { payload, token, refreshed } = verificationResult;
                if (refreshed) {
                    Logger.log(`CHAT WEBSOCKETSERVER ONMESSAGE CONNECT: Token refreshed for user ${payload.userID} (Connection ID: ${connectionID}).`)
                    ws.send(ChatEvent.tokenRefreshed(token))
                    clientStore[connectionID]["authToken"] = token
                }
                clientStore[connectionID].authToken = token;

                const userID = payload.userID;

                var user = await Host.findByPk(userID)
                var userType = "Host"
                if (!user) {
                    user = await Guest.findByPk(userID);
                    if (!user) {
                        // User could not be found based on authToken provided userID. De-authorise connection.
                        clientStore[connectionID]["authToken"] = null;
                        clientStore[connectionID]["userID"] = null;
                        clientStore[connectionID]["user"] = null;
                        clientStore[connectionID]["userType"] = null;
                        clientStore[connectionID]["conversations"] = {};
                        ws.send(ChatEvent.error("User not found. Re-connect with the auth token of an existing user."));
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
                            recipientUsername: hostUsername,
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
                                recipientUsername: guestUsername,
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

                broadcastActivity(connectionID, true);
            } else if (parsedMessage.action === "edit") {
                handleEditMessage(parsedMessage, connectionID, parsedMessage.chatID);
            } else if (parsedMessage.action === "delete") {
                handleDeleteMessage(parsedMessage, connectionID, parsedMessage.chatID);
            } else if (parsedMessage.action === "send") {
                handleMessageSend(parsedMessage, connectionID, parsedMessage.chatID);
            } else if(parsedMessage.action === "finalise_send"){ 
                finaliseMessageSend(parsedMessage, connectionID, parsedMessage.chatID);
            }else if (parsedMessage.action === "chat_history") {
                getChatAndMessages(connectionID, parsedMessage);
            } else {
                ws.send(JSON.stringify({ action: "error", message: "Invalid action" }));
            }
        })

        ws.on("close", () => {
            broadcastActivity(connectionID, false);
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

        if (targetMessage.senderID != clientStore[connectionID].userID) {
            ws.send(ChatEvent.error("You are not authorised to edit this message."))
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
        if (!messageId) {
            ws.send(ChatEvent.error("ID of message to be deleted not provided."));
            return;
        }

        const targetMessage = await ChatMessage.findByPk(messageId);
        if (!targetMessage) {
            ws.send(ChatEvent.error("Failed to retrieve target message."))
            return;
        }

        if (targetMessage.senderID != clientStore[connectionID].userID) {
            ws.send(ChatEvent.error("You are not authorised to delete this message."))
            return;
        }

        try {
            await targetMessage.destroy();

            const responseMessage = { action: "delete", messageID: targetMessage.messageID };
            broadcastMessage(responseMessage, chatID)
        } catch (error) {
            Logger.log(`CHAT WEBSOCKETSERVER HANDLEDELETEMESSAGE ERROR: Failed to delete message with ID ${messageId} by user ${clientStore[connectionID].userID} in chat ${chatID}; error: ${error}`)
            ws.send(ChatEvent.error("Failed to delete message. Please try again."))
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
                senderID: clientStore[connectionID].userID,
                message: receivedMessage.message,
                datetime: new Date().toISOString(),
                image: null,
            };
            var broadcastJSON = message;
            broadcastJSON.sender = clientStore[connectionID].user.username

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
            broadcastMessage(broadcastJSON, chatID)
        } catch (error) {
            Logger.log(`CHAT WEBSOCKETSERVER HANDLEMESSAGESEND ERROR: Failed to create message sent by user ${clientStore[connectionID].userID} for chat ${chatID}; error: ${error}`)
            ws.send(ChatEvent.error("Failed to create message. Please try again."))
        }
    }

    async function finaliseMessageSend(message, connectionID) {
        const ws = clientStore[connectionID].ws;
        console.log(message.imageUrl)

        // Quick vibe check
        if (!Object.keys(clientStore[connectionID].conversations).includes(message.message.chatID)) {
            ws.send(ChatEvent.error("Chat history not found."))
            return;
        }
        var message = {
            messageID: Universal.generateUniqueID(),
            chatID: message.message.chatID,
            senderID: clientStore[connectionID].userID,
            message: message.message.message,
            datetime: new Date().toISOString(),
            image: message.imageName,
        }

        const newMessage = await ChatMessage.create(message);
        if (!newMessage) {
            ws.send(ChatEvent.error("Failed to create message. Please try again."))
            return;
        }

        var broadcastJSON = message.message;
        broadcastJSON.sender = clientStore[connectionID].user.username
        broadcastJSON.image = message.imageUrl;
        broadcastMessage(broadcastJSON, message.message.chatID)
    }

    function broadcastActivity(connectionID, activityStatus) {
        // Active users is a userID to connectionID map
        var activeUsers = {};
        for (const connectionID of Object.keys(clientStore)) {
            activeUsers[clientStore[connectionID].userID] = connectionID
        }

        for (const chatID of Object.keys(clientStore[connectionID].conversations)) { // Loop through connection's chats to get the respective recipient's websockets
            const recipientID = clientStore[connectionID].conversations[chatID].recipientID; // recipient of chat
            if (Object.keys(activeUsers).includes(recipientID)) { // Check if chat recipient is currently active
                // Obtain the recipient's websocket from clientStore
                const recipientWS = clientStore[activeUsers[recipientID]].ws

                const message = {
                    action : activityStatus ? "chat_partner_online": "chat_partner_offline",
                    chatID: chatID
                }

                try {
                    recipientWS.send(JSON.stringify(message))
                } catch (error) {
                    Logger.log(`CHAT WEBSOCKETSERVER BROADCASTACTIVITY ERROR: Failed to update recipient ${recipientID} of connection ${connectionID} with new status information; error: ${error}`)
                }
            }
        }
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