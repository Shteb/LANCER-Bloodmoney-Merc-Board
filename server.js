const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// pkg detection and path configuration
const IS_PKG = typeof process.pkg !== 'undefined';
const BASE_PATH = IS_PKG ? path.dirname(process.execPath) : __dirname;

// Initialize data store
const dataStore = require('./models/dataStore');
dataStore.init({
  BASE_PATH,
  DEFAULT_RESERVES: JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_reserves.json'), 'utf8')),
  DEFAULT_CORE_MAJOR_FACILITIES: JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_base_core_major_facilities.json'), 'utf8')),
  DEFAULT_MINOR_FACILITIES: JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_base_minor_facilities.json'), 'utf8'))
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (no session needed)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/emblems', express.static(path.join(BASE_PATH, 'logo_art')));

// Health endpoint for monitoring uptime
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'lancer-job-board-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize all data on startup
dataStore.initializeAll();

// Mount routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/pages'));
app.use('/', require('./routes/sse'));
app.use('/', require('./routes/upload'));
app.use('/api/jobs', require('./routes/api/jobs'));
app.use('/api/settings', require('./routes/api/settings'));
app.use('/api/reserves', require('./routes/api/reserves'));
app.use('/api/voting-periods', require('./routes/api/votingPeriods'));
app.use('/api/store-config', require('./routes/api/storeConfig'));
app.use('/api/manna', require('./routes/api/manna'));
app.use('/api/facilities', require('./routes/api/facilities'));
app.use('/api/factions', require('./routes/api/factions'));
app.use('/api/pilots', require('./routes/api/pilots'));
app.use('/api/shop', require('./routes/api/shop'));
// Admin batch operations are mounted at root since they use /api/jobs/ and /api/pilots/ prefixes
app.use('/', require('./routes/api/admin'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Navigate to localhost:${PORT} in your browser to access the application UI.`);
});
