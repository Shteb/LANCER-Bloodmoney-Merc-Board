const path = require('path');
const fs = require('fs');
const helpers = require('../helpers');
const fileMutex = require('../lib/fileMutex');
const { broadcastSSE } = require('../lib/sseManager');

// Configuration - set during init()
let DATA_DIR, LOGO_ART_DIR;
let DATA_FILE, SETTINGS_FILE, MANNA_FILE, CORE_MAJOR_FACILITIES_FILE;
let MINOR_FACILITIES_SLOTS_FILE, FACTIONS_FILE, PILOTS_FILE;
let RESERVES_FILE, STORE_CONFIG_FILE, VOTING_PERIODS_FILE;
let DEFAULT_RESERVES, DEFAULT_CORE_MAJOR_FACILITIES, DEFAULT_MINOR_FACILITIES;

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

function init(config) {
  const BASE_PATH = config.BASE_PATH;
  DEFAULT_RESERVES = config.DEFAULT_RESERVES;
  DEFAULT_CORE_MAJOR_FACILITIES = config.DEFAULT_CORE_MAJOR_FACILITIES;
  DEFAULT_MINOR_FACILITIES = config.DEFAULT_MINOR_FACILITIES;

  DATA_DIR = path.join(BASE_PATH, 'data');
  LOGO_ART_DIR = path.join(BASE_PATH, 'logo_art');
  DATA_FILE = path.join(DATA_DIR, 'jobs.json');
  SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  MANNA_FILE = path.join(DATA_DIR, 'manna.json');
  CORE_MAJOR_FACILITIES_FILE = path.join(DATA_DIR, 'base_core_major_facilities.json');
  MINOR_FACILITIES_SLOTS_FILE = path.join(DATA_DIR, 'minor_facilities_slots.json');
  FACTIONS_FILE = path.join(DATA_DIR, 'factions.json');
  PILOTS_FILE = path.join(DATA_DIR, 'pilots.json');
  RESERVES_FILE = path.join(DATA_DIR, 'reserves.json');
  STORE_CONFIG_FILE = path.join(DATA_DIR, 'store-config.json');
  VOTING_PERIODS_FILE = path.join(DATA_DIR, 'voting-periods.json');

  // Ensure directories exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGO_ART_DIR)) {
    fs.mkdirSync(LOGO_ART_DIR, { recursive: true });
  }
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

function getDataDir() { return DATA_DIR; }
function getLogoArtDir() { return LOGO_ART_DIR; }
function getDefaultMinorFacilities() { return DEFAULT_MINOR_FACILITIES; }
function getDefaultSettings() { return DEFAULT_SETTINGS; }

function initializeAll() {
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

  // Migrate existing pilots
  migratePilotsIfNeeded();

  // Migrate existing store config
  migrateStoreConfigIfNeeded();
}

module.exports = {
  init,
  initializeSettings,
  initializeData,
  readJobs,
  writeJobs,
  migrateJobsIfNeeded,
  createFactionMap,
  enrichJobsWithFactions,
  enrichAllFactions,
  enrichPilotsWithBalance,
  validateJobData,
  validateFactionData,
  calculateBalancesFromPilots,
  validatePilotData,
  readSettings,
  writeSettings,
  initializeManna,
  readManna,
  writeManna,
  migrateTransactionsIfNeeded,
  initializeCoreMajorFacilities,
  readCoreMajorFacilities,
  writeCoreMajorFacilities,
  initializeMinorFacilitiesSlots,
  readMinorFacilitiesSlots,
  writeMinorFacilitiesSlots,
  migrateBaseToFacilities,
  initializeFactions,
  readFactions,
  writeFactions,
  migrateFactionsIfNeeded,
  initializePilots,
  readPilots,
  writePilots,
  migratePilotsIfNeeded,
  readReserves,
  writeReserves,
  initializeReserves,
  writeStoreConfig,
  readStoreConfig,
  initializeStoreConfig,
  migrateStoreConfigIfNeeded,
  readVotingPeriods,
  writeVotingPeriods,
  initializeVotingPeriods,
  archiveOngoingVotingPeriod,
  getDataDir,
  getLogoArtDir,
  getDefaultMinorFacilities,
  getDefaultSettings,
  initializeAll
};
