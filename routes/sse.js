const express = require('express');
const { requireAnyAuth } = require('../middleware/auth');
const { addClient, removeClient } = require('../lib/sseManager');

const router = express.Router();

router.get('/api/sse', requireAnyAuth, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection message
  res.write('event: connected\ndata: {"message":"SSE connection established"}\n\n');
  
  // Add client to set
  addClient(res);
  
  // Send keep-alive every 30 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (err) {
      clearInterval(keepAliveInterval);
    }
  }, 30000);
  
  // Remove client on disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    removeClient(res);
  });
});

module.exports = router;
