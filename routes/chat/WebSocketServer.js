// websocket-server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

function startWebSocketServer() {
    const app = express();
    const PORT = 8080;

    // Create HTTP server by passing the Express app
    const server = http.createServer(app);

    // Integrate WebSocket with the HTTP server
    const wss = new WebSocket.Server({ server });

    // Array to keep track of all connected clients
    const clients = [];

    wss.on('connection', function connection(ws) {
        console.log("WS connection arrived");

        // Add the new connection to our list of clients
        clients.push(ws);

        ws.on('message', function incoming(message) {
            console.log('received: %s', message);

            // Broadcast the message to all clients
            clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
        });

        ws.on('close', () => {
            // Remove the client from the array when it disconnects
            const index = clients.indexOf(ws);
            if (index > -1) {
                clients.splice(index, 1);
            }
        });

        // Send a welcome message on new connection
        ws.send('Welcome to the chat!');
    });

    // Start the server
    server.listen(PORT, () => {
        console.log(`WebSocket Server running on port ${PORT}`);
    });
}

module.exports = startWebSocketServer;
