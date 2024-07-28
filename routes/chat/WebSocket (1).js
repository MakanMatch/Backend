const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage, Host, Guest } = require("../../models");
const Universal = require("../../services/Universal");
const Logger = require("../../services/Logger");

class ChatSocket {
    constructor(socketConnection) {
        this.socket = socketConnection;
    }

    sendEvent(event) {
        this.socket.send(event);
    }

    send(message) {
        this.socket.send(message);
    }
}

class ChatEvent {
    static authenticateEvent = "authenticate";
    static async authenticate(userID, jwt) {
        var user;
        try {
            user = await Host.findByPk(userID) || await Guest.findByPk(userID);
        } catch (err) {
            return "User not found.";
        }

        // Carry out jwt verification here

        return user;
    }

    static errorEvent = "error";
    static error(message, errorType) {
        return {
            event: "error",
            message: errorType == "user" ? "UERROR: " + message: "ERROR: " + message
        }
    }

    static responseEvent = "response";
    static response(message) {
        return {
            event: "response",
            message: "SUCCESS: " + message
        }
    }

    static sendMessageEvent = "sendMessage";
}

function startWebSocketServer(app) {
    const PORT = 8080;
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    var clientStore = {};

    wss.on("connection", async (ws) => {
        const connectionID = Universal.generateUniqueID();
        clientStore[connectionID] = {
            "socket": ws,
            "connectionID": connectionID,
            "connectionDatetime": new Date().toISOString(),
            "userID": null,
            "lastMessage": new Date().toISOString()
        }

        const chatSocket = new ChatSocket(ws);

        // Message event handler
        ws.on("message", async (message) => {
            if (!clientStore[connectionID]) { ws.close(); return; }

            const TEN_MINUTES = 10 * 60 * 1000;
            const ONE_HOUR = 60 * 60 * 1000;
            if (clientStore[connectionID].userID == null && (Date.now() - new Date(clientStore[connectionID].connectionDatetime).getTime()) > TEN_MINUTES){
                console.log(`WSS: Closing connection ${connectionID} due to unauthenticated state for 10 minutes.`);
                ws.close(1008)
                delete clientStore[connectionID]
                return;
            } else if (Date.now() - new Date(clientStore[connectionID].lastMessage).getTime() > ONE_HOUR) {
                console.log(`WSS: Closing connection ${connectionID} due to inactivity for 1 hour.`);
                ws.close(1008)
                delete clientStore[connectionID]
                return;
            }

            var msg;
            try {
                msg = JSON.parse(message);
            } catch (err) {
                Logger.log(`WSS MESSAGE ERROR: Failed to parse message from client; error: ${err}`)
                chatSocket.sendEvent(ChatEvent.errorEvent("Invalid message event."))
                return;
            }

            if (msg.event == ChatEvent.authenticateEvent) {
                if (!msg.userID || !msg.jwt) {
                    chatSocket.sendEvent(ChatEvent.error("One or more required payloads not provided."));
                    return;
                }

                const user = await ChatEvent.authenticate(msg.userID, msg.jwt);
                if (user == "User not found.") {
                    chatSocket.sendEvent(ChatEvent.error("User not found.", "user"));
                    return;
                }

                clientStore[connectionID].userID = user.userID;
                chatSocket.sendEvent(ChatEvent.response("Authenticated successfully."));
                return;
            }

            if (!clientStore[connectionID].userID) {
                chatSocket.sendEvent(ChatEvent.error("Connection not authorised."));
                return;
            }

            if (msg.event == ChatEvent.sendMessageEvent) {
                if (!msg.content) {
                    chatSocket.sendEvent(ChatEvent.error("Message content not provided."));
                    return;
                }

                const message = msg.content;
                const user = await Host.findByPk(clientStore[connectionID].userID) || await Guest.findByPk(clientStore[connectionID].userID);
                // Carry out send message actions
            } // add to this `if-else` chain for other authenticated events (by this stage, the user is authenticated)
        })

        // Close event handler
        ws.on("close", () => {
            Logger.log(`WSS: Connection ${connectionID} closed.`);
            delete clientStore[connectionID];
            return;
        })
    })

    wss.on("error", (err) => {
        console.error("WebSocket server error:", err);
        Logger.log("CHAT WEBSOCKETSERVER ERROR: WebSocket server error: " + err);
    })

    server.listen(PORT, () => {
        console.log(`WSS BOOT: WebSocket server running on port ${PORT}.`)
        return;
    })
}

module.exports = startWebSocketServer;