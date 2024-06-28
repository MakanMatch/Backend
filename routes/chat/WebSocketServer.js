const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { ChatHistory, ChatMessage } = require("../../models");
const Universal = require("../../services/Universal");
function startWebSocketServer(app) {
  const PORT = 8080;
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  const clients = [];

  wss.on("connection", async (ws) => {
    console.log("WS connection arrived");
    clients.push(ws);

    // Assuming you have some way to identify users, like user IDs
    const user1ID = "user1"; // Replace with actual user IDs
    const user2ID = "user2"; // Replace with actual user IDs

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

      // Now you can handle further WebSocket message events
      ws.on("message", async (message) => {
        const parsedMessage = JSON.parse(message);
        console.log("Received message:", parsedMessage);

        try {
          // Create ChatMessage in the database
          const createdMessage = await ChatMessage.create({
            messageID: parsedMessage.messageid,
            message: parsedMessage.message,
            from: parsedMessage.sender,
            datetime: parsedMessage.datetime,
            chatID: chatHistory.chatID, // Assign the chatID from ChatHistory
          });

          // Broadcast the message to all clients
          broadcastMessage(JSON.stringify(createdMessage), ws);
        } catch (error) {
          console.error("Error creating message:", error);
        }
      });

    } catch (error) {
      console.error("Error checking ChatHistory:", error);
    }

    ws.on("close", () => {
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  function broadcastMessage(message, sender) {
    clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  server.listen(PORT, () => {
    console.log(`WebSocket Server running on port ${PORT}`);
  });
}

module.exports = startWebSocketServer;

