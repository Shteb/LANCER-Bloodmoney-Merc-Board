const http = require('http');

const PORT = process.env.PORT || 3000;
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
const INITIAL_DELAY = 30 * 1000; // Wait 30 seconds for server to start

function ping() {
  const options = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`${new Date().toISOString()}: Self-ping successful - Status ${res.statusCode}`);
  });

  req.on('error', (err) => {
    console.error(`${new Date().toISOString()}: Self-ping failed:`, err.message);
  });

  req.on('timeout', () => {
    console.error(`${new Date().toISOString()}: Self-ping timeout`);
    req.destroy();
  });

  req.end();
}

// Only run in production
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  console.log('Keep-alive script started - pinging every 14 minutes');
  ping(); // Initial ping
  setInterval(ping, PING_INTERVAL);
} else {
  console.log('Keep-alive script disabled in development');
}