const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Cache = require("../../services/Cache");

function startWebSocketServer(app) {
  const PORT = 8080;

  const server = http.createServer(app);

  const wss = new WebSocket.Server({ server });

  const clients = [];

  wss.on("connection", (ws) => {
    console.log("WS connection arrived");
    clients.push(ws);

    if (!Cache.cache["chat"]) {
      Cache.cache["chat"] = {};
    }

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

      Cache.cache["chat"][parsedMessage.id] = {
        sender: parsedMessage.sender,
        message: parsedMessage.message,
        timestamp: parsedMessage.timestamp,
      };
      Cache.save();

      if (parsedMessage.action === "edit") {
        handleEditMessage(parsedMessage);
      } else if (parsedMessage.action === "delete") {
        handleDeleteMessage(parsedMessage);
      } else {
        broadcastMessage(message, ws);
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
  });

  function broadcastMessage(message, sender) {
    clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function handleDeleteMessage(deleteMessage) {
    const messageId = deleteMessage.id;
    delete Cache.cache["chat"][messageId];
    Cache.save();

    const jsonMessage = JSON.stringify({
      id: messageId,
      action: "delete",
      action: "reload",
    });
    broadcastMessage(jsonMessage);
  }

  function handleEditMessage(editedMessage) {
    const messageId = editedMessage.id;
    if (Cache.cache["chat"][messageId]) {
      Cache.cache["chat"][messageId].message = editedMessage.message;
      Cache.cache["chat"][messageId].edited = true;
      Cache.save();

      const jsonMessage = JSON.stringify({
        ...Cache.cache["chat"][messageId],
        id: messageId,
        action: "edit",
        action: "reload",
      });
      broadcastMessage(jsonMessage);
    } else {
      console.error(`Message with ID ${messageId} not found.`);
    }
  }

  server.listen(PORT, () => {
    console.log(`WebSocket Server running on port ${PORT}`);
  });
}

module.exports = startWebSocketServer;
