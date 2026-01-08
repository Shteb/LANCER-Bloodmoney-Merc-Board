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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (no session needed)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/emblems', express.static(path.join(BASE_PATH, 'logo_art')));

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

const BASE_MODULES = {
  CORE_COUNT: 3,
  MAJOR_COUNT: 6,
  MINOR_COUNT: 6,
  TOTAL_COUNT: 15
};

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
const BASE_FILE = path.join(DATA_DIR, 'base.json');
const FACTIONS_FILE = path.join(DATA_DIR, 'factions.json');
const PILOTS_FILE = path.join(DATA_DIR, 'pilots.json');

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
        emblem: 'birds.svg',
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
        emblem: 'sun.svg',
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
        emblem: 'triangle.svg',
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
        emblem: 'cosmetics.svg',
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
        emblem: 'rings.svg',
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
        emblem: 'engineering.svg',
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
 * @returns {Object} Validation result with sanitized pilot fields when valid, or an error message when invalid
 */
function validatePilotData(pilotData, manna) {
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
  
  return {
    valid: true,
    name: nameValidation.value,
    callsign: callsignValidation.value,
    ll: llValidation.value,
    reserves: (pilotData.reserves || '').trim(),
    active: pilotData.active === 'true' || pilotData.active === true,
    relatedJobs: relatedJobs,
    personalOperationProgress: progressValidation.value,
    personalTransactions: personalTransactions
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
  adminPassword: 'TARASQUE'
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

// Initialize Base modules
function initializeBase() {
  if (!fs.existsSync(BASE_FILE)) {
    const defaultBase = {
      modules: [
        // 3 Core modules - at least one partially filled
        { type: 'Core', title: 'Lorem Ipsum', description: 'Dolor sit amet consectetur adipiscing elit', disabled: false },
        { type: 'Core', title: '', description: '', disabled: false },
        { type: 'Core', title: '', description: '', disabled: false },
        // 6 Major modules - at least one partially filled
        { type: 'Major', title: 'Sed Do Eiusmod', description: 'Tempor incididunt ut labore et dolore magna', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        { type: 'Major', title: '', description: '', disabled: false },
        // 6 Minor modules (last 2 disabled by default) - at least one partially filled
        { type: 'Minor', title: 'Ut Enim Minim', description: 'Quis nostrud exercitation ullamco laboris', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: false },
        { type: 'Minor', title: '', description: '', disabled: true },
        { type: 'Minor', title: '', description: '', disabled: true }
      ]
    };
    fs.writeFileSync(BASE_FILE, JSON.stringify(defaultBase, null, 2));
  }
}

// Read Base data
function readBase() {
  try {
    const data = fs.readFileSync(BASE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    initializeBase();
    return readBase();
  }
}

// Write Base data
function writeBase(base) {
  fs.writeFileSync(BASE_FILE, JSON.stringify(base, null, 2));
}

// Initialize Factions
function initializeFactions() {
  if (!fs.existsSync(FACTIONS_FILE)) {
    const defaultFactions = [
      {
        id: helpers.generateId(),
        title: 'Conglomerate Finibus',
        emblem: 'construction.svg',
        brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        standing: 2,
        jobsCompletedOffset: 3,
        jobsFailedOffset: 1
      },
      {
        id: helpers.generateId(),
        title: 'Shimano Industries',
        emblem: 'cosmetics.svg',
        brief: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        standing: 3,
        jobsCompletedOffset: 5,
        jobsFailedOffset: 0
      },
      {
        id: helpers.generateId(),
        title: 'Collective Malorum',
        emblem: 'engineering.svg',
        brief: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
        standing: 1,
        jobsCompletedOffset: 1,
        jobsFailedOffset: 2
      },
      {
        id: helpers.generateId(),
        title: 'Phoenix Syndicate',
        emblem: 'birds.svg',
        brief: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        standing: 4,
        jobsCompletedOffset: 8,
        jobsFailedOffset: 0
      },
      {
        id: helpers.generateId(),
        title: 'Void Runners',
        emblem: 'rings.svg',
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
        reserves: 'Lorem ipsum dolor sit amet\nConsectetur adipiscing elit',
        active: true,
        relatedJobs: activeJobIds.slice(0, 3), // First 3 non-Pending jobs
        personalOperationProgress: 2,
        personalTransactions: [transactionIds[0], transactionIds[2], transactionIds[4]] // Transactions 0, 2, 4
      },
      {
        id: helpers.generateId(),
        name: 'Sit Amet',
        callsign: 'Consectetur',
        ll: 5,
        reserves: 'Sed do eiusmod tempor\nIncididunt ut labore',
        active: true,
        relatedJobs: activeJobIds.slice(1, 4), // Jobs 1-3 (non-Pending)
        personalOperationProgress: 0,
        personalTransactions: [transactionIds[0], transactionIds[1], transactionIds[3], transactionIds[5]] // Multiple transactions
      },
      {
        id: helpers.generateId(),
        name: 'Magna Aliqua',
        callsign: 'Tempor',
        ll: 2,
        reserves: 'Ut enim ad minim veniam\nQuis nostrud exercitation',
        active: false,
        relatedJobs: activeJobIds.slice(0, 2), // First 2 non-Pending jobs
        personalOperationProgress: 0,
        personalTransactions: [transactionIds[2], transactionIds[3]] // Some transactions
      },
      {
        id: helpers.generateId(),
        name: 'Veniam Quis',
        callsign: 'Nostrud',
        ll: 7,
        reserves: 'Duis aute irure dolor\nReprehenderit in voluptate',
        active: true,
        relatedJobs: activeJobIds.slice(2, 5), // Jobs 2-4 (non-Pending)
        personalOperationProgress: 1,
        personalTransactions: [transactionIds[1], transactionIds[4]] // Some transactions
      },
      {
        id: helpers.generateId(),
        name: 'Ullamco Laboris',
        callsign: 'Nisi',
        ll: 4,
        reserves: 'Excepteur sint occaecat\nCupidatat non proident',
        active: true,
        relatedJobs: activeJobIds.slice(0, 2), // First 2 non-Pending jobs
        personalOperationProgress: 3,
        personalTransactions: [transactionIds[2], transactionIds[5]] // Some transactions
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

// Migrate old pilots to add personalOperationProgress and personalTransactions fields (one-time operation)
function migratePilotsIfNeeded() {
  const pilots = readPilots();
  let needsMigration = false;
  
  const migratedPilots = pilots.map(pilot => {
    const progressMissing = !pilot.hasOwnProperty('personalOperationProgress');
    const transactionsMissing = !pilot.hasOwnProperty('personalTransactions');
    
    if (progressMissing || transactionsMissing) {
      needsMigration = true;
      return {
        ...pilot,
        personalOperationProgress: pilot.personalOperationProgress ?? 0,
        personalTransactions: pilot.personalTransactions ?? []
      };
    }
    return pilot;
  });
  
  if (needsMigration) {
    writePilots(migratedPilots);
    console.log('Pilots migrated to include personalOperationProgress and personalTransactions fields');
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
// Order matters: factions before jobs, jobs and manna before pilots
initializeSettings();
initializeFactions();
initializeBase();
initializeManna();
initializeData();
initializePilots();

// Migrate existing jobs to add new fields
migrateJobsIfNeeded();

// Migrate existing factions to add offset fields
migrateFactionsIfNeeded();

// Migrate existing transactions to add UUIDs
migrateTransactionsIfNeeded();

// Migrate existing pilots to add personalOperationProgress and personalTransactions fields
migratePilotsIfNeeded();

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
  const base = readBase();
  res.render('client-base', { settings, colorScheme: settings.colorScheme, base });
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

app.get('/admin', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const settings = readSettings();
  const manna = readManna();
  const base = readBase();
  const factions = readFactions();
  const pilots = readPilots();
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
  
  // Enrich jobs with faction data and state class
  const enrichedJobs = jobs.map(job => ({
    ...job,
    stateClass: job.state ? job.state.toLowerCase() : helpers.DEFAULT_JOB_STATE.toLowerCase(),
    faction: factionMap[job.factionId] || null
  }));
  
  res.render('admin', { 
    jobs: enrichedJobs, 
    settings, 
    manna, 
    balances,
    base, 
    factions: enrichedFactions, 
    pilots: enrichedPilots,
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

app.put('/api/jobs/:id', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const factions = readFactions();
  
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Validate job data
  const validation = validateJobData(req.body, factions, uploadDir);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  jobs[index] = {
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
  writeJobs(jobs);
  
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
app.put('/api/jobs/:id/state', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const index = jobs.findIndex(j => j.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Validate job state
  const stateValidation = helpers.validateJobState(req.body.state);
  if (!stateValidation.valid) {
    return res.status(400).json({ success: false, message: stateValidation.message });
  }
  
  // Update only the state field
  jobs[index].state = stateValidation.value;
  writeJobs(jobs);
  
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
  
  const settings = {
    portalHeading: headingValidation.value,
    unt: unt.trim(),
    currentGalacticPos: (req.body.currentGalacticPos ?? '').trim(),
    colorScheme: colorScheme,
    userGroup: userGroupValidation.value,
    operationProgress: operationProgress,
    openTable: openTable,
    clientPassword: clientPasswordValidation.value,
    adminPassword: adminPasswordValidation.value
  };
  
  writeSettings(settings);
  
  // Broadcast SSE update
  broadcastSSE('settings', { action: 'update', settings });
  
  res.json({ success: true, settings });
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

// Base API endpoints
app.get('/api/base', requireAnyAuth, (req, res) => {
  const base = readBase();
  res.json(base);
});

app.put('/api/base', requireAdminAuth, (req, res) => {
  const modules = req.body.modules;
  
  if (!Array.isArray(modules) || modules.length !== BASE_MODULES.TOTAL_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Base must have exactly ${BASE_MODULES.TOTAL_COUNT} modules` 
    });
  }
  
  writeBase({ modules });
  
  // Broadcast SSE update
  broadcastSSE('base', { action: 'update', base: { modules } });
  
  res.json({ success: true, base: { modules } });
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
  // Read manna data for transaction validation
  const manna = readManna();
  
  // Validate pilot data
  const validation = validatePilotData(req.body, manna);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const pilots = readPilots();
  const newPilot = {
    id: helpers.generateId(),
    name: validation.name,
    callsign: validation.callsign,
    ll: validation.ll,
    reserves: validation.reserves,
    active: validation.active,
    relatedJobs: [],
    personalOperationProgress: validation.personalOperationProgress,
    personalTransactions: validation.personalTransactions
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
  
  // Read manna data for transaction validation
  const manna = readManna();
  
  // Validate pilot data
  const validation = validatePilotData(req.body, manna);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  pilots[index] = {
    id: req.params.id,
    name: validation.name,
    callsign: validation.callsign,
    ll: validation.ll,
    reserves: validation.reserves,
    active: validation.active,
    relatedJobs: validation.relatedJobs,
    personalOperationProgress: validation.personalOperationProgress,
    personalTransactions: validation.personalTransactions
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

// Update pilot reserves only (CLIENT-side endpoint)
app.put('/api/pilots/:id/reserves', requireAnyAuth, (req, res) => {
  const pilots = readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Update only reserves field
  pilots[index].reserves = (req.body.reserves || '').trim();
  writePilots(pilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: pilots[index], pilots });
  
  res.json({ success: true, pilot: pilots[index] });
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

// Progress all jobs endpoint
app.post('/api/jobs/progress-all', requireAdminAuth, (req, res) => {
  const jobs = readJobs();
  const pilots = readPilots();
  
  // Update job states and track newly active jobs in a single pass
  const newlyActiveJobIds = [];
  let jobsModified = 0;
  
  const updatedJobs = jobs.map(job => {
    if (job.state === 'Active') {
      jobsModified++;
      return { ...job, state: 'Ignored' };
    } else if (job.state === 'Pending') {
      jobsModified++;
      newlyActiveJobIds.push(job.id);
      return { ...job, state: 'Active' };
    }
    return job;
  });
  
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
