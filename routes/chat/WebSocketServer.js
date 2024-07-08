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
      console.log("Previous messages:", previousMessages)
  
      // Prepare the message to broadcast
      const message = JSON.stringify({
        type: "chat_history",
        messages: previousMessages,
      });
  
      // Broadcast the message to all clients
      broadcastMessage(message);
      return chatHistory.chatID;
    } 
    catch (error) {
      console.error("Error fetching chat history and messages:", error);
    }
  }
  
  wss.on("connection", async (ws) => {
    console.log("WS connection arrived");

    // Static user IDs for demonstration
    const user1ID = "Jamie";
    const user2ID = "James";

    // Store the WebSocket connection in an array
    clients.push(ws);

    // Initialize chat history and send previous messages
    chatID = await getChatHistoryAndMessages(user1ID, user2ID);
    console.log("Chat ID:", chatID);

    // Handle WebSocket message events
    ws.on("message", async (message) => {
      const parsedMessage = JSON.parse(message);
      console.log("Received message:", parsedMessage);
    
      if (parsedMessage.action === "edit") {
        handleEditMessage(parsedMessage, user1ID, user2ID, ws);
      } else if (parsedMessage.action === "delete") {
        handleDeleteMessage(parsedMessage);
      } else {
        try {
          // Create ChatMessage in the database
          const createdMessage = await ChatMessage.create({
            messageID: Universal.generateUniqueID(),
            message: parsedMessage.message,
            sender: parsedMessage.sender,
            datetime: parsedMessage.datetime,
            chatID: chatID,
            replyToID: parsedMessage.replyToID || null,
            repliedMessage: parsedMessage.replyTo || null,
          });
    
          // Include the replyTo message content in the response
          const responseMessage = {
            ...createdMessage.get({ plain: true }),
            replyTo: parsedMessage.replyTo
          };
    
          // Broadcast the message to all clients
          broadcastMessage(JSON.stringify(responseMessage), ws);
        } catch (error) {
          console.error("Error creating message:", error);
        }
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

  async function handleEditMessage(editedMessage, user1ID, user2ID, ws) {
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
      console.log("Message not found");
      const jsonMessage = {
        action: "error",
        message: "Error occurred on the server",
      };
      broadcastMessage(JSON.stringify(jsonMessage));
      return;
    }

    await ChatMessage.update(
      {
        message: editedMessage.message,
        datetime: editedMessage.datetime,
      },
      {
        where: {
          messageID: messageId,
        },
      });
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
  
      await ChatMessage.destroy({
        where: {
          messageID: messageId,
        },
      });
  
      const jsonMessage = {
        action: "delete",
        id: messageId,
      };
      broadcastMessage(JSON.stringify(jsonMessage));
    } catch (error) {
      console.error("Error deleting message:", error);
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
