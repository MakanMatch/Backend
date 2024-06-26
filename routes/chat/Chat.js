let ws;

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}`);
    console.log(ws);

    ws.onopen = () => {
        console.log('Connected to the server');
    };

    ws.onmessage = (event) => {
        const message = document.createElement('div');
        message.textContent = event.data;
        document.getElementById('messages').appendChild(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('Disconnected from the server');
    };
}

function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
    } else {
        console.error('WebSocket is not open. Failed to send message.');
    }
}

module.exports = {
    connectWebSocket,
    sendMessage
};
