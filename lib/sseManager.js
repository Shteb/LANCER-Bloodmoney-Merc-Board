// SSE client management
const sseClients = new Set();

// SSE broadcast function
function broadcastSSE(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      // Client disconnected, remove from client set to prevent repeated errors
      sseClients.delete(client);
      console.error('Error writing to SSE client:', err);
    }
  });
}

function addClient(res) {
  sseClients.add(res);
}

function removeClient(res) {
  sseClients.delete(res);
}

module.exports = { broadcastSSE, addClient, removeClient };
