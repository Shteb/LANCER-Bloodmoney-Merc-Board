const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const helpers = require('./helpers');

const app = express();
const PORT = process.env.PORT || 3000;

// pkg detection and path configuration
const IS_PKG = typeof process.pkg !== 'undefined';
const BASE_PATH = IS_PKG ? path.dirname(process.execPath) : __dirname;

// SSE client management
const sseClients = new Set();

// Simple mutex implementation for preventing race conditions in file operations
class FileMutex {
  constructor() {
    this.locks = new Map();
  }
  
  async acquire(key) {
    const timeoutMs = 5000; // Maximum time to wait for a lock before failing
    const start = Date.now();

    while (this.locks.get(key)) {
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timeout while waiting to acquire file lock for key: ${key}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.locks.set(key, true);
  }
  
  release(key) {
    this.locks.delete(key);
  }
}

const fileMutex = new FileMutex();

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

// Constants
const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: new Set(['image/png', 'image/jpeg', 'image/bmp'])
};

const FACILITY_COUNTS = {
  CORE_COUNT: 3,
  MAJOR_COUNT: 6,
  MINOR_SLOTS_COUNT: 6,
  TOTAL_CORE_MAJOR_COUNT: 9
};

// Load default reserves data
const DEFAULT_RESERVES = JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_reserves.json'), 'utf8'));

// Load default facility data
const DEFAULT_CORE_MAJOR_FACILITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_base_core_major_facilities.json'), 'utf8'));
const DEFAULT_MINOR_FACILITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'default_data', 'default_base_minor_facilities.json'), 'utf8'));

// Authentication middleware
function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      // For API endpoints, return JSON error instead of redirect
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      return res.redirect('/?error=unauthorized');
    }
    
    if (role && req.session.role !== role) {
      // For API endpoints, return JSON error instead of redirect
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      return res.redirect('/?error=unauthorized');
    }
    
    next();
  };
}

// Middleware for any authenticated user (CLIENT or ADMIN)
const requireAnyAuth = requireAuth();

// Middleware for CLIENT routes (allows both CLIENT and ADMIN)
const requireClientAuth = (req, res, next) => {
  if (!req.session || !req.session.role) {
    // For API endpoints, return JSON error instead of redirect
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/?error=unauthorized');
  }
  
  // Allow both 'client' and 'admin' roles to access CLIENT routes
  if (req.session.role === 'client' || req.session.role === 'admin') {
    return next();
  }
  
  // For API endpoints, return JSON error instead of redirect
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return res.redirect('/?error=unauthorized');
};

// Middleware for ADMIN routes
const requireAdminAuth = requireAuth('admin');

// Data file paths (external to binary for read/write operations)
const DATA_DIR = path.join(BASE_PATH, 'data');
const LOGO_ART_DIR = path.join(BASE_PATH, 'logo_art');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MANNA_FILE = path.join(DATA_DIR, 'manna.json');
const CORE_MAJOR_FACILITIES_FILE = path.join(DATA_DIR, 'base_core_major_facilities.json');
const MINOR_FACILITIES_SLOTS_FILE = path.join(DATA_DIR, 'minor_facilities_slots.json');
const FACTIONS_FILE = path.join(DATA_DIR, 'factions.json');
const PILOTS_FILE = path.join(DATA_DIR, 'pilots.json');
const RESERVES_FILE = path.join(DATA_DIR, 'reserves.json');
const STORE_CONFIG_FILE = path.join(DATA_DIR, 'store-config.json');
const VOTING_PERIODS_FILE = path.join(DATA_DIR, 'voting-periods.json');

// Ensure data and logo_art directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LOGO_ART_DIR)) {
  fs.mkdirSync(LOGO_ART_DIR, { recursive: true });
}

// Initialize settings file with default data if it doesn't exist
function initializeSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      ...DEFAULT_SETTINGS,
      unt: '01/01/5025',
      currentGalacticPos: 'SKAER-5'
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

// Initialize data file with dummy data if it doesn't exist
// Note: Must be called after initializeFactions() to reference faction IDs
function initializeData() {
  if (!fs.existsSync(DATA_FILE)) {
    // Read factions to get IDs for job assignments
    const factions = readFactions();
    const factionIds = factions.map(f => f.id);
    
    const dummyJobs = [
      {
        id: helpers.generateId(),
        name: 'Lorem Ipsum Dolorem',
        rank: 2,
        jobType: 'Finibus bonorum',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        clientBrief: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        currencyPay: '150m',
        additionalPay: 'Duis aute irure dolor in reprehenderit',
        emblem: 'token--world.svg',
        state: 'Active',
        factionId: factionIds[0] || '' // Conglomerate Finibus
      },
      {
        id: helpers.generateId(),
        name: 'Sit Amet Consectetur',
        rank: 1,
        jobType: 'Malorum extrema',
        description: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        clientBrief: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
        currencyPay: '75m',
        additionalPay: 'Totam rem aperiam',
        emblem: 'token--eth.svg',
        state: 'Active',
        factionId: factionIds[1] || '' // Shimano Industries
      },
      {
        id: helpers.generateId(),
        name: 'Tempor Incididunt',
        rank: 3,
        jobType: 'Ratione voluptatem',
        description: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.',
        clientBrief: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
        currencyPay: '250m',
        additionalPay: 'Sed quia non numquam eius modi tempora',
        emblem: 'token--planets.svg',
        state: 'Pending',
        factionId: factionIds[2] || '' // Collective Malorum
      },
      {
        id: helpers.generateId(),
        name: 'Voluptate Velit Esse',
        rank: 2,
        jobType: 'Cillum dolore',
        description: 'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque.',
        clientBrief: 'Corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.',
        currencyPay: '180m',
        additionalPay: '',
        emblem: 'token--lovely.svg',
        state: 'Complete',
        factionId: factionIds[3] || '' // Phoenix Syndicate
      },
      {
        id: helpers.generateId(),
        name: 'Fugiat Nulla Pariatur',
        rank: 1,
        jobType: 'Similique sunt',
        description: 'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime.',
        clientBrief: 'Placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.',
        currencyPay: '95m',
        additionalPay: 'Equipment bonus',
        emblem: 'token--dot.svg',
        state: 'Failed',
        factionId: factionIds[4] || '' // Void Runners
      },
      {
        id: helpers.generateId(),
        name: 'Quis Autem Vel Eum',
        rank: 3,
        jobType: 'Iure reprehenderit',
        description: 'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates.',
        clientBrief: 'Repudiandae sint et molestiae non recusandae itaque earum rerum hic tenetur a sapiente delectus.',
        currencyPay: '300m',
        additionalPay: 'Priority extraction available',
        emblem: 'token--cgo.svg',
        state: 'Ignored',
        factionId: factionIds[0] || '' // Conglomerate Finibus
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(dummyJobs, null, 2));
  }
}

// Read jobs from file
function readJobs() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write jobs to file
function writeJobs(jobs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
}

// Migrate old jobs to add state and factionId fields (one-time operation)
function migrateJobsIfNeeded() {
  const jobs = readJobs();
  let needsMigration = false;
  
  const migratedJobs = jobs.map(job => {
    const stateMissing = job.state === undefined || job.state === null;
    const factionIdMissing = !job.hasOwnProperty('factionId');

    if (stateMissing || factionIdMissing) {
      needsMigration = true;
      return {
        ...job,
        // Only default when state is actually missing (undefined or null)
        state: job.state ?? helpers.DEFAULT_JOB_STATE,
        // Only default factionId when the property is missing
        factionId: factionIdMissing ? '' : job.factionId
      };
    }
    return job;
  });
  
  if (needsMigration) {
    writeJobs(migratedJobs);
    console.log('Jobs migrated to include state and factionId fields');
  }
}

// Helper function to create faction lookup map
function createFactionMap(factions) {
  const factionMap = {};
  factions.forEach(f => {
    factionMap[f.id] = f;
  });
  return factionMap;
}

// Helper function to enrich jobs with faction data
function enrichJobsWithFactions(jobs, factions) {
  const factionMap = createFactionMap(factions);
  return jobs.map(job => ({
    ...job,
    faction: factionMap[job.factionId] || null
  }));
}

// Helper function to enrich all factions with job counts
function enrichAllFactions(factions, jobs) {
  return factions.map(faction => helpers.enrichFactionWithJobCounts(faction, jobs));
}

// Helper function to enrich pilots with balance information
function enrichPilotsWithBalance(pilots, manna) {
  return pilots.map(pilot => ({
    ...pilot,
    balance: helpers.calculatePilotBalance(pilot, manna.transactions)
  }));
}

// Helper function to validate job data
function validateJobData(jobData, factions, uploadDir) {
  // Validate emblem
  const emblemValidation = helpers.validateEmblem(jobData.emblem, uploadDir);
  if (!emblemValidation.valid) {
    return { valid: false, message: emblemValidation.message };
  }
  
  // Validate job state
  const stateValidation = helpers.validateJobState(jobData.state);
  if (!stateValidation.valid) {
    return { valid: false, message: stateValidation.message };
  }
  
  // Validate factionId if provided (optional)
  const factionId = jobData.factionId || '';
  if (factionId) {
    const factionValidation = helpers.validateFactionId(factionId, factions);
    if (!factionValidation.valid) {
      return { valid: false, message: factionValidation.message };
    }
  }
  
  return { 
    valid: true, 
    emblem: jobData.emblem,
    state: stateValidation.value,
    factionId: factionId
  };
}

// Helper function to validate faction data
function validateFactionData(factionData, uploadDir) {
  // Validate title
  const titleValidation = helpers.validateRequiredString(factionData.title, 'Faction title');
  if (!titleValidation.valid) {
    return { valid: false, message: titleValidation.message };
  }
  
  // Validate brief
  const briefValidation = helpers.validateRequiredString(factionData.brief, 'Faction brief');
  if (!briefValidation.valid) {
    return { valid: false, message: briefValidation.message };
  }
  
  // Validate emblem
  const emblemValidation = helpers.validateEmblem(factionData.emblem, uploadDir);
  if (!emblemValidation.valid) {
    return { valid: false, message: emblemValidation.message };
  }
  
  // Validate standing
  const standingValidation = helpers.validateInteger(factionData.standing, 'Standing', 0, 4);
  if (!standingValidation.valid) {
    return { valid: false, message: standingValidation.message };
  }
  
  return {
    valid: true,
    title: titleValidation.value,
    brief: briefValidation.value,
    emblem: factionData.emblem,
    standing: standingValidation.value,
    jobsCompletedOffset: parseInt(factionData.jobsCompletedOffset) || 0,
    jobsFailedOffset: parseInt(factionData.jobsFailedOffset) || 0
  };
}

// Helper function to calculate balances from pilot transactions
function calculateBalancesFromPilots() {
  const pilots = readPilots();
  const manna = readManna();
  
  // Create a map of transactions by ID for quick lookup
  const transactionMap = {};
  manna.transactions.forEach(txn => {
    transactionMap[txn.id] = txn.amount;
  });
  
  let activeBalance = 0;
  let totalBalance = 0;
  
  pilots.forEach(pilot => {
    let pilotBalance = 0;
    
    // Sum up all transactions for this pilot
    if (pilot.personalTransactions && Array.isArray(pilot.personalTransactions)) {
      pilot.personalTransactions.forEach(txnId => {
        if (transactionMap[txnId] !== undefined) {
          pilotBalance += transactionMap[txnId];
        }
      });
    }
    
    totalBalance += pilotBalance;
    if (pilot.active) {
      activeBalance += pilotBalance;
    }
  });
  
  return { activeBalance, totalBalance };
}

/**
 * Helper function to validate pilot data
 * @param {Object} pilotData - Raw pilot data from the request body
 * @param {Object} manna - Current manna data (balance and transactions) used for validating pilot-related transactions
 * @param {Array} reserves - Optional reserves data for reserve validation
 * @returns {Object} Validation result with sanitized pilot fields when valid, or an error message when invalid
 */
function validatePilotData(pilotData, manna, reserves = null) {
  // Validate name
  const nameValidation = helpers.validateRequiredString(pilotData.name, 'Pilot name');
  if (!nameValidation.valid) {
    return { valid: false, message: nameValidation.message };
  }
  
  // Validate callsign
  const callsignValidation = helpers.validateRequiredString(pilotData.callsign, 'Callsign');
  if (!callsignValidation.valid) {
    return { valid: false, message: callsignValidation.message };
  }
  
  // Validate LL (License Level)
  const llValidation = helpers.validateInteger(pilotData.ll, 'License Level', 0, 12);
  if (!llValidation.valid) {
    return { valid: false, message: llValidation.message };
  }
  
  // Validate personalOperationProgress (0-3)
  const progressValidation = helpers.validateInteger(
    pilotData.personalOperationProgress ?? 0,
    'Personal Operation Progress',
    0,
    3
  );
  if (!progressValidation.valid) {
    return { valid: false, message: progressValidation.message };
  }
  
  // Validate relatedJobs array if provided
  let relatedJobs = [];
  if (pilotData.relatedJobs) {
    try {
      relatedJobs = Array.isArray(pilotData.relatedJobs) ? pilotData.relatedJobs : JSON.parse(pilotData.relatedJobs);
      if (!Array.isArray(relatedJobs)) {
        return { valid: false, message: 'Related jobs must be an array' };
      }
    } catch (e) {
      return { valid: false, message: 'Invalid related jobs format' };
    }
  }
  
  // Validate personalTransactions array if provided
  let personalTransactions = [];
  if (pilotData.personalTransactions) {
    try {
      personalTransactions = Array.isArray(pilotData.personalTransactions) ? pilotData.personalTransactions : JSON.parse(pilotData.personalTransactions);
      if (!Array.isArray(personalTransactions)) {
        return { valid: false, message: 'Personal transactions must be an array' };
      }
      
      // Validate that all transaction UUIDs exist in manna data
      const transactionValidation = helpers.validateTransactionIds(personalTransactions, manna);
      if (!transactionValidation.valid) {
        return { valid: false, message: transactionValidation.message };
      }
    } catch (e) {
      return { valid: false, message: 'Invalid personal transactions format' };
    }
  }
  
  // Validate reserves array if provided
  let validatedReserves = [];
  if (pilotData.reserves) {
    try {
      const reservesArray = Array.isArray(pilotData.reserves) ? pilotData.reserves : JSON.parse(pilotData.reserves);
      
      // Validate reserves using the new helper function (handles both legacy and new formats)
      const reserveValidation = helpers.validatePilotReserves(reservesArray, reserves);
      if (!reserveValidation.valid) {
        return { valid: false, message: reserveValidation.message };
      }
      
      validatedReserves = reserveValidation.value;
    } catch (e) {
      return { valid: false, message: 'Invalid reserves format' };
    }
  }
  
  return {
    valid: true,
    name: nameValidation.value,
    callsign: callsignValidation.value,
    ll: llValidation.value,
    notes: (pilotData.notes || '').trim(),
    active: pilotData.active === 'true' || pilotData.active === true,
    relatedJobs: relatedJobs,
    personalOperationProgress: progressValidation.value,
    personalTransactions: personalTransactions,
    reserves: validatedReserves
  };
}

// Default settings object
const DEFAULT_SETTINGS = {
  portalHeading: 'HERM00R MERCENARY PORTAL',
  unt: '',
  currentGalacticPos: '',
  colorScheme: 'grey',
  userGroup: 'FREELANCE_OPERATORS',
  operationProgress: 0,
  openTable: false,
  clientPassword: 'IMHOTEP',
  adminPassword: 'TARASQUE',
  facilityCostModifier: 0,
  currencyIcon: 'manna_symbol.svg'
};

// Read settings from file
function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    // Merge with defaults to ensure all required fields exist
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

// Write settings to file
function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Initialize Manna data
function initializeManna() {
  if (!fs.existsSync(MANNA_FILE)) {
    const defaultManna = {
      transactions: [
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 500,
          description: 'Initial mission payment - Lorem Sector'
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          amount: -200,
          description: 'Equipment repairs and ammunition resupply'
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 700,
          description: 'Bonus payment - Successful extraction mission'
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          amount: -150,
          description: 'Medical expenses and pilot recovery'
        },
        {
          id: helpers.generateId(),
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 400,
          description: 'Contract completion - Shimano Industries'
        },
        {
          id: helpers.generateId(),
          date: new Date().toISOString(),
          amount: -100,
          description: 'Fuel and transport costs'
        }
      ]
    };
    fs.writeFileSync(MANNA_FILE, JSON.stringify(defaultManna, null, 2));
  }
}

// Read Manna data
function readManna() {
  try {
    const data = fs.readFileSync(MANNA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { transactions: [] };
  }
}

// Write Manna data
function writeManna(manna) {
  fs.writeFileSync(MANNA_FILE, JSON.stringify(manna, null, 2));
}

// Migrate transactions to ensure all have UUIDs (one-time operation)
function migrateTransactionsIfNeeded() {
  const manna = readManna();
  let needsMigration = false;
  
  const migratedTransactions = manna.transactions.map(transaction => {
    if (!transaction.id) {
      needsMigration = true;
      return {
        ...transaction,
        id: helpers.generateId()
      };
    }
    return transaction;
  });
  
  if (needsMigration) {
    manna.transactions = migratedTransactions;
    writeManna(manna);
    console.log('Transactions migrated to include UUID fields');
  }
}

// Initialize Core/Major Facilities
function initializeCoreMajorFacilities() {
  if (!fs.existsSync(CORE_MAJOR_FACILITIES_FILE)) {
    // Use default data from default_data directory
    fs.writeFileSync(CORE_MAJOR_FACILITIES_FILE, JSON.stringify(DEFAULT_CORE_MAJOR_FACILITIES, null, 2));
  }
}

// Read Core/Major Facilities data
function readCoreMajorFacilities() {
  try {
    const data = fs.readFileSync(CORE_MAJOR_FACILITIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    initializeCoreMajorFacilities();
    return readCoreMajorFacilities();
  }
}

// Write Core/Major Facilities data
function writeCoreMajorFacilities(facilities) {
  fs.writeFileSync(CORE_MAJOR_FACILITIES_FILE, JSON.stringify(facilities, null, 2));
}

// Initialize Minor Facilities Slots
function initializeMinorFacilitiesSlots() {
  if (!fs.existsSync(MINOR_FACILITIES_SLOTS_FILE)) {
    // Create 6 slots, with last 2 disabled by default
    const defaultSlots = {
      slots: [
        { slotNumber: 1, facilityName: '', facilityDescription: '', enabled: true },
        { slotNumber: 2, facilityName: '', facilityDescription: '', enabled: true },
        { slotNumber: 3, facilityName: '', facilityDescription: '', enabled: true },
        { slotNumber: 4, facilityName: '', facilityDescription: '', enabled: true },
        { slotNumber: 5, facilityName: '', facilityDescription: '', enabled: false },
        { slotNumber: 6, facilityName: '', facilityDescription: '', enabled: false }
      ]
    };
    fs.writeFileSync(MINOR_FACILITIES_SLOTS_FILE, JSON.stringify(defaultSlots, null, 2));
  }
}

// Read Minor Facilities Slots data
function readMinorFacilitiesSlots() {
  try {
    const data = fs.readFileSync(MINOR_FACILITIES_SLOTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    initializeMinorFacilitiesSlots();
    return readMinorFacilitiesSlots();
  }
}

// Write Minor Facilities Slots data
function writeMinorFacilitiesSlots(minorFacilities) {
  fs.writeFileSync(MINOR_FACILITIES_SLOTS_FILE, JSON.stringify(minorFacilities, null, 2));
}

// Migration function: Base modules to Facilities (one-time, clean break)
function migrateBaseToFacilities() {
  const MIGRATION_FLAG_FILE = path.join(DATA_DIR, '.base_to_facilities_migration_complete');
  const LEGACY_BASE_FILE = path.join(DATA_DIR, 'base.json');
  
  // Check if migration already completed
  if (fs.existsSync(MIGRATION_FLAG_FILE)) {
    return; // Migration already done
  }
  
  // Check if old base.json exists
  if (fs.existsSync(LEGACY_BASE_FILE)) {
    console.log('Migrating from old base.json to new facility system...');
    
    // Clean break: Delete old base.json without transferring data
    // New facilities will be initialized from default data
    fs.unlinkSync(LEGACY_BASE_FILE);
    console.log('Old base.json deleted');
  }
  
  // Mark migration as complete
  fs.writeFileSync(MIGRATION_FLAG_FILE, new Date().toISOString());
}

// Initialize Factions
function initializeFactions() {
  if (!fs.existsSync(FACTIONS_FILE)) {
    const defaultFactions = [
      {
        id: helpers.generateId(),
        title: 'Conglomerate Finibus',
        emblem: 'token--mantle.svg',
        brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        standing: 2,
        jobsCompletedOffset: 3,
        jobsFailedOffset: 1
      },
      {
        id: helpers.generateId(),
        title: 'Shimano Industries',
        emblem: 'token--lovely.svg',
        brief: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        standing: 3,
        jobsCompletedOffset: 5,
        jobsFailedOffset: 0
      },
      {
        id: helpers.generateId(),
        title: 'Collective Malorum',
        emblem: 'token--cgo.svg',
        brief: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
        standing: 1,
        jobsCompletedOffset: 1,
        jobsFailedOffset: 2
      },
      {
        id: helpers.generateId(),
        title: 'Phoenix Syndicate',
        emblem: 'token--world.svg',
        brief: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        standing: 4,
        jobsCompletedOffset: 8,
        jobsFailedOffset: 0
      },
      {
        id: helpers.generateId(),
        title: 'Void Runners',
        emblem: 'token--dot.svg',
        brief: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
        standing: 0,
        jobsCompletedOffset: 0,
        jobsFailedOffset: 3
      }
    ];
    fs.writeFileSync(FACTIONS_FILE, JSON.stringify(defaultFactions, null, 2));
  }
}

// Read Factions
function readFactions() {
  try {
    const data = fs.readFileSync(FACTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write Factions
function writeFactions(factions) {
  fs.writeFileSync(FACTIONS_FILE, JSON.stringify(factions, null, 2));
}

// Migrate old factions to add offset fields (one-time operation)
function migrateFactionsIfNeeded() {
  const factions = readFactions();
  let needsMigration = false;
  
  const migratedFactions = factions.map(faction => {
    const hasJobsCompletedOffset = Object.prototype.hasOwnProperty.call(faction, 'jobsCompletedOffset');
    const hasJobsFailedOffset = Object.prototype.hasOwnProperty.call(faction, 'jobsFailedOffset');
    const hasLegacyJobsCompleted = Object.prototype.hasOwnProperty.call(faction, 'jobsCompleted');
    const hasLegacyJobsFailed = Object.prototype.hasOwnProperty.call(faction, 'jobsFailed');
    const offsetFieldsMissing = !hasJobsCompletedOffset || !hasJobsFailedOffset;
    
    // Always strip legacy fields from the returned object
    const { jobsCompleted, jobsFailed, ...rest } = faction;
    
    if (offsetFieldsMissing || hasLegacyJobsCompleted || hasLegacyJobsFailed) {
      needsMigration = true;
      // Remove legacy fields and initialize missing offset fields from their values (or 0 if missing)
      return {
        ...rest,
        ...(hasJobsCompletedOffset ? {} : { jobsCompletedOffset: jobsCompleted || 0 }),
        ...(hasJobsFailedOffset ? {} : { jobsFailedOffset: jobsFailed || 0 })
      };
    }
    
    // No migration needed: offsets already exist and no legacy fields were present
    return rest;
  });
  
  if (needsMigration) {
    writeFactions(migratedFactions);
    console.log('Factions migrated to use offset fields for job counts');
  }
}

// Initialize Pilots
// Note: Must be called after initializeData() and initializeManna() to reference job and transaction IDs
function initializePilots() {
  if (!fs.existsSync(PILOTS_FILE)) {
    // Read jobs and transactions to get IDs for assignments
    const jobs = readJobs();
    const manna = readManna();
    const jobIds = jobs.map(j => j.id);
    const transactionIds = manna.transactions.map(t => t.id);
    
    // Filter to only non-Pending jobs for relatedJobs (as per schema)
    const activeJobIds = jobs.filter(j => j.state !== 'Pending').map(j => j.id);
    
    const defaultPilots = [
      {
        id: helpers.generateId(),
        name: 'Lorem Ipsum',
        callsign: 'Dolor',
        ll: 3,
        notes: 'Lorem ipsum dolor sit amet\nConsectetur adipiscing elit',
        active: true,
        relatedJobs: activeJobIds.slice(0, 3), // First 3 non-Pending jobs
        personalOperationProgress: 2,
        personalTransactions: [transactionIds[0], transactionIds[2], transactionIds[4]], // Transactions 0, 2, 4
        reserves: [
          // Mix of deployment statuses
          { reserveId: '24d0834e-82cc-4236-a70c-868e1bd8c714', deploymentStatus: 'In Reserve' }, // SNAP HOOKS (Rank 1)
          { reserveId: 'f3ec4d0c-1004-4866-856b-7be954f01162', deploymentStatus: 'Deployed' }, // MOLECULAR WHETSTONE (Rank 1)
          { reserveId: 'bee345fb-b12c-4e47-ac1d-768e227a1aa0', deploymentStatus: 'In Reserve' } // SLINGSHOT PORTAL (Rank 2)
        ]
      },
      {
        id: helpers.generateId(),
        name: 'Sit Amet',
        callsign: 'Consectetur',
        ll: 5,
        notes: 'Sed do eiusmod tempor\nIncididunt ut labore',
        active: true,
        relatedJobs: activeJobIds.slice(1, 4), // Jobs 1-3 (non-Pending)
        personalOperationProgress: 0,
        personalTransactions: [transactionIds[0], transactionIds[1], transactionIds[3], transactionIds[5]], // Multiple transactions
        reserves: [
          // Multiple deployed and expended items
          { reserveId: 'af2fe676-7485-42c2-9dbf-9e6241efa35e', deploymentStatus: 'Deployed' }, // KINETIC PULSE COIL (Rank 1)
          { reserveId: '4c0e4340-b55e-49f3-b4ff-c6232072b391', deploymentStatus: 'Expended' }, // ICARUS MULTISTAGE BOOSTER (Rank 1)
          { reserveId: 'fc9bc430-6132-4639-9bed-2efde7e4ee70', deploymentStatus: 'In Reserve' }, // PURVIEW-GRADE DUCT TAPE (Rank 2)
          { reserveId: 'c63db599-fb7a-447f-8293-1dc3bc2a9439', deploymentStatus: 'Deployed' } // COOLANT RIG (Rank 2)
        ]
      },
      {
        id: helpers.generateId(),
        name: 'Magna Aliqua',
        callsign: 'Tempor',
        ll: 2,
        notes: 'Ut enim ad minim veniam\nQuis nostrud exercitation',
        active: false,
        relatedJobs: activeJobIds.slice(0, 2), // First 2 non-Pending jobs
        personalOperationProgress: 0,
        personalTransactions: [transactionIds[2], transactionIds[3]], // Some transactions
        reserves: [
          // All expended for inactive pilot
          { reserveId: '577cacbe-fc7f-4dd4-80e4-8fe8c1f0bf45', deploymentStatus: 'Expended' }, // REDUNDANT CLADDING (Rank 1)
          { reserveId: 'd38e97ff-93ac-4ab9-9e5b-c09dc367e7f7', deploymentStatus: 'Expended' } // CONCUSSIVE BRACER (Rank 1)
        ]
      },
      {
        id: helpers.generateId(),
        name: 'Veniam Quis',
        callsign: 'Nostrud',
        ll: 7,
        notes: 'Duis aute irure dolor\nReprehenderit in voluptate',
        active: true,
        relatedJobs: activeJobIds.slice(2, 5), // Jobs 2-4 (non-Pending)
        personalOperationProgress: 1,
        personalTransactions: [transactionIds[1], transactionIds[4]], // Some transactions
        reserves: [
          // Mostly in reserve
          { reserveId: 'c02c8c7e-911a-4a93-92aa-77e4957e47aa', deploymentStatus: 'In Reserve' }, // CUIRASS SHIELD GENERATOR (Rank 1)
          { reserveId: '45aa66a4-6851-442d-bf8b-3f18f44a172e', deploymentStatus: 'In Reserve' }, // SPARE AMMO (Rank 1)
          { reserveId: '9d457f59-2edd-4c13-9651-b637204df109', deploymentStatus: 'In Reserve' } // INSIGHT-CLASS COMP/CON (Rank 2)
        ]
      },
      {
        id: helpers.generateId(),
        name: 'Ullamco Laboris',
        callsign: 'Nisi',
        ll: 4,
        notes: 'Excepteur sint occaecat\nCupidatat non proident',
        active: true,
        relatedJobs: activeJobIds.slice(0, 2), // First 2 non-Pending jobs
        personalOperationProgress: 3,
        personalTransactions: [transactionIds[2], transactionIds[5]], // Some transactions
        reserves: [
          // All deployed
          { reserveId: 'e07cfe77-20f4-47d5-a31e-4278afbaa0f2', deploymentStatus: 'Deployed' }, // SAND DISPENSER (Rank 1)
          { reserveId: '09d52f79-a881-4296-9792-4ced3f0cd2cc', deploymentStatus: 'Deployed' } // ADAPTIVE ROUNDS (Rank 1)
        ]
      }
    ];
    fs.writeFileSync(PILOTS_FILE, JSON.stringify(defaultPilots, null, 2));
  }
}

// Read Pilots
function readPilots() {
  try {
    const data = fs.readFileSync(PILOTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write Pilots
function writePilots(pilots) {
  fs.writeFileSync(PILOTS_FILE, JSON.stringify(pilots, null, 2));
}

// Migrate old pilots to add personalOperationProgress, personalTransactions, and reserves fields (one-time operation)
function migratePilotsIfNeeded() {
  const pilots = readPilots();
  let needsMigration = false;
  
  const migratedPilots = pilots.map(pilot => {
    const progressMissing = !pilot.hasOwnProperty('personalOperationProgress');
    const transactionsMissing = !pilot.hasOwnProperty('personalTransactions');
    const hasReserves = pilot.hasOwnProperty('reserves');
    const reservesIsString = hasReserves && typeof pilot.reserves === 'string';
    const reservesIsArray = hasReserves && Array.isArray(pilot.reserves);
    const reservesMissing = !hasReserves;
    
    // Check if reserves need migration to object format
    let reservesNeedMigration = false;
    if (reservesIsArray && pilot.reserves.length > 0) {
      // Check if first item is a string UUID (legacy format) or an object (new format)
      const firstItem = pilot.reserves[0];
      reservesNeedMigration = typeof firstItem === 'string';
    }
    
    if (progressMissing || transactionsMissing || reservesMissing || reservesIsString || reservesNeedMigration) {
      needsMigration = true;
      
      // Build migrated pilot object
      const migratedPilot = {
        ...pilot,
        personalOperationProgress: pilot.personalOperationProgress ?? 0,
        personalTransactions: pilot.personalTransactions ?? []
      };
      
      // Handle legacy string reserves field
      if (reservesIsString) {
        // If notes field doesn't exist, migrate the string reserves to notes
        if (!pilot.hasOwnProperty('notes')) {
          migratedPilot.notes = pilot.reserves || '';
        }
        // Always replace string reserves with empty array
        migratedPilot.reserves = [];
      } else if (reservesIsArray) {
        if (reservesNeedMigration) {
          // Convert legacy UUID array to new object array format
          migratedPilot.reserves = pilot.reserves.map(reserveId => ({
            reserveId: reserveId,
            deploymentStatus: 'In Reserve'
          }));
        } else {
          // Already in new format, keep as is
          migratedPilot.reserves = pilot.reserves;
        }
      } else {
        // Missing reserves field, initialize as empty array
        migratedPilot.reserves = [];
      }
      
      return migratedPilot;
    }
    return pilot;
  });
  
  if (needsMigration) {
    writePilots(migratedPilots);
    console.log('Pilots migrated: personalOperationProgress, personalTransactions, reserves fields added/updated, legacy formats migrated');
  }
}

// Read Reserves
function readReserves() {
  try {
    const data = fs.readFileSync(RESERVES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Write Reserves
function writeReserves(reserves) {
  fs.writeFileSync(RESERVES_FILE, JSON.stringify(reserves, null, 2));
}

// Initialize reserves with default data
function initializeReserves() {
  if (!fs.existsSync(RESERVES_FILE)) {
    writeReserves(DEFAULT_RESERVES);
  }
}

// Write Store Config
function writeStoreConfig(storeConfig) {
  fs.writeFileSync(STORE_CONFIG_FILE, JSON.stringify(storeConfig, null, 2));
}

// Read Store Config
function readStoreConfig() {
  try {
    const data = fs.readFileSync(STORE_CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Initialize store config
function initializeStoreConfig() {
  if (!fs.existsSync(STORE_CONFIG_FILE)) {
    const defaultStoreConfig = {
      currentStock: [
        // Pre-populated with 5 reserves from default_reserves.json
        'c56a0d97-1527-49e8-a7d5-9115df3d5706', // OVERPOWERED COILS (Rank 1)
        '6ec6dd1b-91b2-41ce-9144-7cab48708caa', // REACTIVE SHUNT (Rank 1)
        'b2046bf1-a3b2-406b-8a01-ce7c6fd6e9a9', // FUEL RESERVES (Rank 1)
        '43e883f9-d78e-41e3-98f5-4a2de26ce332', // RADIANT TARGET ACTUATOR (Rank 2)
        '9a779369-1548-4f23-96ab-8189d361fcb4'  // COUNTERWEIGHT POMMEL (Rank 2)
      ],
      resupplyItems: [
        { id: 'limited-restock', name: 'Limited restock', price: 2000, enabled: true },
        { id: 'repair', name: 'Repair', price: 4000, enabled: true },
        { id: 'core-battery', name: 'Core Battery', price: 8000, enabled: true }
      ],
      resupplySettings: {
        enabled: false,
        rankDistribution: {
          rank1Count: 5,
          rank2Count: 3,
          rank3Count: 1
        }
      }
    };
    writeStoreConfig(defaultStoreConfig);
  }
}

// Migrate store config to add resupply items if needed
function migrateStoreConfigIfNeeded() {
  const storeConfig = readStoreConfig();
  if (!storeConfig) return;
  
  if (!storeConfig.resupplyItems) {
    storeConfig.resupplyItems = [
      { id: 'limited-restock', name: 'Limited restock', price: 2000, enabled: true },
      { id: 'repair', name: 'Repair', price: 4000, enabled: true },
      { id: 'core-battery', name: 'Core Battery', price: 8000, enabled: true }
    ];
    writeStoreConfig(storeConfig);
    console.log('Store config migrated: added resupply items');
  }
}


// Read Voting Periods
function readVotingPeriods() {
  try {
    const data = fs.readFileSync(VOTING_PERIODS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { periods: [] };
  }
}

// Write Voting Periods
function writeVotingPeriods(votingPeriodsData) {
  fs.writeFileSync(VOTING_PERIODS_FILE, JSON.stringify(votingPeriodsData, null, 2));
}

// Initialize voting periods with empty data
function initializeVotingPeriods() {
  if (!fs.existsSync(VOTING_PERIODS_FILE)) {
    const defaultVotingPeriods = {
      periods: []
    };
    writeVotingPeriods(defaultVotingPeriods);
  }
}

// Helper function to auto-archive ongoing voting period
async function archiveOngoingVotingPeriod(reason) {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = readVotingPeriods();
    const ongoingPeriod = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
    
    if (ongoingPeriod) {
      const periodIndex = votingPeriodsData.periods.findIndex(p => p.id === ongoingPeriod.id);
      if (periodIndex !== -1) {
        votingPeriodsData.periods[periodIndex].state = 'Archived';
        writeVotingPeriods(votingPeriodsData);
        
        // Broadcast voting period update
        broadcastSSE('voting-periods', { 
          action: 'auto-archive', 
          votingPeriod: votingPeriodsData.periods[periodIndex], 
          periods: votingPeriodsData.periods,
          reason: reason
        });
      }
    }
  } catch (error) {
    console.error('Error auto-archiving voting period:', error);
  } finally {
    fileMutex.release(lockKey);
  }
}


// File storage (Upload Emblem)
const multer = require('multer');
const potrace = require('potrace');

const uploadDir = LOGO_ART_DIR;
fs.mkdirSync(uploadDir, { recursive: true });

const tmpUploadDir = path.join(DATA_DIR, 'uploads_tmp');
fs.mkdirSync(tmpUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpUploadDir),
  filename: (req, file, cb) => {
    const normalized = String(file.originalname || '').replace(/\\/g, '/');
    const ext = path.posix.extname(normalized).toLowerCase();
    cb(null, `${helpers.generateId()}${ext || ''}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!FILE_UPLOAD.ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, and BMP images are allowed'));
    }
    cb(null, true);
  },
  limits: {
    files: 1,
    fileSize: FILE_UPLOAD.MAX_SIZE
  }
});

// Save uploaded Emblem files to logo_art + .svg conversion (overwrite-by-name)
app.post('/upload', (req, res) => {
  upload.single('myFile')(req, res, async (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const base = helpers.sanitizeEmblemBaseName(req.file.originalname);
    if (!base) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch {
        // ignore
      }
      return res.status(400).json({ success: false, message: 'Invalid file name' });
    }

    const svgFilename = `${base}.svg`;
    const outputPath = path.join(uploadDir, svgFilename);

    try {
      const svg = await new Promise((resolve, reject) => {
        potrace.trace(req.file.path, { threshold: 128 }, (traceErr, result) => {
          if (traceErr) return reject(traceErr);
          resolve(result);
        });
      });

      await fs.promises.writeFile(outputPath, svg, 'utf8');
      return res.json({
        success: true,
        emblem: svgFilename,
        url: `/emblems/${encodeURIComponent(svgFilename)}`
      });
    } catch (convertErr) {
      console.error(convertErr);
      return res.status(500).json({ success: false, message: 'SVG conversion failed' });
    } finally {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupErr) {
        if (cleanupErr && cleanupErr.code !== 'ENOENT') {
          console.error('Temp cleanup failed:', cleanupErr);
        }
      }
    }
  });
});

// Initialize data on startup
// Order matters: factions before jobs, jobs and manna before pilots, reserves before store-config
initializeSettings();
initializeFactions();
initializeManna();
initializeData();
initializeReserves();
initializeStoreConfig();
initializePilots();
initializeVotingPeriods();

// Migrate base modules to facilities (clean break migration)
migrateBaseToFacilities();

// Initialize new facility system
initializeCoreMajorFacilities();
initializeMinorFacilitiesSlots();

// Migrate existing jobs to add new fields
migrateJobsIfNeeded();

// Migrate existing factions to add offset fields
migrateFactionsIfNeeded();

// Migrate existing transactions to add UUIDs
migrateTransactionsIfNeeded();

// Migrate existing pilots to add personalOperationProgress, personalTransactions, and reserves fields
migratePilotsIfNeeded();

// Migrate existing store config to add resupply items
migrateStoreConfigIfNeeded();

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

// SSE endpoint
app.get('/api/sse', requireAnyAuth, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection message
  res.write('event: connected\ndata: {"message":"SSE connection established"}\n\n');
  
  // Add client to set
  sseClients.add(res);
  
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
    sseClients.delete(res);
  });
});

// Routes
app.get('/', (req, res) => {
  const settings = readSettings();
  res.render('landing', { error: req.query.error, colorScheme: settings.colorScheme, settings });
});

app.post('/authenticate', (req, res) => {
  const password = req.body.password;
  const settings = readSettings();
  
  // Check against passwords from settings
  if (password === settings.clientPassword) {
    req.session.role = 'client';
    res.redirect('/client/overview');
  } else if (password === settings.adminPassword) {
    req.session.role = 'admin';
    res.redirect('/admin');
  } else {
    res.redirect('/?error=invalid');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// Client routes
app.get('/client', requireClientAuth, (req, res) => {
  res.redirect('/client/overview');
});

app.get('/client/overview', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const manna = readManna();
  const pilots = readPilots();
  
  // Calculate active pilot balances
  const activePilotBalances = helpers.getActivePilotBalances(pilots, manna.transactions);
  const totalBalance = activePilotBalances.reduce((sum, pb) => sum + pb.balance, 0);
  
  // Get full unique transaction history with pilot info (newest-first)
  const allTransactions = helpers.getDeduplicatedTransactionHistory(pilots, manna.transactions, 0);
  
  // Calculate cumulative balances across all transactions (oldest-first for running total)
  const sortedOldestFirst = [...allTransactions].reverse();
  const withCumulativeOldestFirst = helpers.calculateCumulativeBalances(sortedOldestFirst);
  
  // Convert back to newest-first and take the last 5 for display
  const withCumulativeNewestFirst = [...withCumulativeOldestFirst].reverse();
  const recentWithBalance = withCumulativeNewestFirst.slice(0, 5);
  
  res.render('client-overview', { 
    settings, 
    colorScheme: settings.colorScheme, 
    totalBalance,
    recentTransactions: recentWithBalance
  });
});

app.get('/client/finances', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const manna = readManna();
  const pilots = readPilots();
  
  // Calculate active pilot balances
  const activePilotBalances = helpers.getActivePilotBalances(pilots, manna.transactions);
  const totalBalance = activePilotBalances.reduce((sum, pb) => sum + pb.balance, 0);
  
  // Get all unique transactions with pilot info
  const allTransactions = helpers.getDeduplicatedTransactionHistory(pilots, manna.transactions, 0);
  
  // Calculate cumulative balances (need oldest first for calculation)
  const sortedOldestFirst = [...allTransactions].reverse();
  const withCumulative = helpers.calculateCumulativeBalances(sortedOldestFirst);
  
  // Reverse back to newest first for display
  const transactionsForDisplay = withCumulative.reverse();
  
  res.render('client-finances', { 
    settings, 
    colorScheme: settings.colorScheme, 
    totalBalance,
    allTransactions: transactionsForDisplay
  });
});

app.get('/client/jobs', requireClientAuth, (req, res) => {
  const allJobs = readJobs();
  // Filter to show only Active jobs for clients
  const jobs = allJobs.filter(job => job.state === 'Active');
  const settings = readSettings();
  const factions = readFactions();
  
  // Enrich jobs with faction data
  const enrichedJobs = enrichJobsWithFactions(jobs, factions);
  
  res.render('client-jobs', { jobs: enrichedJobs, settings, colorScheme: settings.colorScheme });
});

app.get('/client/base', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const coreMajorFacilities = readCoreMajorFacilities();
  const minorFacilitiesSlots = readMinorFacilitiesSlots();
  const pilots = readPilots();
  const manna = readManna();
  
  // Enrich pilots with balance information
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  res.render('client-base', { 
    settings, 
    colorScheme: settings.colorScheme, 
    coreMajorFacilities,
    minorFacilitiesSlots,
    pilots: enrichedPilots,
    minorOptions: DEFAULT_MINOR_FACILITIES
  });
});

app.get('/client/factions', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const factions = readFactions();
  const jobs = readJobs();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = enrichAllFactions(factions, jobs);
  
  res.render('client-factions', { settings, colorScheme: settings.colorScheme, factions: enrichedFactions });
});

app.get('/client/pilots', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const pilots = readPilots();
  const manna = readManna();
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  res.render('client-pilots', { settings, colorScheme: settings.colorScheme, pilots: enrichedPilots, manna });
});

app.get('/client/shop', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const pilots = readPilots();
  const manna = readManna();
  const reserves = readReserves();
  const storeConfig = readStoreConfig();
  
  // Validate storeConfig exists
  if (!storeConfig) {
    return res.status(500).send('Error: Store configuration not found');
  }
  
  // Enrich pilots with balance information
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  // Get reserves from current stock
  const stockReserves = (storeConfig.currentStock || [])
    .map(id => reserves.find(r => r.id === id))
    .filter(r => r !== undefined)
    .sort((a, b) => {
      // Sort by rank ascending, then by name A-Z
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    });
  
  res.render('client-shop', { 
    settings, 
    colorScheme: settings.colorScheme, 
    pilots: enrichedPilots,
    allReserves: reserves,
    stockReserves,
    storeConfig,
    resupplyItems: storeConfig.resupplyItems || []
  });
});

app.get('/client/reserves', requireClientAuth, (req, res) => {
  const settings = readSettings();
  const pilots = readPilots();
  const manna = readManna();
  const reserves = readReserves();
  
  // Filter pilots to only those with reserves
  const pilotsWithReserves = pilots.filter(p => p.reserves && p.reserves.length > 0);
  
  // Enrich pilots with balance and reserve objects
  let enrichedPilots = enrichPilotsWithBalance(pilotsWithReserves, manna);
  enrichedPilots = helpers.enrichPilotsWithReserves(enrichedPilots, reserves);
  
  res.render('client-reserves', { 
    settings, 
    colorScheme: settings.colorScheme, 
    pilots: enrichedPilots,
    allPilots: pilots,  // Pass all pilots for transfer modal
    allReserves: reserves
  });
});

app.get('/admin', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  const manna = readManna();
  const coreMajorFacilities = readCoreMajorFacilities();
  const minorFacilitiesSlots = readMinorFacilitiesSlots();
  const factions = readFactions();
  const pilots = readPilots();
  const reserves = readReserves();
  const storeConfig = readStoreConfig();
  const votingPeriodsData = readVotingPeriods();
  const emblemFiles = fs.readdirSync(LOGO_ART_DIR)
    .filter(file => file.endsWith('.svg'))
    .sort();
  
  // Calculate balances from pilot transactions
  const balances = calculateBalancesFromPilots();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = enrichAllFactions(factions, jobs);
  
  // Enrich pilots with balance information
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  // Create faction lookup map for efficient template rendering
  const factionMap = createFactionMap(enrichedFactions);
  
  // Enrich jobs with faction data and state class, then reverse for newest first
  const enrichedJobs = jobs.map(job => ({
    ...job,
    stateClass: job.state ? job.state.toLowerCase() : helpers.DEFAULT_JOB_STATE.toLowerCase(),
    faction: factionMap[job.factionId] || null
  })).reverse();
  
  // Get active job IDs for voting period creation
  const activeJobIds = jobs.filter(j => j.state === 'Active').map(j => j.id);
  
  // Get ongoing voting period
  const ongoingPeriod = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
  
  res.render('admin', { 
    jobs: enrichedJobs, 
    settings, 
    manna, 
    balances,
    coreMajorFacilities,
    minorFacilitiesSlots,
    minorFacilityOptions: DEFAULT_MINOR_FACILITIES,
    factions: enrichedFactions, 
    pilots: enrichedPilots,
    reserves,
    storeConfig,
    votingPeriods: votingPeriodsData.periods || [],
    activeJobIds: activeJobIds,
    ongoingPeriod: ongoingPeriod,
    emblems: emblemFiles, 
    formatEmblemTitle: helpers.formatEmblemTitle,
    jobStates: helpers.JOB_STATES,
    defaultJobState: helpers.DEFAULT_JOB_STATE
  });
});

// API endpoints for admin operations
app.get('/api/jobs', requireAnyAuth, (req, res) => {
  const jobs = readJobs();
  const factions = readFactions();
  
  // Enrich jobs with faction data
  const enrichedJobs = enrichJobsWithFactions(jobs, factions);
  
  res.json(enrichedJobs);
});

app.post('/api/jobs', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const factions = readFactions();
  
  // Validate job data
  const validation = validateJobData(req.body, factions, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newJob = {
    id: helpers.generateId(),
    name: req.body.name,
    rank: parseInt(req.body.rank),
    jobType: req.body.jobType,
    description: req.body.description,
    clientBrief: req.body.clientBrief,
    currencyPay: req.body.currencyPay,
    additionalPay: req.body.additionalPay,
    emblem: validation.emblem,
    state: validation.state,
    factionId: validation.factionId
  };
  jobs.push(newJob);
  writeJobs(jobs);
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'create', job: newJob, jobs });
  
  res.json({ success: true, job: newJob });
});

app.put('/api/jobs/:id', requireAdminAuth, async (req, res) => {
  const jobs = readJobs();
  const factions = readFactions();
  
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Store old job state to check for Active -> other state transitions
  const oldJob = jobs[index];
  const wasActive = oldJob.state === 'Active';
  
  // Validate job data
  const validation = validateJobData(req.body, factions, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newJob = {
    id: req.params.id,
    name: req.body.name,
    rank: parseInt(req.body.rank),
    jobType: req.body.jobType,
    description: req.body.description,
    clientBrief: req.body.clientBrief,
    currencyPay: req.body.currencyPay,
    additionalPay: req.body.additionalPay,
    emblem: validation.emblem,
    state: validation.state,
    factionId: validation.factionId
  };
  
  jobs[index] = newJob;
  writeJobs(jobs);
  
  // Auto-archive ongoing voting period if Active job changes to another state
  if (wasActive && newJob.state !== 'Active') {
    await archiveOngoingVotingPeriod('Active job state changed');
  }
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'update', job: jobs[index], jobs });
  
  res.json({ success: true, job: jobs[index] });
});

app.delete('/api/jobs/:id', requireAdminAuth, (req, res) => {
  let jobs = readJobs();
  jobs = jobs.filter(j => j.id !== req.params.id);
  writeJobs(jobs);
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'delete', jobId: req.params.id, jobs });
  
  res.json({ success: true });
});

// API endpoint to update job state only
app.put('/api/jobs/:id/state', requireAdminAuth, async (req, res) => {
  const jobs = readJobs();
  const index = jobs.findIndex(j => j.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Store old job state to check for Active -> other state transitions
  const oldJob = jobs[index];
  const wasActive = oldJob.state === 'Active';
  
  // Validate job state
  const stateValidation = helpers.validateJobState(req.body.state);
  if (!stateValidation.valid) {
    return res.status(400).json({ success: false, message: stateValidation.message });
  }
  
  // Update only the state field
  jobs[index].state = stateValidation.value;
  writeJobs(jobs);
  
  // Auto-archive ongoing voting period if Active job changes to another state
  if (wasActive && stateValidation.value !== 'Active') {
    await archiveOngoingVotingPeriod('Active job state changed');
  }
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'update', job: jobs[index], jobs });
  
  res.json({ success: true, job: jobs[index] });
});

// API endpoints for settings
app.get('/api/settings', requireAnyAuth, (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

app.put('/api/settings', requireAdminAuth, (req, res) => {
  // Validate portal heading
  const headingValidation = helpers.validateRequiredString(req.body.portalHeading, 'Portal Heading', 100);
  if (!headingValidation.valid) {
    return res.status(400).json({ success: false, message: headingValidation.message });
  }
  
  // Validate color scheme
  const colorScheme = req.body.colorScheme || 'grey';
  if (!helpers.isValidColorScheme(colorScheme)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid color scheme. Must be one of: ${helpers.VALID_COLOR_SCHEMES.join(', ')}` 
    });
  }
  
  // Validate user group
  const userGroupValidation = helpers.validateRequiredString(req.body.userGroup, 'User Group', 100);
  if (!userGroupValidation.valid) {
    return res.status(400).json({ success: false, message: userGroupValidation.message });
  }
  
  // Validate UNT date format
  const unt = req.body.unt ?? '';
  const dateValidation = helpers.validateDate(unt);
  if (!dateValidation.valid) {
    return res.status(400).json({ success: false, message: dateValidation.message });
  }
  
  // Validate operation progress
  const operationProgress = parseInt(req.body.operationProgress ?? 0);
  if (isNaN(operationProgress) || operationProgress < 0 || operationProgress > 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operation Progress must be between 0 and 3' 
    });
  }
  
  // Parse openTable boolean
  const openTable = req.body.openTable === 'true' || req.body.openTable === true;
  
  // Validate passwords (alphanumeric only, empty allowed)
  const clientPasswordValidation = helpers.validatePassword(req.body.clientPassword, 'Pilot Password');
  if (!clientPasswordValidation.valid) {
    return res.status(400).json({ success: false, message: clientPasswordValidation.message });
  }
  
  const adminPasswordValidation = helpers.validatePassword(req.body.adminPassword, 'Admin Password');
  if (!adminPasswordValidation.valid) {
    return res.status(400).json({ success: false, message: adminPasswordValidation.message });
  }
  
  // Validate that CLIENT and ADMIN passwords are different (if both are non-empty)
  if (clientPasswordValidation.value !== '' && 
      adminPasswordValidation.value !== '' && 
      clientPasswordValidation.value === adminPasswordValidation.value) {
    return res.status(400).json({ 
      success: false, 
      message: 'Pilot Password and Admin Password must be different' 
    });
  }
  
  // Validate facility cost modifier
  const facilityCostModifier = parseFloat(req.body.facilityCostModifier ?? 0);
  if (isNaN(facilityCostModifier) || facilityCostModifier < -100 || facilityCostModifier > 300) {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility Cost Modifier must be between -100 and 300' 
    });
  }
  
  // Validate currency icon (optional, defaults to manna_symbol.svg)
  const currencyIcon = (req.body.currencyIcon ?? 'manna_symbol.svg').trim();
  if (currencyIcon !== '') {
    const emblemValidation = helpers.validateEmblem(currencyIcon, path.join(BASE_PATH, 'logo_art'));
    if (!emblemValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid currency icon: ${emblemValidation.message}` 
      });
    }
  }
  
  const settings = {
    portalHeading: headingValidation.value,
    unt: unt.trim(),
    currentGalacticPos: (req.body.currentGalacticPos ?? '').trim(),
    colorScheme: colorScheme,
    userGroup: userGroupValidation.value,
    operationProgress: operationProgress,
    openTable: openTable,
    clientPassword: clientPasswordValidation.value,
    adminPassword: adminPasswordValidation.value,
    facilityCostModifier: facilityCostModifier,
    currencyIcon: currencyIcon || 'manna_symbol.svg'
  };
  
  writeSettings(settings);
  
  // Broadcast SSE update
  broadcastSSE('settings', { action: 'update', settings });
  
  res.json({ success: true, settings });
});

// ==================== RESERVES API ENDPOINTS ====================
app.get('/api/reserves', requireAnyAuth, (req, res) => {
  const reserves = readReserves();
  res.json(reserves);
});

app.post('/api/reserves', requireAdminAuth, (req, res) => {
  const reserves = readReserves();
  
  // Validate reserve data
  const validation = helpers.validateReserveData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newReserve = {
    id: helpers.generateId(),
    rank: validation.rank,
    name: validation.name,
    price: validation.price,
    description: validation.description,
    isCustom: true // All reserves created via admin are custom
  };
  
  reserves.push(newReserve);
  writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'create', reserve: newReserve, reserves });
  
  res.json({ success: true, reserve: newReserve });
});

app.put('/api/reserves/:id', requireAdminAuth, (req, res) => {
  const reserves = readReserves();
  const index = reserves.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found' });
  }
  
  // Validate reserve data
  const validation = helpers.validateReserveData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  // Update reserve (preserve ID and isCustom flag)
  reserves[index] = {
    id: reserves[index].id,
    rank: validation.rank,
    name: validation.name,
    price: validation.price,
    description: validation.description,
    isCustom: reserves[index].isCustom
  };
  
  writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'update', reserve: reserves[index], reserves });
  
  res.json({ success: true, reserve: reserves[index] });
});

app.delete('/api/reserves/:id', requireAdminAuth, (req, res) => {
  const reserves = readReserves();
  const pilots = readPilots();
  const storeConfig = readStoreConfig();
  
  const index = reserves.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found' });
  }
  
  // Check if reserve is in use by any pilot
  const inUseByPilot = pilots.some(pilot => 
    pilot.reserves && pilot.reserves.some(r => {
      // Handle both legacy UUID format and new object format
      if (typeof r === 'string') {
        return r === req.params.id;
      } else if (r && typeof r === 'object') {
        return r.reserveId === req.params.id;
      }
      return false;
    })
  );
  
  if (inUseByPilot) {
    return res.status(409).json({ 
      success: false, 
      message: 'Cannot delete reserve: it is currently owned by one or more pilots' 
    });
  }
  
  // Remove from store stock if present
  if (storeConfig && storeConfig.currentStock) {
    const updatedStock = storeConfig.currentStock.filter(id => id !== req.params.id);
    if (updatedStock.length !== storeConfig.currentStock.length) {
      storeConfig.currentStock = updatedStock;
      writeStoreConfig(storeConfig);
      broadcastSSE('store-config', { action: 'update', storeConfig });
    }
  }
  
  const deletedReserve = reserves[index];
  reserves.splice(index, 1);
  writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'delete', reserveId: req.params.id, reserves });
  
  res.json({ success: true, reserve: deletedReserve });
});

// ==================== VOTING PERIOD API ENDPOINTS ====================
app.get('/api/voting-periods', requireAnyAuth, (req, res) => {
  const votingPeriodsData = readVotingPeriods();
  res.json(votingPeriodsData);
});

app.post('/api/voting-periods', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = readVotingPeriods();
    const jobs = readJobs();
    const pilots = readPilots();
    
    // Check if there's already an ongoing voting period
    const existingOngoing = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
    if (existingOngoing) {
      return res.status(400).json({ 
        success: false, 
        message: 'There is already an ongoing voting period. Please archive it before starting a new one.' 
      });
    }
    
    // Validate voting period data
    const validation = helpers.validateVotingPeriodData(req.body, jobs, pilots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    const newVotingPeriod = {
      id: helpers.generateId(),
      state: validation.state,
      jobVotes: validation.jobVotes,
      endTime: validation.endTime
    };
    
    votingPeriodsData.periods.push(newVotingPeriod);
    writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'create', votingPeriod: newVotingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: newVotingPeriod });
  } catch (error) {
    console.error('Error creating voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to create voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

app.put('/api/voting-periods/:id', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = readVotingPeriods();
    const jobs = readJobs();
    const pilots = readPilots();
    
    const index = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    // Validate voting period data
    const validation = helpers.validateVotingPeriodData(req.body, jobs, pilots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    // If changing state to Ongoing, check if there's already another ongoing period
    if (validation.state === 'Ongoing' && votingPeriodsData.periods[index].state !== 'Ongoing') {
      const existingOngoing = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
      if (existingOngoing && existingOngoing.id !== req.params.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'There is already an ongoing voting period. Please archive it before starting a new one.' 
        });
      }
    }
    
    const updatedVotingPeriod = {
      id: req.params.id,
      state: validation.state,
      jobVotes: validation.jobVotes,
      endTime: validation.endTime
    };
    
    votingPeriodsData.periods[index] = updatedVotingPeriod;
    writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'update', votingPeriod: updatedVotingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: updatedVotingPeriod });
  } catch (error) {
    console.error('Error updating voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to update voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

app.delete('/api/voting-periods/:id', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = readVotingPeriods();
    
    const index = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    const deletedPeriod = votingPeriodsData.periods[index];
    votingPeriodsData.periods.splice(index, 1);
    writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update (normalized to include votingPeriod instead of periodId)
    broadcastSSE('voting-periods', { action: 'delete', votingPeriod: deletedPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: deletedPeriod });
  } catch (error) {
    console.error('Error deleting voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to delete voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

// Cast vote endpoint - CLIENT accessible
app.post('/api/voting-periods/:id/cast-vote', requireClientAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    // Acquire mutex lock to prevent race conditions
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = readVotingPeriods();
    const pilots = readPilots();
    const jobs = readJobs();
    
    const { pilotId, jobId } = req.body;
    
    // Validate required fields
    if (!pilotId || !jobId) {
      return res.status(400).json({ success: false, message: 'pilotId and jobId are required' });
    }
    
    // Find voting period
    const votingPeriod = votingPeriodsData.periods.find(p => p.id === req.params.id);
    if (!votingPeriod) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    // Validate voting period is ongoing
    if (votingPeriod.state !== 'Ongoing') {
      return res.status(400).json({ success: false, message: 'Voting period is not ongoing' });
    }
    
    // Check if voting period has ended (server-side validation)
    if (votingPeriod.endTime !== null) {
      const now = new Date();
      const endTime = new Date(votingPeriod.endTime);
      if (now > endTime) {
        return res.status(400).json({ success: false, message: 'Voting period has ended' });
      }
    }
    
    // Validate pilot exists
    const pilot = pilots.find(p => p.id === pilotId);
    if (!pilot) {
      return res.status(400).json({ success: false, message: 'Pilot not found' });
    }
    
    // Validate job exists and is Active state
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(400).json({ success: false, message: 'Job not found' });
    }
    if (job.state !== 'Active') {
      return res.status(400).json({ success: false, message: 'Can only vote for Active jobs' });
    }
    
    // Validate job is in the voting period
    const jobVoteEntry = votingPeriod.jobVotes.find(jv => jv.jobId === jobId);
    if (!jobVoteEntry) {
      return res.status(400).json({ success: false, message: 'Job is not part of this voting period' });
    }
    
    // Remove pilot's vote from any other job (pilot can only vote for one job)
    votingPeriod.jobVotes.forEach(jv => {
      const index = jv.votes.indexOf(pilotId);
      if (index !== -1) {
        jv.votes.splice(index, 1);
      }
    });
    
    // Add pilot's vote to the selected job (if not already there)
    if (!jobVoteEntry.votes.includes(pilotId)) {
      jobVoteEntry.votes.push(pilotId);
    }
    
    // Update the voting period
    const periodIndex = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    votingPeriodsData.periods[periodIndex] = votingPeriod;
    writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'vote-cast', votingPeriod: votingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: votingPeriod });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    fileMutex.release(lockKey);
  }
});

// ==================== STORE CONFIG API ENDPOINTS ====================
app.get('/api/store-config', requireAnyAuth, (req, res) => {
  const storeConfig = readStoreConfig();
  res.json(storeConfig);
});

app.put('/api/store-config', requireAdminAuth, (req, res) => {
  const storeConfig = readStoreConfig() || {};
  
  // Update resupply items if provided
  if (req.body.resupplyItems) {
    // Validate resupply items array
    if (!Array.isArray(req.body.resupplyItems) || req.body.resupplyItems.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Resupply items must be an array of exactly 3 items' 
      });
    }
    
    // Validate each resupply item
    for (const item of req.body.resupplyItems) {
      if (!item.id || !item.name || typeof item.price !== 'number' || typeof item.enabled !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          message: 'Each resupply item must have id, name, price, and enabled fields' 
        });
      }
      
      if (item.price < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Resupply item prices must be non-negative' 
        });
      }
    }
    
    storeConfig.resupplyItems = req.body.resupplyItems;
  }
  
  // Update current stock if provided
  if (req.body.currentStock !== undefined) {
    if (!Array.isArray(req.body.currentStock)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current stock must be an array' 
      });
    }
    
    // Validate reserve UUIDs exist
    const reserves = readReserves();
    const validation = helpers.validateReserveIds(req.body.currentStock, reserves);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    storeConfig.currentStock = req.body.currentStock;
  }
  
  // Update resupply settings if provided
  if (req.body.resupplySettings) {
    storeConfig.resupplySettings = req.body.resupplySettings;
  }
  
  writeStoreConfig(storeConfig);
  
  // Broadcast SSE update
  broadcastSSE('store-config', { action: 'update', storeConfig });
  
  res.json({ success: true, storeConfig });
});

// Add random reserve to store stock
app.post('/api/store-config/add-random', requireAdminAuth, (req, res) => {
  const storeConfig = readStoreConfig();
  const reserves = readReserves();
  
  // Get filter parameters from request body
  const { rankFilter, hideDefaultReserves } = req.body;
  
  // Filter reserves based on parameters
  let filteredReserves = reserves;
  
  // Apply rank filter
  if (rankFilter && rankFilter !== 'all') {
    const rank = parseInt(rankFilter);
    filteredReserves = filteredReserves.filter(r => r.rank === rank);
  }
  
  // Apply hide default reserves filter
  if (hideDefaultReserves) {
    filteredReserves = filteredReserves.filter(r => r.isCustom);
  }
  
  if (filteredReserves.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No reserves match the current filter' 
    });
  }
  
  // Pick a random reserve from filtered list
  const randomIndex = Math.floor(Math.random() * filteredReserves.length);
  const selectedReserve = filteredReserves[randomIndex];
  
  // Add to stock
  storeConfig.currentStock = storeConfig.currentStock || [];
  storeConfig.currentStock.push(selectedReserve.id);
  
  writeStoreConfig(storeConfig);
  
  // Broadcast SSE update
  broadcastSSE('store-config', { action: 'update', storeConfig });
  
  res.json({ 
    success: true, 
    storeConfig, 
    addedReserve: selectedReserve 
  });
});

// Remove reserve from store stock
app.post('/api/store-config/remove-stock', requireAdminAuth, (req, res) => {
  const storeConfig = readStoreConfig();
  const { reserveIds, removeAll } = req.body;
  
  if (removeAll) {
    // Remove all selected reserves from stock
    if (!Array.isArray(reserveIds) || reserveIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No reserves selected to remove' 
      });
    }
    
    const initialLength = storeConfig.currentStock.length;
    storeConfig.currentStock = storeConfig.currentStock.filter(id => !reserveIds.includes(id));
    const removedCount = initialLength - storeConfig.currentStock.length;
    
    writeStoreConfig(storeConfig);
    broadcastSSE('store-config', { action: 'update', storeConfig });
    
    return res.json({ 
      success: true, 
      storeConfig, 
      removedCount 
    });
  } else {
    // Remove single reserve (first occurrence)
    if (!reserveIds || reserveIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No reserve selected to remove' 
      });
    }
    
    const reserveId = reserveIds[0];
    const index = storeConfig.currentStock.indexOf(reserveId);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reserve not found in stock' 
      });
    }
    
    storeConfig.currentStock.splice(index, 1);
    
    writeStoreConfig(storeConfig);
    broadcastSSE('store-config', { action: 'update', storeConfig });
    
    return res.json({ 
      success: true, 
      storeConfig 
    });
  }
});

// API endpoint to delete emblem
app.delete('/api/emblems/:filename', requireAdminAuth, async (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!helpers.isSafeEmblemFilename(filename)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid emblem filename' 
    });
  }
  
  const emblemPath = path.join(uploadDir, filename);
  
  // Check if emblem file exists
  if (!fs.existsSync(emblemPath)) {
    return res.status(404).json({ 
      success: false, 
      message: 'Emblem not found' 
    });
  }
  
  // Check if emblem is in use by any job or faction
  const jobs = readJobs();
  const factions = readFactions();
  const inUseByJob = jobs.some(job => job.emblem === filename);
  const inUseByFaction = factions.some(faction => faction.emblem === filename);
  if (inUseByJob || inUseByFaction) {
    return res.status(409).json({ 
      success: false, 
      message: 'Cannot delete emblem: it is currently in use by one or more jobs or factions' 
    });
  }
  
  // Delete the emblem file
  try {
    await fs.promises.unlink(emblemPath);
    res.json({ success: true, message: 'Emblem deleted successfully' });
  } catch (error) {
    console.error('Error deleting emblem:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete emblem file' 
    });
  }
});

// Manna API endpoints
app.get('/api/manna', requireAnyAuth, (req, res) => {
  const manna = readManna();
  const balances = calculateBalancesFromPilots();
  res.json({ ...manna, balances });
});

app.post('/api/manna/transaction', requireAdminAuth, (req, res) => {
  const rawAmount = req.body.amount;
  const parsedAmount = Number.isInteger(rawAmount) ? rawAmount : parseInt(rawAmount, 10);
  const description = req.body.description || '';
  let pilotIds = req.body.pilotIds || [];
  
  // Validate amount is a valid integer
  if (Number.isNaN(parsedAmount)) {
    return res.status(400).json({
      success: false,
      message: 'Transaction amount must be a valid integer'
    });
  }
  
  // Validate amount is non-zero
  if (parsedAmount === 0) {
    return res.status(400).json({
      success: false,
      message: 'Transaction amount must be non-zero'
    });
  }
  
  if (!description.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction description is required' 
    });
  }
  
  // Ensure pilotIds is an array
  if (!Array.isArray(pilotIds)) {
    try {
      pilotIds = JSON.parse(pilotIds);
    } catch (e) {
      pilotIds = [];
    }
  }
  
  const manna = readManna();
  const pilots = readPilots();
  
  // If no pilots specified, use all active pilots (may result in an empty list if none are active)
  if (pilotIds.length === 0) {
    pilotIds = pilots.filter(p => p.active).map(p => p.id);
  } else {
    // Validate that all provided pilot IDs exist
    const validPilotIds = pilots.map(p => p.id);
    const invalidPilotIds = pilotIds.filter(id => !validPilotIds.includes(id));
    
    if (invalidPilotIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid pilot IDs: ${invalidPilotIds.join(', ')}`
      });
    }
  }
  
  // Create new transaction
  const newTransaction = {
    id: helpers.generateId(),
    date: new Date().toISOString(),
    amount: parsedAmount,
    description: description.trim()
  };
  
  manna.transactions.push(newTransaction);
  writeManna(manna);
  
  // Associate transaction with specified pilots
  let updatedPilots = false;
  pilots.forEach(pilot => {
    if (pilotIds.includes(pilot.id)) {
      if (!pilot.personalTransactions) {
        pilot.personalTransactions = [];
      }
      pilot.personalTransactions.push(newTransaction.id);
      updatedPilots = true;
    }
  });
  
  if (updatedPilots) {
    writePilots(pilots);
  }
  
  // Calculate new balances
  const balances = calculateBalancesFromPilots();
  
  // Enrich pilots with balance for SSE broadcast (manna already declared above)
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE updates with enriched pilot data
  broadcastSSE('manna', { action: 'transaction', manna, balances });
  if (updatedPilots) {
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  }
  
  res.json({ success: true, manna, transaction: newTransaction, balances });
});

app.put('/api/manna/transaction/:id', requireAdminAuth, (req, res) => {
  const manna = readManna();
  const transactionIndex = manna.transactions.findIndex(t => t.id === req.params.id);
  
  if (transactionIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }
  
  // Validate inputs
  const amount = parseInt(req.body.amount);
  const description = req.body.description || '';
  const date = req.body.date;
  
  if (isNaN(amount)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Amount must be a valid number' 
    });
  }
  
  if (!description.trim()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction description is required' 
    });
  }
  
  if (!date) {
    return res.status(400).json({ 
      success: false, 
      message: 'Transaction date is required' 
    });
  }
  
  // Update transaction preserving balance
  manna.transactions[transactionIndex] = {
    id: req.params.id,
    date: date,
    amount: amount,
    description: description.trim()
  };
  
  writeManna(manna);
  
  // Broadcast SSE update
  broadcastSSE('manna', { action: 'update', manna });
  
  res.json({ success: true, transaction: manna.transactions[transactionIndex] });
});

app.delete('/api/manna/transaction/:id', requireAdminAuth, (req, res) => {
  const manna = readManna();
  const transactionIndex = manna.transactions.findIndex(t => t.id === req.params.id);
  
  if (transactionIndex === -1) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }
  
  const transactionId = req.params.id;
  
  // Remove the transaction from manna
  manna.transactions.splice(transactionIndex, 1);
  writeManna(manna);
  
  // Remove transaction from all pilots
  const pilots = readPilots();
  let pilotsUpdated = false;
  pilots.forEach(pilot => {
    if (pilot.personalTransactions && pilot.personalTransactions.includes(transactionId)) {
      pilot.personalTransactions = pilot.personalTransactions.filter(id => id !== transactionId);
      pilotsUpdated = true;
    }
  });
  
  // Calculate new balances
  const balances = calculateBalancesFromPilots();
  
  // Broadcast updated pilots enriched with balance information
  if (pilotsUpdated) {
    writePilots(pilots);
    // Use existing manna variable instead of re-reading from disk (already modified above)
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  }
  
  // Broadcast SSE update for manna and balances
  broadcastSSE('manna', { action: 'delete', manna, balances });
  
  res.json({ success: true, balances });
});

// Update pilot associations for a transaction
app.put('/api/manna/transaction/:id/pilots', requireAdminAuth, (req, res) => {
  const manna = readManna();
  const transaction = manna.transactions.find(t => t.id === req.params.id);
  
  if (!transaction) {
    return res.status(404).json({ 
      success: false, 
      message: 'Transaction not found' 
    });
  }
  
  let pilotIds = req.body.pilotIds || [];
  
  // Ensure pilotIds is an array
  if (!Array.isArray(pilotIds)) {
    try {
      pilotIds = JSON.parse(pilotIds);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pilot IDs format'
      });
    }
  }
  
  const pilots = readPilots();
  const transactionId = req.params.id;
  
  // Validate that all provided pilot IDs exist
  if (pilotIds.length > 0) {
    const validPilotIds = pilots.map(p => p.id);
    const invalidPilotIds = pilotIds.filter(id => !validPilotIds.includes(id));
    
    if (invalidPilotIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid pilot IDs: ${invalidPilotIds.join(', ')}`
      });
    }
  }
  
  // Remove transaction from all pilots first
  pilots.forEach(pilot => {
    if (pilot.personalTransactions && pilot.personalTransactions.includes(transactionId)) {
      pilot.personalTransactions = pilot.personalTransactions.filter(id => id !== transactionId);
    }
  });
  
  // Add transaction to selected pilots
  pilots.forEach(pilot => {
    if (pilotIds.includes(pilot.id)) {
      if (!pilot.personalTransactions) {
        pilot.personalTransactions = [];
      }
      if (!pilot.personalTransactions.includes(transactionId)) {
        pilot.personalTransactions.push(transactionId);
      }
    }
  });
  
  writePilots(pilots);
  
  // Calculate new balances and enrich pilots with balance information for SSE
  const balances = calculateBalancesFromPilots();
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE updates with enriched pilot data
  broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  broadcastSSE('manna', { action: 'update', manna, balances });
  
  res.json({ success: true, balances, pilots: enrichedPilots });
});

// Facilities API endpoints
app.get('/api/facilities/core-major', requireAnyAuth, (req, res) => {
  const facilities = readCoreMajorFacilities();
  res.json(facilities);
});

app.put('/api/facilities/core-major', requireAdminAuth, (req, res) => {
  const facilities = req.body;
  
  if (!Array.isArray(facilities) || facilities.length !== FACILITY_COUNTS.TOTAL_CORE_MAJOR_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Core/Major facilities must have exactly ${FACILITY_COUNTS.TOTAL_CORE_MAJOR_COUNT} facilities` 
    });
  }
  
  // Validate each facility
  for (let i = 0; i < facilities.length; i++) {
    const validation = helpers.validateCoreMajorFacility(facilities[i]);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Facility at index ${i}: ${validation.message}`
      });
    }
  }
  
  writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

app.get('/api/facilities/minor-slots', requireAnyAuth, (req, res) => {
  const minorFacilities = readMinorFacilitiesSlots();
  res.json(minorFacilities);
});

app.put('/api/facilities/minor-slots', requireAdminAuth, (req, res) => {
  const minorFacilities = req.body;
  
  if (!minorFacilities || !minorFacilities.slots || !Array.isArray(minorFacilities.slots) || minorFacilities.slots.length !== FACILITY_COUNTS.MINOR_SLOTS_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Minor facilities must have exactly ${FACILITY_COUNTS.MINOR_SLOTS_COUNT} slots` 
    });
  }
  
  // Validate each slot
  for (let i = 0; i < minorFacilities.slots.length; i++) {
    const validation = helpers.validateMinorFacilitySlot(minorFacilities.slots[i]);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Slot at index ${i}: ${validation.message}`
      });
    }
  }
  
  writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// Get list of available minor facility options (from default data)
app.get('/api/facilities/minor-options', requireAnyAuth, (req, res) => {
  res.json(DEFAULT_MINOR_FACILITIES);
});

// PATCH endpoint to toggle facility purchased status
app.patch('/api/facilities/core-major/:index/purchased', requireAdminAuth, (req, res) => {
  const facilityIndex = parseInt(req.params.index);
  const { isPurchased } = req.body;
  
  const facilities = readCoreMajorFacilities();
  
  if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid facility index' 
    });
  }
  
  facilities[facilityIndex].isPurchased = Boolean(isPurchased);
  writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

// PATCH endpoint to update upgrade count
app.patch('/api/facilities/core-major/:facilityIndex/upgrades/:upgradeIndex', requireAdminAuth, (req, res) => {
  const facilityIndex = parseInt(req.params.facilityIndex);
  const upgradeIndex = parseInt(req.params.upgradeIndex);
  const { upgradeCount } = req.body;
  
  const facilities = readCoreMajorFacilities();
  
  if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid facility index' 
    });
  }
  
  const facility = facilities[facilityIndex];
  
  if (!Array.isArray(facility.upgrades) || facility.upgrades.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Facility has no upgrades configured'
    });
  }
  
  const upgrades = facility.upgrades;
  
  if (Number.isNaN(upgradeIndex) || upgradeIndex < 0 || upgradeIndex >= upgrades.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid upgrade index' 
    });
  }
  
  const upgrade = upgrades[upgradeIndex];
  const count = parseInt(upgradeCount);
  
  if (isNaN(count) || count < 0 || count > upgrade.maxPurchases) {
    return res.status(400).json({ 
      success: false, 
      message: `Upgrade count must be between 0 and ${upgrade.maxPurchases}` 
    });
  }
  
  upgrade.upgradeCount = count;
  writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

// PUT endpoint to assign minor facility to slot
app.put('/api/facilities/minor-slots/:slotNumber/assign', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { facilityName, facilityDescription } = req.body;
  
  const minorFacilities = readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  if (!slot.enabled) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cannot assign facility to disabled slot' 
    });
  }
  
  // Validate facilityName input
  if (typeof facilityName !== 'string' || facilityName.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility name is required and must be a non-empty string' 
    });
  }
  
  // Validate facilityDescription input
  if (facilityDescription !== undefined && typeof facilityDescription !== 'string') {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility description must be a string' 
    });
  }
  
  // Check uniqueness - facility name must not be used in other slots
  const isNameUsed = minorFacilities.slots.some(s => 
    s.slotNumber !== slotNumber && s.facilityName === facilityName
  );
  
  if (isNameUsed) {
    return res.status(400).json({ 
      success: false, 
      message: 'This facility is already assigned to another slot' 
    });
  }
  
  slot.facilityName = facilityName.trim();
  slot.facilityDescription = (facilityDescription || '').trim();
  
  writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// DELETE endpoint to clear minor facility slot
app.delete('/api/facilities/minor-slots/:slotNumber/clear', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  
  const minorFacilities = readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  slot.facilityName = '';
  slot.facilityDescription = '';
  
  writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// PATCH endpoint to toggle minor slot enabled status
app.patch('/api/facilities/minor-slots/:slotNumber/toggle-enabled', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { enabled } = req.body;
  
  const minorFacilities = readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  // Only last 2 slots (5 and 6) can be toggled
  if (slotNumber < 5) {
    return res.status(400).json({ 
      success: false, 
      message: 'Only slots 5 and 6 can be enabled/disabled' 
    });
  }
  
  slot.enabled = Boolean(enabled);
  
  // If disabling, clear the slot
  if (!slot.enabled) {
    slot.facilityName = '';
    slot.facilityDescription = '';
  }
  
  writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// CLIENT Facility Purchase Endpoints

// POST endpoint to purchase a Core/Major facility
app.post('/api/facilities/core-major/:index/purchase', requireClientAuth, async (req, res) => {
  const facilityIndex = parseInt(req.params.index);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('facility-purchase');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const facilities = readCoreMajorFacilities();
    
    if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility index' 
      });
    }
    
    const facility = facilities[facilityIndex];
    
    // Validate facility can be purchased
    if (facility.isPurchased) {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility is already purchased' 
      });
    }
    
    if (facility.facilityPrice === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Core facilities cannot be purchased (they are already owned)' 
      });
    }
    
    // Load data
    const pilots = readPilots();
    const manna = readManna();
    const settings = readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = facility.facilityPrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
    // Verify all pilots have sufficient balance
    const insufficientPilots = [];
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        const balance = helpers.calculatePilotBalance(pilot, manna.transactions);
        if (balance < costPerPilot) {
          insufficientPilots.push(pilot.name);
        }
      }
    });
    
    if (insufficientPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds for: ${insufficientPilots.join(', ')}` 
      });
    }
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased facility: ${facility.facilityName}`
    };
    
    manna.transactions.push(transaction);
    
    // Add transaction to all expense pilots' personal transactions
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        if (!pilot.personalTransactions) {
          pilot.personalTransactions = [];
        }
        pilot.personalTransactions.push(transaction.id);
      }
    });
    
    // Mark facility as purchased
    facility.isPurchased = true;
    
    // Save all changes
    writeCoreMajorFacilities(facilities);
    writeManna(manna);
    writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-core-major', { action: 'update', facilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, facilities });
  } finally {
    // Always release the lock
    fileMutex.release('facility-purchase');
  }
});

// POST endpoint to purchase a facility upgrade
app.post('/api/facilities/core-major/:facilityIndex/upgrades/:upgradeIndex/purchase', requireClientAuth, async (req, res) => {
  const facilityIndex = parseInt(req.params.facilityIndex);
  const upgradeIndex = parseInt(req.params.upgradeIndex);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('facility-upgrade-purchase');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const facilities = readCoreMajorFacilities();
    
    if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility index' 
      });
    }
    
    const facility = facilities[facilityIndex];
    
    // Validate facility is purchased
    if (!facility.isPurchased) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot purchase upgrades for an unpurchased facility' 
      });
    }
    
    if (!Array.isArray(facility.upgrades) || facility.upgrades.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Facility has no upgrades configured'
      });
    }
    
    if (Number.isNaN(upgradeIndex) || upgradeIndex < 0 || upgradeIndex >= facility.upgrades.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid upgrade index' 
      });
    }
    
    const upgrade = facility.upgrades[upgradeIndex];
    
    // Validate upgrade can be purchased
    if (upgrade.upgradeCount >= upgrade.maxPurchases) {
      return res.status(400).json({ 
        success: false, 
        message: 'Upgrade is already at maximum purchases' 
      });
    }
    
    // Load data
    const pilots = readPilots();
    const manna = readManna();
    const settings = readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = upgrade.upgradePrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
    // Verify all pilots have sufficient balance
    const insufficientPilots = [];
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        const balance = helpers.calculatePilotBalance(pilot, manna.transactions);
        if (balance < costPerPilot) {
          insufficientPilots.push(pilot.name);
        }
      }
    });
    
    if (insufficientPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds for: ${insufficientPilots.join(', ')}` 
      });
    }
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased upgrade: ${upgrade.upgradeName} for ${facility.facilityName}`
    };
    
    manna.transactions.push(transaction);
    
    // Add transaction to all expense pilots' personal transactions
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        if (!pilot.personalTransactions) {
          pilot.personalTransactions = [];
        }
        pilot.personalTransactions.push(transaction.id);
      }
    });
    
    // Increment upgrade count
    upgrade.upgradeCount += 1;
    
    // Save all changes
    writeCoreMajorFacilities(facilities);
    writeManna(manna);
    writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-core-major', { action: 'update', facilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, facilities });
  } finally {
    // Always release the lock
    fileMutex.release('facility-upgrade-purchase');
  }
});

// POST endpoint to enable (purchase) a minor facility slot
app.post('/api/facilities/minor-slots/:slotNumber/enable', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('minor-slot-enable');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const minorFacilities = readMinorFacilitiesSlots();
    
    if (Number.isNaN(slotNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
    if (slotIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slot = minorFacilities.slots[slotIndex];
    
    // Only last 2 slots (5 and 6) can be purchased/enabled
    if (slotNumber < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only slots 5 and 6 can be unlocked' 
      });
    }
    
    if (slot.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slot is already enabled' 
      });
    }
    
    // Load data
    const pilots = readPilots();
    const manna = readManna();
    const settings = readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Fixed base price for slot unlock, apply modifier
    const basePrice = 5000;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
    // Verify all pilots have sufficient balance
    const insufficientPilots = [];
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        const balance = helpers.calculatePilotBalance(pilot, manna.transactions);
        if (balance < costPerPilot) {
          insufficientPilots.push(pilot.name);
        }
      }
    });
    
    if (insufficientPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds for: ${insufficientPilots.join(', ')}` 
      });
    }
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Unlocked minor facility slot ${slotNumber}`
    };
    
    manna.transactions.push(transaction);
    
    // Add transaction to all expense pilots' personal transactions
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        if (!pilot.personalTransactions) {
          pilot.personalTransactions = [];
        }
        pilot.personalTransactions.push(transaction.id);
      }
    });
    
    // Enable the slot
    slot.enabled = true;
    
    // Save all changes
    writeMinorFacilitiesSlots(minorFacilities);
    writeManna(manna);
    writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, minorFacilities });
  } finally {
    // Always release the lock
    fileMutex.release('minor-slot-enable');
  }
});

// POST endpoint to assign (purchase) a minor facility to a slot
app.post('/api/facilities/minor-slots/:slotNumber/assign', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { facilityName, facilityDescription, expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('minor-slot-assign');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const minorFacilities = readMinorFacilitiesSlots();
    
    if (Number.isNaN(slotNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
    if (slotIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slot = minorFacilities.slots[slotIndex];
    
    if (!slot.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot assign facility to disabled slot' 
      });
    }
    
    if (slot.facilityName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slot already has a facility assigned. Demolish it first.' 
      });
    }
    
    // Validate facilityName input
    if (typeof facilityName !== 'string' || facilityName.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility name is required and must be a non-empty string' 
      });
    }
    
    // Validate facilityDescription input
    if (facilityDescription !== undefined && typeof facilityDescription !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility description must be a string' 
      });
    }
    
    // Check uniqueness - facility name must not be used in other slots
    const isNameUsed = minorFacilities.slots.some(s => 
      s.slotNumber !== slotNumber && s.facilityName === facilityName
    );
    
    if (isNameUsed) {
      return res.status(400).json({ 
        success: false, 
        message: 'This facility is already assigned to another slot' 
      });
    }
    
    // Find the facility in default options to get price
    const facilityOption = DEFAULT_MINOR_FACILITIES.find(f => f.minorFacilityName === facilityName);
    if (!facilityOption) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility name: not found in available options' 
      });
    }
    
    // Load data
    const pilots = readPilots();
    const manna = readManna();
    const settings = readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = facilityOption.minorFacilityPrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
    // Verify all pilots have sufficient balance
    const insufficientPilots = [];
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        const balance = helpers.calculatePilotBalance(pilot, manna.transactions);
        if (balance < costPerPilot) {
          insufficientPilots.push(pilot.name);
        }
      }
    });
    
    if (insufficientPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds for: ${insufficientPilots.join(', ')}` 
      });
    }
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased minor facility: ${facilityName}`
    };
    
    manna.transactions.push(transaction);
    
    // Add transaction to all expense pilots' personal transactions
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        if (!pilot.personalTransactions) {
          pilot.personalTransactions = [];
        }
        pilot.personalTransactions.push(transaction.id);
      }
    });
    
    // Assign facility to slot
    slot.facilityName = facilityName.trim();
    slot.facilityDescription = (facilityDescription || '').trim();
    
    // Save all changes
    writeMinorFacilitiesSlots(minorFacilities);
    writeManna(manna);
    writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, minorFacilities });
  } finally {
    // Always release the lock
    fileMutex.release('minor-slot-assign');
  }
});

// DELETE endpoint to demolish (clear) minor facility slot
app.delete('/api/facilities/minor-slots/:slotNumber/demolish', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  
  const minorFacilities = readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  if (!slot.facilityName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Slot is already empty' 
    });
  }
  
  // Clear the slot (free operation, no transaction)
  slot.facilityName = '';
  slot.facilityDescription = '';
  
  writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// Factions API endpoints
app.get('/api/factions', requireAnyAuth, (req, res) => {
  const factions = readFactions();
  const jobs = readJobs();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = enrichAllFactions(factions, jobs);
  
  res.json(enrichedFactions);
});

app.post('/api/factions', requireAdminAuth, (req, res) => {
  // Validate faction data
  const validation = validateFactionData(req.body, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const factions = readFactions();
  const jobs = readJobs();
  const newFaction = {
    id: helpers.generateId(),
    title: validation.title,
    emblem: validation.emblem,
    brief: validation.brief,
    standing: validation.standing,
    jobsCompletedOffset: validation.jobsCompletedOffset,
    jobsFailedOffset: validation.jobsFailedOffset
  };
  factions.push(newFaction);
  writeFactions(factions);
  
  // Enrich the new faction with calculated counts for the response
  const enrichedFaction = helpers.enrichFactionWithJobCounts(newFaction, jobs);
  
  // Broadcast SSE update with all enriched factions
  const enrichedFactions = enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'create', faction: enrichedFaction, factions: enrichedFactions });
  
  res.json({ success: true, faction: enrichedFaction });
});

app.put('/api/factions/:id', requireAdminAuth, (req, res) => {
  const factions = readFactions();
  const index = factions.findIndex(f => f.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Faction not found' });
  }
  
  // Validate faction data
  const validation = validateFactionData(req.body, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const jobs = readJobs();
  factions[index] = {
    id: req.params.id,
    title: validation.title,
    emblem: validation.emblem,
    brief: validation.brief,
    standing: validation.standing,
    jobsCompletedOffset: validation.jobsCompletedOffset,
    jobsFailedOffset: validation.jobsFailedOffset
  };
  writeFactions(factions);
  
  // Enrich the updated faction with calculated counts for the response
  const enrichedFaction = helpers.enrichFactionWithJobCounts(factions[index], jobs);
  
  // Broadcast SSE update with all enriched factions
  const enrichedFactions = enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'update', faction: enrichedFaction, factions: enrichedFactions });
  
  res.json({ success: true, faction: enrichedFaction });
});

app.delete('/api/factions/:id', requireAdminAuth, (req, res) => {
  let factions = readFactions();
  const jobs = readJobs();
  factions = factions.filter(f => f.id !== req.params.id);
  writeFactions(factions);
  
  // Broadcast SSE update with enriched factions
  const enrichedFactions = enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'delete', factionId: req.params.id, factions: enrichedFactions });
  
  res.json({ success: true });
});

// Pilots API endpoints
app.get('/api/pilots', requireAnyAuth, (req, res) => {
  const pilots = readPilots();
  const manna = readManna();
  // Enrich pilots with balance information for consistency with SSE broadcasts
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  res.json(enrichedPilots);
});

app.post('/api/pilots', requireAdminAuth, (req, res) => {
  // Read manna data for transaction validation and reserves for reserve validation
  const manna = readManna();
  const reserves = readReserves();
  
  // Validate pilot data
  const validation = validatePilotData(req.body, manna, reserves);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const pilots = readPilots();
  const newPilot = {
    id: helpers.generateId(),
    name: validation.name,
    callsign: validation.callsign,
    ll: validation.ll,
    notes: validation.notes,
    active: validation.active,
    relatedJobs: [],
    personalOperationProgress: validation.personalOperationProgress,
    personalTransactions: validation.personalTransactions,
    reserves: validation.reserves
  };
  pilots.push(newPilot);
  writePilots(pilots);
  
  // Enrich pilots with balance data for SSE broadcast (manna already declared above)
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  const enrichedNewPilot = enrichedPilots.find(p => p.id === newPilot.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'create', pilot: enrichedNewPilot, pilots: enrichedPilots });
  
  res.json({ success: true, pilot: enrichedNewPilot });
});

app.put('/api/pilots/:id', requireAdminAuth, (req, res) => {
  const pilots = readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Read manna data for transaction validation and reserves for reserve validation
  const manna = readManna();
  const reserves = readReserves();
  
  // Validate pilot data
  const validation = validatePilotData(req.body, manna, reserves);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  pilots[index] = {
    id: req.params.id,
    name: validation.name,
    callsign: validation.callsign,
    ll: validation.ll,
    notes: validation.notes,
    active: validation.active,
    relatedJobs: validation.relatedJobs,
    personalOperationProgress: validation.personalOperationProgress,
    personalTransactions: validation.personalTransactions,
    reserves: validation.reserves
  };
  writePilots(pilots);
  
  // Enrich pilots with balance data for SSE broadcast (manna already declared above)
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  const enrichedPilot = enrichedPilots.find(p => p.id === req.params.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichedPilots });
  
  res.json({ success: true, pilot: enrichedPilot });
});

app.delete('/api/pilots/:id', requireAdminAuth, (req, res) => {
  let pilots = readPilots();
  pilots = pilots.filter(p => p.id !== req.params.id);
  writePilots(pilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'delete', pilotId: req.params.id, pilots });
  
  res.json({ success: true });
});

// Update pilot notes only (CLIENT-side endpoint)
app.put('/api/pilots/:id/reserves', requireAnyAuth, (req, res) => {
  const pilots = readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Update only notes field (keeping endpoint name for backwards compatibility)
  pilots[index].notes = (req.body.reserves || req.body.notes || '').trim();
  writePilots(pilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: pilots[index], pilots });
  
  res.json({ success: true, pilot: pilots[index] });
});

// Toggle pilot active/inactive state (CLIENT-side endpoint)
app.put('/api/pilots/:id/toggle-active', requireClientAuth, (req, res) => {
  const pilots = readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Toggle active state
  pilots[index].active = !pilots[index].active;
  writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = readManna();
  const enrichedPilot = enrichPilotsWithBalance([pilots[index]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Update pilot reserves management (ADMIN-side endpoint)
app.put('/api/pilots/:id/reserves-management', requireAdminAuth, (req, res) => {
  const pilots = readPilots();
  const reserves = readReserves();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Validate reserves array
  if (!req.body.reserves) {
    return res.status(400).json({ success: false, message: 'Reserves array is required' });
  }
  
  if (!Array.isArray(req.body.reserves)) {
    return res.status(400).json({ success: false, message: 'Reserves must be an array' });
  }
  
  // Validate reserve objects
  const validation = helpers.validatePilotReserves(req.body.reserves, reserves);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  // Update pilot reserves
  pilots[index].reserves = validation.value;
  writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = readManna();
  const enrichedPilot = enrichPilotsWithBalance([pilots[index]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Cycle reserve deployment status (CLIENT-side endpoint)
app.put('/api/pilots/:pilotId/reserves/:reserveId/cycle', requireClientAuth, (req, res) => {
  const pilots = readPilots();
  const pilotIndex = pilots.findIndex(p => p.id === req.params.pilotId);
  
  if (pilotIndex === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  const pilot = pilots[pilotIndex];
  const reserveIndex = (pilot.reserves || []).findIndex(r => r.reserveId === req.params.reserveId);
  
  if (reserveIndex === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found for this pilot' });
  }
  
  // Validate new deployment status
  const newStatus = req.body.deploymentStatus;
  const statusValidation = helpers.validateDeploymentStatus(newStatus);
  if (!statusValidation.valid) {
    return res.status(400).json({ success: false, message: statusValidation.message });
  }
  
  // Update deployment status
  pilots[pilotIndex].reserves[reserveIndex].deploymentStatus = statusValidation.value;
  writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = readManna();
  const enrichedPilot = enrichPilotsWithBalance([pilots[pilotIndex]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Transfer reserve to another pilot (CLIENT-side endpoint)
app.post('/api/pilots/:pilotId/reserves/:reserveId/transfer', requireClientAuth, (req, res) => {
  const pilots = readPilots();
  const sourcePilotIndex = pilots.findIndex(p => p.id === req.params.pilotId);
  
  if (sourcePilotIndex === -1) {
    return res.status(404).json({ success: false, message: 'Source pilot not found' });
  }
  
  const targetPilotId = req.body.targetPilotId;
  if (!targetPilotId) {
    return res.status(400).json({ success: false, message: 'Target pilot ID is required' });
  }
  
  const targetPilotIndex = pilots.findIndex(p => p.id === targetPilotId);
  if (targetPilotIndex === -1) {
    return res.status(404).json({ success: false, message: 'Target pilot not found' });
  }
  
  // Cannot transfer to self
  if (sourcePilotIndex === targetPilotIndex) {
    return res.status(400).json({ success: false, message: 'Cannot transfer reserve to the same pilot' });
  }
  
  const sourcePilot = pilots[sourcePilotIndex];
  const targetPilot = pilots[targetPilotIndex];
  
  // Find reserve in source pilot
  const reserveIndex = (sourcePilot.reserves || []).findIndex(r => r.reserveId === req.params.reserveId);
  
  if (reserveIndex === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found for source pilot' });
  }
  
  // Remove from source pilot
  const reserveToTransfer = sourcePilot.reserves.splice(reserveIndex, 1)[0];
  
  // Add to target pilot (ensure reserves array exists)
  if (!targetPilot.reserves) {
    targetPilot.reserves = [];
  }
  targetPilot.reserves.push(reserveToTransfer);
  
  // Save changes
  writePilots(pilots);
  
  // Enrich pilots with balance for SSE broadcast
  const manna = readManna();
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  
  res.json({ success: true });
});

// Remove reserve from pilot (CLIENT-side endpoint)
app.delete('/api/pilots/:pilotId/reserves/:reserveId', requireClientAuth, (req, res) => {
  const pilots = readPilots();
  const pilotIndex = pilots.findIndex(p => p.id === req.params.pilotId);
  
  if (pilotIndex === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  const pilot = pilots[pilotIndex];
  const reserveIndex = (pilot.reserves || []).findIndex(r => r.reserveId === req.params.reserveId);
  
  if (reserveIndex === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found for this pilot' });
  }
  
  // Remove reserve
  pilot.reserves.splice(reserveIndex, 1);
  
  // Save changes
  writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = readManna();
  const enrichedPilot = enrichPilotsWithBalance([pilots[pilotIndex]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true });
});

// Get pilot balance and transaction history
app.get('/api/pilots/:id/balance', requireAnyAuth, (req, res) => {
  const pilots = readPilots();
  const manna = readManna();
  const pilot = pilots.find(p => p.id === req.params.id);
  
  if (!pilot) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Get pilot's transactions
  const personalTransactionIds = pilot.personalTransactions || [];
  const pilotTransactions = manna.transactions
    .filter(t => personalTransactionIds.includes(t.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort oldest to newest for balance calculation
  
  // Calculate running balance for pilot (oldest to newest)
  let runningBalance = 0;
  const transactionsWithBalance = pilotTransactions.map(t => {
    runningBalance += t.amount;
    return {
      ...t,
      pilotBalance: runningBalance
    };
  });
  
  // Sort newest to top for display
  transactionsWithBalance.reverse();
  
  res.json({ 
    success: true, 
    balance: runningBalance,
    transactions: transactionsWithBalance
  });
});

// Update pilot's personal transactions
app.put('/api/pilots/:id/personal-transactions', requireAdminAuth, (req, res) => {
  const pilots = readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Validate personalTransactions array
  let personalTransactions = [];
  if (req.body.personalTransactions) {
    try {
      personalTransactions = Array.isArray(req.body.personalTransactions) 
        ? req.body.personalTransactions 
        : JSON.parse(req.body.personalTransactions);
      if (!Array.isArray(personalTransactions)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Personal transactions must be an array' 
        });
      }
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid personal transactions format' 
      });
    }
  }
  
  // Update pilot's personalTransactions
  pilots[index].personalTransactions = personalTransactions;
  writePilots(pilots);
  
  // Read manna data for balance enrichment
  const manna = readManna();
  
  // Enrich pilots with balance data for SSE broadcast
  const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
  const enrichedPilot = enrichedPilots.find(p => p.id === req.params.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichedPilots });
  
  // Return enriched pilot with balance in response
  res.json({ success: true, pilot: enrichedPilot });
});

// Shop purchase endpoint
app.post('/api/shop/purchase', requireClientAuth, async (req, res) => {
  // Acquire lock to prevent race conditions
  await fileMutex.acquire('shop-purchase');
  
  try {
    const { itemId, itemType, expensePilots, assignee } = req.body;
  
    // Validate inputs
    if (!itemId || !itemType || !Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: missing required fields' 
      });
    }
    
    // Validate item type
    if (itemType !== 'reserve' && itemType !== 'resupply') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid item type' 
      });
    }
    
    // Assignee is now required for both reserve and resupply items
    if (!assignee) {
      return res.status(400).json({ 
        success: false, 
        message: 'Assignee is required for all purchases' 
      });
    }
    
    // Load data
    const reserves = readReserves();
    const storeConfig = readStoreConfig();
    const pilots = readPilots();
    const manna = readManna();
    
    // Get item details
    let item;
    let itemName;
    
    if (itemType === 'resupply') {
      item = storeConfig.resupplyItems.find(i => i.id === itemId);
      if (!item || !item.enabled) {
        return res.status(404).json({ 
          success: false, 
          message: 'Resupply item not found or not available' 
        });
      }
      itemName = item.name;
    } else {
      // Validate reserve is in stock
      if (!storeConfig.currentStock.includes(itemId)) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reserve not in stock' 
        });
      }
      
      item = reserves.find(r => r.id === itemId);
      if (!item) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reserve not found' 
        });
      }
      itemName = item.name;
    }
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Validate assignee exists (assignee may be any pilot, not limited to expensePilots)
    const assigneePilot = pilots.find(p => p.id === assignee);
    if (!assigneePilot) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid assignee pilot ID' 
      });
    }
    
    // Validate item price is a positive, finite number
    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item price: must be a positive number'
      });
    }
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(price / expensePilots.length);
    
    // Verify all pilots have sufficient balance
    const insufficientPilots = [];
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        const balance = helpers.calculatePilotBalance(pilot, manna.transactions);
        if (balance < costPerPilot) {
          insufficientPilots.push(pilot.name);
        }
      }
    });
    
    if (insufficientPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient funds for: ${insufficientPilots.join(', ')}` 
      });
    }
    
    // Create one transaction instead of multiple
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased ${itemName} for ${assigneePilot.name}`
    };
    
    manna.transactions.push(transaction);
    
    // Add transaction to all expense pilots' personal transactions
    expensePilots.forEach(pilotId => {
      const pilot = pilots.find(p => p.id === pilotId);
      if (pilot) {
        if (!pilot.personalTransactions) {
          pilot.personalTransactions = [];
        }
        pilot.personalTransactions.push(transaction.id);
      }
    });
    
    // For reserve items, assign to assignee with default "In Reserve" status and remove from stock
    if (itemType === 'reserve') {
      if (!assigneePilot.reserves) {
        assigneePilot.reserves = [];
      }
      // Add reserve as object with default "In Reserve" deployment status
      assigneePilot.reserves.push({
        reserveId: itemId,
        deploymentStatus: 'In Reserve'
      });
      
      // Remove from stock (first occurrence)
      const stockIndex = storeConfig.currentStock.indexOf(itemId);
      if (stockIndex !== -1) {
        storeConfig.currentStock.splice(stockIndex, 1);
      }
    }
    
    // Save changes
    writeManna(manna);
    writePilots(pilots);
    writeStoreConfig(storeConfig);
    
    // Calculate balances for SSE broadcast
    const balances = calculateBalancesFromPilots();
    
    // Enrich pilots with balance data
    const enrichedPilots = enrichPilotsWithBalance(pilots, manna);
    
    // Broadcast SSE updates
    broadcastSSE('manna', { action: 'transaction', manna, balances });
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    // Always broadcast store-config when a purchase modifies storeConfig
    broadcastSSE('store-config', { action: 'update', storeConfig });
    if (itemType === 'reserve') {
      // Also broadcast reserves-specific update so all reserves listeners stay in sync
      broadcastSSE('reserves', { action: 'update', pilots: enrichedPilots, storeConfig });
    }
    
    res.json({ 
      success: true, 
      message: 'Purchase completed successfully',
      transactionId: transaction.id
    });
  } finally {
    // Always release the lock
    fileMutex.release('shop-purchase');
  }
});

// Progress all jobs endpoint
app.post('/api/jobs/progress-all', requireAdminAuth, async (req, res) => {
  const jobs = readJobs();
  const pilots = readPilots();
  
  // Update job states and track newly active jobs in a single pass
  const newlyActiveJobIds = [];
  let jobsModified = 0;
  let hasActiveToIgnored = false;
  
  const updatedJobs = jobs.map(job => {
    if (job.state === 'Active') {
      jobsModified++;
      hasActiveToIgnored = true;
      return { ...job, state: 'Ignored' };
    } else if (job.state === 'Pending') {
      jobsModified++;
      newlyActiveJobIds.push(job.id);
      return { ...job, state: 'Active' };
    }
    return job;
  });
  
  // Auto-archive ongoing voting period if any Active jobs changed to Ignored
  if (hasActiveToIgnored) {
    await archiveOngoingVotingPeriod('Job progression (Active → Ignored)');
  }
  
  // Add newly active jobs to all active pilots' related jobs
  const updatedPilots = pilots.map(pilot => {
    if (pilot.active && newlyActiveJobIds.length > 0) {
      const existingJobIds = new Set(pilot.relatedJobs || []);
      newlyActiveJobIds.forEach(jobId => existingJobIds.add(jobId));
      return { ...pilot, relatedJobs: Array.from(existingJobIds) };
    }
    return pilot;
  });
  
  // Write updated data
  writeJobs(updatedJobs);
  writePilots(updatedPilots);
  
  // Broadcast SSE updates
  broadcastSSE('jobs', { action: 'progress-all', jobs: updatedJobs });
  broadcastSSE('pilots', { action: 'update-multiple', pilots: updatedPilots });
  
  res.json({ 
    success: true, 
    jobsProgressed: jobsModified,
    pilotsUpdated: updatedPilots.filter(p => p.active).length,
    newlyActiveJobs: newlyActiveJobIds.length
  });
});

// Progress operation for active pilots endpoint
app.post('/api/pilots/progress-operation', requireAdminAuth, (req, res) => {
  const pilots = readPilots();
  
  // Track pilots that were reset to 0
  const resetPilots = [];
  let pilotsProgressed = 0;
  
  // Update personalOperationProgress for all active pilots
  const updatedPilots = pilots.map(pilot => {
    if (pilot.active) {
      pilotsProgressed++;
      const currentProgress = pilot.personalOperationProgress ?? 0;
      const newProgress = currentProgress >= 3 ? 0 : currentProgress + 1;
      
      if (newProgress === 0 && currentProgress === 3) {
        resetPilots.push({
          name: pilot.name,
          callsign: pilot.callsign
        });
      }
      
      return { ...pilot, personalOperationProgress: newProgress };
    }
    return pilot;
  });
  
  // Write updated data
  writePilots(updatedPilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'progress-operation', pilots: updatedPilots });
  
  res.json({
    success: true,
    pilotsProgressed,
    resetPilots
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Navigate to localhost:${PORT} in your browser to access the application UI.`);
});
