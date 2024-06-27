const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Cache = require("../../services/Cache");

function startWebSocketServer(app) {
  const PORT = 8080;


  // Create HTTP server by passing the Express app
  const server = http.createServer(app);

  // Integrate WebSocket with the HTTP server
  const wss = new WebSocket.Server({ server });

  const clients = [];

  wss.on("connection", (ws) => {
    console.log("WS connection arrived");
    // Add the new connection to our list of clients
    clients.push(ws);
	if (!Cache.cache["chat"]) {
		Cache.cache["chat"] = {};
	  }
    // Send cached messages to the new client
    const cachedMessages = Cache.cache["chat"];
    for (const messageId in cachedMessages) {
      const message = {
        id: messageId,
        ...cachedMessages[messageId],
      };
      ws.send(JSON.stringify(message));
    }

    ws.on("message", (message) => {
      const parsedMessage = JSON.parse(message);
	  console.log(parsedMessage.id)
      Cache.cache["chat"][parsedMessage.id] = {
        sender: parsedMessage.sender,
        message: parsedMessage.message,
        timestamp: parsedMessage.timestamp,
      };
      Cache.save();
      // Handle different message actions
      if (parsedMessage.action === "edit") {
        handleEditMessage(parsedMessage);
      } else if (parsedMessage.action === "delete") {
        handleDeleteMessage(parsedMessage);
      } else {
        // Broadcast message to all clients except the sender
        broadcastMessage(message, ws);
      }
    });

    ws.on("close", () => {
      // Remove the client from the array when it disconnects
      const index = clients.indexOf(ws);
      if (index > -1) {
        clients.splice(index, 1);
      }
    });
  });

  // Error handling for WebSocket server
  wss.on("error", function (error) {
    console.error("WebSocket server error:", error);
  });

  // Broadcast message to all clients except the sender
  function broadcastMessage(message, sender) {
    clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function handleDeleteMessage(deleteMessage) {
    const messageId = deleteMessage.id;

    // Filter out the message with the matching ID
    messages = messages.filter((msg) => msg.id !== messageId);

    // Broadcast delete message action to all clients
    const jsonMessage = JSON.stringify(deleteMessage);
    broadcastMessage(jsonMessage);
  }

  // Handle edit message action
  function handleEditMessage(editedMessage) {
    const messageId = editedMessage.id;

    // Find the message by ID and update its content
    const index = messages.findIndex((msg) => msg.id === messageId);
    if (index !== -1) {
      // Update the existing message
      messages[index] = {
        ...messages[index],
        message: editedMessage.message,
        edited: true,
        timestamp: new Date().toISOString(),
      };

      // Broadcast edited message to all clients
      const jsonMessage = JSON.stringify(messages[index]);
      broadcastMessage(jsonMessage);
    } else {
      console.error(`Message with ID ${messageId} not found.`);
    }
  }

  // Start the server
  server.listen(PORT, () => {
    console.log(`WebSocket Server running on port ${PORT}`);
  });
}

module.exports = startWebSocketServer;
