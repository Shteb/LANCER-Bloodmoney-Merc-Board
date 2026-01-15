/**
 * Helper functions for the LANCER RPG Job Board application
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/**
 * Constants
 */
const STANDING_LABELS = ['DISTRUSTED', 'WARY', 'NEUTRAL', 'RESPECTED', 'TRUSTED'];
const VALID_COLOR_SCHEMES = ['grey', 'orange', 'green', 'blue'];
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;
const SAFE_EMBLEM_PATTERN = /^[A-Za-z0-9_-]+\.svg$/;
const JOB_STATES = ['Pending', 'Active', 'Complete', 'Failed', 'Ignored'];
const DEFAULT_JOB_STATE = 'Pending';
const VOTING_PERIOD_STATES = ['Ongoing', 'Archived'];
const DEFAULT_VOTING_PERIOD_STATE = 'Ongoing';

/**
 * Get the label for a faction standing level (0-4)
 * @param {number} standing - Standing level (0-4)
 * @returns {string} Standing label
 */
function getStandingLabel(standing) {
  return STANDING_LABELS[standing] || 'UNKNOWN';
}

/**
 * Generate a UUID
 * @returns {string} UUID
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Sanitize emblem base name (remove invalid characters)
 * @param {string} originalName - Original filename
 * @returns {string|null} Sanitized base name or null if invalid
 */
function sanitizeEmblemBaseName(originalName) {
  const normalized = String(originalName || '').replace(/\\/g, '/');
  const base = path.posix.parse(normalized).name;

  const safe = base
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!safe) return null;

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  return reserved.test(safe) ? `_${safe}` : safe;
}

/**
 * Check if emblem filename is safe
 * @param {string} filename - Filename to check
 * @returns {boolean} True if safe
 */
function isSafeEmblemFilename(filename) {
  if (typeof filename !== 'string') return false;
  if (filename !== path.basename(filename)) return false;
  return SAFE_EMBLEM_PATTERN.test(filename);
}

/**
 * Format emblem filename for display (remove .svg and underscores)
 * @param {string} filename - Emblem filename
 * @returns {string} Formatted title
 */
function formatEmblemTitle(filename) {
  return filename.replace('.svg', '').replace(/_/g, ' ');
}

/**
 * Validate date string in DD/MM/YYYY format
 * @param {string} dateStr - Date string to validate
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateDate(dateStr) {
  if (!dateStr) {
    return { valid: true }; // Empty date is allowed
  }

  if (!DATE_PATTERN.test(dateStr)) {
    return { valid: false, message: 'Invalid date format. Use DD/MM/YYYY' };
  }

  const [day, month, year] = dateStr.split('/').map(Number);
  
  if (month < 1 || month > 12 || day < 1) {
    return { 
      valid: false, 
      message: 'Invalid date values. Day must be at least 1, month must be 1-12' 
    };
  }

  // Check days per month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (month === 2 && isLeapYear) {
    daysInMonth[1] = 29;
  }

  if (day > daysInMonth[month - 1]) {
    return { 
      valid: false, 
      message: `Invalid day for month ${month}. Maximum is ${daysInMonth[month - 1]} days.`
    };
  }

  return { valid: true };
}

/**
 * Validate color scheme
 * @param {string} colorScheme - Color scheme to validate
 * @returns {boolean} True if valid
 */
function isValidColorScheme(colorScheme) {
  return VALID_COLOR_SCHEMES.includes(colorScheme);
}

/**
 * Validate emblem file exists and is safe
 * @param {string} emblem - Emblem filename
 * @param {string} uploadDir - Upload directory path
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateEmblem(emblem, uploadDir) {
  if (!emblem || emblem === '') {
    return { valid: true }; // Empty emblem is allowed
  }

  if (!isSafeEmblemFilename(emblem)) {
    return { valid: false, message: 'Invalid emblem filename' };
  }

  if (!fs.existsSync(path.join(uploadDir, emblem))) {
    return { valid: false, message: 'Invalid emblem selection' };
  }

  return { valid: true };
}

/**
 * Trim and validate non-empty string
 * @param {string} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @param {number} maxLength - Maximum length (optional)
 * @returns {Object} { valid: boolean, value: string, message?: string }
 */
function validateRequiredString(value, fieldName, maxLength = null) {
  const trimmed = (typeof value === 'string' ? value : '').trim();
  
  if (trimmed.length === 0) {
    return { valid: false, message: `${fieldName} cannot be empty` };
  }

  if (maxLength && trimmed.length > maxLength) {
    return { 
      valid: false, 
      message: `${fieldName} must be ${maxLength} characters or less` 
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate integer within range
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {Object} { valid: boolean, value: number, message?: string }
 */
function validateInteger(value, fieldName, min = null, max = null) {
  const parsed = parseInt(value);
  
  if (isNaN(parsed)) {
    return { valid: false, message: `${fieldName} must be a valid number` };
  }

  if (min !== null && parsed < min) {
    return { valid: false, message: `${fieldName} must be at least ${min}` };
  }

  if (max !== null && parsed > max) {
    return { valid: false, message: `${fieldName} must be at most ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Validate password (alphanumeric only, allows empty)
 * @param {string} password - Password to validate
 * @param {string} fieldName - Field name for error message
 * @returns {Object} { valid: boolean, value: string, message?: string }
 */
function validatePassword(password, fieldName) {
  // Convert to string and handle null/undefined
  const pwd = (password === null || password === undefined) ? '' : String(password);
  
  // Empty password is allowed (stored as empty string)
  if (pwd === '') {
    return { valid: true, value: '' };
  }
  
  // Check if alphanumeric only
  const alphanumericPattern = /^[A-Za-z0-9]+$/;
  if (!alphanumericPattern.test(pwd)) {
    return { 
      valid: false, 
      message: `${fieldName} must contain only alphanumeric characters (letters and numbers)` 
    };
  }
  
  return { valid: true, value: pwd };
}

/**
 * Validate job state
 * @param {string} state - Job state to validate
 * @returns {Object} { valid: boolean, value?: string, message?: string }
 */
function validateJobState(state) {
  if (!state || state === '') {
    return { valid: true, value: DEFAULT_JOB_STATE };
  }
  
  if (!JOB_STATES.includes(state)) {
    return { 
      valid: false, 
      message: `Invalid job state. Must be one of: ${JOB_STATES.join(', ')}` 
    };
  }
  
  return { valid: true, value: state };
}

/**
 * Validate faction ID exists
 * @param {string} factionId - Faction ID to validate
 * @param {Array} factions - Array of faction objects
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateFactionId(factionId, factions) {
  // Empty factionId is valid (no faction assigned)
  if (!factionId || factionId === '') {
    return { valid: true };
  }
  
  // Check if faction exists
  const factionExists = factions.some(f => f.id === factionId);
  if (!factionExists) {
    return { 
      valid: false, 
      message: 'Invalid faction ID. Faction does not exist.' 
    };
  }
  
  return { valid: true };
}

/**
 * Validate transaction UUIDs exist in manna data
 * @param {Array} transactionIds - Array of transaction UUIDs to validate
 * @param {Object} manna - Manna data object with transactions array
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateTransactionIds(transactionIds, manna) {
  // Empty array is valid
  if (!transactionIds || transactionIds.length === 0) {
    return { valid: true };
  }
  
  // Check if manna data and transactions exist
  if (!manna || !Array.isArray(manna.transactions)) {
    return { valid: true }; // Allow if manna data not available yet
  }
  
  // Get all transaction IDs from manna data
  const existingTransactionIds = new Set(manna.transactions.map(t => t.id));
  
  // Find any invalid transaction IDs
  const invalidIds = transactionIds.filter(id => !existingTransactionIds.has(id));
  
  if (invalidIds.length > 0) {
    return {
      valid: false,
      message: `Invalid transaction UUID(s): ${invalidIds.join(', ')}. Transaction(s) do not exist.`
    };
  }
  
  return { valid: true };
}

/**
 * Validate deployment status value
 * @param {string} status - Deployment status to validate
 * @returns {Object} { valid: boolean, value?: string, message?: string }
 */
function validateDeploymentStatus(status) {
  const validStatuses = ['In Reserve', 'Deployed', 'Expended'];
  
  if (!status || typeof status !== 'string') {
    return { valid: false, message: 'Deployment status is required and must be a string' };
  }
  
  if (!validStatuses.includes(status)) {
    return { 
      valid: false, 
      message: `Invalid deployment status: "${status}". Must be one of: ${validStatuses.join(', ')}` 
    };
  }
  
  return { valid: true, value: status };
}

/**
 * Validate a single reserve object (with reserveId and deploymentStatus)
 * @param {Object} reserveObj - Reserve object to validate
 * @param {Array} reserves - Array of reserve objects from reserves.json
 * @returns {Object} { valid: boolean, value?: Object, message?: string }
 */
function validateReserveObject(reserveObj, reserves) {
  // Check if object has required structure
  if (!reserveObj || typeof reserveObj !== 'object') {
    return { valid: false, message: 'Reserve entry must be an object' };
  }
  
  // Check for required reserveId field
  if (!reserveObj.reserveId || typeof reserveObj.reserveId !== 'string') {
    return { valid: false, message: 'Reserve object must have a reserveId (UUID string)' };
  }
  
  // Validate reserveId exists in reserves data
  if (reserves && Array.isArray(reserves)) {
    const existingReserveIds = new Set(reserves.map(r => r.id));
    if (!existingReserveIds.has(reserveObj.reserveId)) {
      return {
        valid: false,
        message: `Invalid reserve UUID: ${reserveObj.reserveId}. Reserve does not exist.`
      };
    }
  }
  
  // Validate deploymentStatus
  const statusValidation = validateDeploymentStatus(reserveObj.deploymentStatus);
  if (!statusValidation.valid) {
    return statusValidation;
  }
  
  return {
    valid: true,
    value: {
      reserveId: reserveObj.reserveId,
      deploymentStatus: statusValidation.value
    }
  };
}

/**
 * Validate array of pilot reserve objects (handles both legacy UUID arrays and new object arrays)
 * @param {Array} pilotReserves - Array of reserve UUIDs (legacy) or reserve objects (new)
 * @param {Array} reserves - Array of reserve objects from reserves.json
 * @returns {Object} { valid: boolean, value?: Array, message?: string }
 */
function validatePilotReserves(pilotReserves, reserves) {
  // Empty array is valid
  if (!pilotReserves || pilotReserves.length === 0) {
    return { valid: true, value: [] };
  }
  
  // Must be an array
  if (!Array.isArray(pilotReserves)) {
    return { valid: false, message: 'Pilot reserves must be an array' };
  }
  
  // Check if reserves data exists
  if (!reserves || !Array.isArray(reserves)) {
    // Allow if reserves data not available yet (during initialization)
    return { valid: true, value: pilotReserves };
  }
  
  // Detect if this is legacy format (array of UUIDs) or new format (array of objects)
  const firstItem = pilotReserves[0];
  const isLegacyFormat = typeof firstItem === 'string';
  
  if (isLegacyFormat) {
    // Legacy format: array of UUIDs - validate and convert to new format
    const validation = validateReserveIds(pilotReserves, reserves);
    if (!validation.valid) {
      return validation;
    }
    
    // Convert to new format with default "In Reserve" status
    const convertedReserves = pilotReserves.map(reserveId => ({
      reserveId: reserveId,
      deploymentStatus: 'In Reserve'
    }));
    
    return { valid: true, value: convertedReserves };
  } else {
    // New format: array of objects - validate each object
    const validatedReserves = [];
    
    for (let i = 0; i < pilotReserves.length; i++) {
      const validation = validateReserveObject(pilotReserves[i], reserves);
      if (!validation.valid) {
        return { 
          valid: false, 
          message: `Reserve at index ${i}: ${validation.message}` 
        };
      }
      validatedReserves.push(validation.value);
    }
    
    return { valid: true, value: validatedReserves };
  }
}

/**
 * Validate reserve UUIDs exist in reserves data
 * @param {Array} reserveIds - Array of reserve UUIDs to validate
 * @param {Array} reserves - Array of reserve objects
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateReserveIds(reserveIds, reserves) {
  // Empty array is valid
  if (!reserveIds || reserveIds.length === 0) {
    return { valid: true };
  }
  
  // Check if reserves data exists
  if (!reserves || !Array.isArray(reserves)) {
    return { valid: true }; // Allow if reserves data not available yet
  }
  
  // Get all reserve IDs from reserves data
  const existingReserveIds = new Set(reserves.map(r => r.id));
  
  // Find any invalid reserve IDs
  const invalidIds = reserveIds.filter(id => !existingReserveIds.has(id));
  
  if (invalidIds.length > 0) {
    return {
      valid: false,
      message: `Invalid reserve UUID(s): ${invalidIds.join(', ')}. Reserve(s) do not exist.`
    };
  }
  
  return { valid: true };
}

/**
 * Validate reserve data
 * @param {Object} reserveData - Reserve data object to validate
 * @returns {Object} { valid: boolean, rank?, name?, price?, description?, isCustom?, message? }
 */
function validateReserveData(reserveData) {
  // Validate rank (1-3)
  const rankValidation = validateInteger(reserveData.rank, 'Rank', 1, 3);
  if (!rankValidation.valid) {
    return rankValidation;
  }
  
  // Validate name (required, non-empty)
  const nameValidation = validateRequiredString(reserveData.name, 'Name');
  if (!nameValidation.valid) {
    return nameValidation;
  }
  
  // Validate price (non-negative integer)
  const priceValidation = validateInteger(reserveData.price, 'Price', 0);
  if (!priceValidation.valid) {
    return priceValidation;
  }
  
  // Validate description (allow empty string)
  const description = (typeof reserveData.description === 'string') 
    ? reserveData.description 
    : '';
  
  // Validate isCustom (boolean)
  const isCustom = Boolean(reserveData.isCustom);
  
  return {
    valid: true,
    rank: rankValidation.value,
    name: nameValidation.value,
    price: priceValidation.value,
    description: description,
    isCustom: isCustom
  };
}

/**
 * Calculate faction job counts from job data
 * @param {string} factionId - Faction ID
 * @param {Array} jobs - Array of all jobs
 * @returns {Object} { completed: number, failed: number }
 */
function calculateFactionJobCounts(factionId, jobs) {
  const factionJobs = jobs.filter(job => job.factionId === factionId);
  const completed = factionJobs.filter(job => job.state === 'Complete').length;
  const failed = factionJobs.filter(job => job.state === 'Failed').length;
  return { completed, failed };
}

/**
 * Enrich faction with calculated job counts
 * @param {Object} faction - Faction object with jobsCompletedOffset and jobsFailedOffset
 * @param {Array} jobs - Array of all jobs
 * @returns {Object} Enriched faction with jobsCompleted and jobsFailed totals
 */
function enrichFactionWithJobCounts(faction, jobs) {
  const counts = calculateFactionJobCounts(faction.id, jobs);
  const jobsCompletedOffset = faction.jobsCompletedOffset || 0;
  const jobsFailedOffset = faction.jobsFailedOffset || 0;
  
  return {
    ...faction,
    jobsCompleted: counts.completed + jobsCompletedOffset,
    jobsFailed: counts.failed + jobsFailedOffset
  };
}

/**
 * Create standardized success response
 * @param {Object} data - Response data
 * @returns {Object} Success response
 */
function successResponse(data = {}) {
  return { success: true, ...data };
}

/**
 * Create standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @returns {Object} Error response with status
 */
function errorResponse(message, statusCode = 400) {
  return { 
    response: { success: false, message },
    statusCode 
  };
}

/**
 * Calculate pilot's balance from their personal transactions
 * @param {Object} pilot - Pilot object with personalTransactions array
 * @param {Array} transactions - Array of all transaction objects
 * @returns {number} Pilot's current balance
 */
function calculatePilotBalance(pilot, transactions) {
  if (!pilot.personalTransactions || pilot.personalTransactions.length === 0) {
    return 0;
  }
  
  // Create a map for quick transaction lookup
  const transactionMap = {};
  transactions.forEach(t => {
    transactionMap[t.id] = t;
  });
  
  // Sum amounts for pilot's transactions
  let balance = 0;
  pilot.personalTransactions.forEach(txnId => {
    const transaction = transactionMap[txnId];
    if (transaction) {
      balance += transaction.amount;
    }
  });
  
  return balance;
}

/**
 * Get balances for all active pilots
 * @param {Array} pilots - Array of pilot objects
 * @param {Array} transactions - Array of all transaction objects
 * @returns {Array} Array of {pilot, balance} objects for active pilots
 */
function getActivePilotBalances(pilots, transactions) {
  return pilots
    .filter(pilot => pilot.active)
    .map(pilot => ({
      pilot,
      balance: calculatePilotBalance(pilot, transactions)
    }));
}

/**
 * Get deduplicated transaction history with pilot information
 * Note: Only includes transactions associated with active pilots. Transactions
 * associated exclusively with inactive pilots are excluded from the results.
 * @param {Array} pilots - Array of pilot objects
 * @param {Array} transactions - Array of all transaction objects
 * @param {number} limit - Optional limit on number of transactions (0 = all)
 * @returns {Array} Array of enriched transaction objects sorted by date (newest first)
 */
function getDeduplicatedTransactionHistory(pilots, transactions, limit = 0) {
  // Get active pilots only
  const activePilots = pilots.filter(pilot => pilot.active);
  
  // Create a map to track unique transactions and their related pilots
  const transactionPilotMap = {};
  
  activePilots.forEach(pilot => {
    if (pilot.personalTransactions && pilot.personalTransactions.length > 0) {
      pilot.personalTransactions.forEach(txnId => {
        if (!transactionPilotMap[txnId]) {
          transactionPilotMap[txnId] = [];
        }
        transactionPilotMap[txnId].push(pilot);
      });
    }
  });
  
  // Get unique transaction IDs
  const uniqueTransactionIds = Object.keys(transactionPilotMap);
  
  // Create transaction lookup map
  const transactionMap = {};
  transactions.forEach(t => {
    transactionMap[t.id] = t;
  });
  
  // Build enriched transactions
  const enrichedTransactions = uniqueTransactionIds
    .map(txnId => {
      const transaction = transactionMap[txnId];
      if (!transaction) return null;
      
      const relatedPilots = transactionPilotMap[txnId] || [];
      const pilotCount = relatedPilots.length;
      
      return {
        ...transaction,
        relatedPilots: relatedPilots,
        relatedPilotCallsigns: relatedPilots.map(p => p.callsign),
        // totalAmount represents "group impact" - if 3 pilots share a 100-unit transaction,
        // totalAmount is 300 to show the total financial impact across all involved pilots.
        // Note: Individual pilot balances use transaction.amount (non-multiplied).
        totalAmount: transaction.amount * pilotCount
      };
    })
    .filter(t => t !== null);
  
  // Sort by date (newest first)
  enrichedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Apply limit if specified
  if (limit > 0) {
    return enrichedTransactions.slice(0, limit);
  }
  
  return enrichedTransactions;
}

/**
 * Calculate cumulative balance for transaction history
 * @param {Array} enrichedTransactions - Array of enriched transactions (sorted oldest to newest)
 * @returns {Array} Array of transactions with cumulative balance
 */
function calculateCumulativeBalances(enrichedTransactions) {
  let cumulativeBalance = 0;
  
  return enrichedTransactions.map(txn => {
    cumulativeBalance += txn.totalAmount;
    return {
      ...txn,
      cumulativeBalance
    };
  });
}

/**
 * Enrich pilots with full reserve objects
 * @param {Array} pilots - Array of pilot objects
 * @param {Array} reserves - Array of reserve objects from reserves.json
 * @returns {Array} Pilots with reserveObjects array containing full reserve data
 */
function enrichPilotsWithReserves(pilots, reserves) {
  return pilots.map(pilot => {
    const reserveObjects = (pilot.reserves || []).map(reserveObj => {
      const reserve = reserves.find(r => r.id === reserveObj.reserveId);
      return {
        ...reserveObj,
        reserve: reserve || { rank: 0, name: 'UNKNOWN', description: 'Reserve not found' }
      };
    });
    
    return {
      ...pilot,
      reserveObjects
    };
  });
}

/**
 * Validate facility upgrade data
 * @param {Object} upgradeData - Upgrade data object to validate
 * @returns {Object} { valid: boolean, upgradeName?, upgradeDescription?, upgradePrice?, maxPurchases?, upgradeCount?, message? }
 */
function validateFacilityUpgrade(upgradeData) {
  // Validate upgrade name (required, non-empty)
  const nameValidation = validateRequiredString(upgradeData.upgradeName, 'Upgrade Name');
  if (!nameValidation.valid) {
    return nameValidation;
  }
  
  // Validate upgrade description (allow empty string)
  const upgradeDescription = (typeof upgradeData.upgradeDescription === 'string') 
    ? upgradeData.upgradeDescription 
    : '';
  
  // Validate upgrade price (non-negative integer)
  const priceValidation = validateInteger(upgradeData.upgradePrice, 'Upgrade Price', 0);
  if (!priceValidation.valid) {
    return priceValidation;
  }
  
  // Validate max purchases (positive integer)
  const maxPurchasesValidation = validateInteger(upgradeData.maxPurchases, 'Max Purchases', 1);
  if (!maxPurchasesValidation.valid) {
    return maxPurchasesValidation;
  }
  
  // Validate upgrade count (non-negative integer, cannot exceed maxPurchases)
  const upgradeCountValidation = validateInteger(upgradeData.upgradeCount, 'Upgrade Count', 0);
  if (!upgradeCountValidation.valid) {
    return upgradeCountValidation;
  }
  
  if (upgradeCountValidation.value > maxPurchasesValidation.value) {
    return {
      valid: false,
      message: `Upgrade count (${upgradeCountValidation.value}) cannot exceed max purchases (${maxPurchasesValidation.value})`
    };
  }
  
  return {
    valid: true,
    upgradeName: nameValidation.value,
    upgradeDescription: upgradeDescription,
    upgradePrice: priceValidation.value,
    maxPurchases: maxPurchasesValidation.value,
    upgradeCount: upgradeCountValidation.value
  };
}

/**
 * Validate Core/Major facility data
 * @param {Object} facilityData - Facility data object to validate
 * @returns {Object} { valid: boolean, type?, facilityName?, facilityDescription?, facilityPrice?, isPurchased?, upgrades?, message? }
 */
function validateCoreMajorFacility(facilityData) {
  // Validate type (Core or Major)
  if (!facilityData.type || !['Core', 'Major'].includes(facilityData.type)) {
    return { valid: false, message: 'Facility type must be "Core" or "Major"' };
  }
  
  // Validate facility name (required, non-empty)
  const nameValidation = validateRequiredString(facilityData.facilityName, 'Facility Name');
  if (!nameValidation.valid) {
    return nameValidation;
  }
  
  // Validate facility description (allow empty string)
  const facilityDescription = (typeof facilityData.facilityDescription === 'string') 
    ? facilityData.facilityDescription 
    : '';
  
  // Validate facility price (non-negative integer)
  const priceValidation = validateInteger(facilityData.facilityPrice, 'Facility Price', 0);
  if (!priceValidation.valid) {
    return priceValidation;
  }
  
  // Validate isPurchased (boolean)
  const isPurchased = Boolean(facilityData.isPurchased);
  
  // Validate upgrades array
  if (!Array.isArray(facilityData.upgrades)) {
    return { valid: false, message: 'Upgrades must be an array' };
  }
  
  const validatedUpgrades = [];
  for (let i = 0; i < facilityData.upgrades.length; i++) {
    const upgradeValidation = validateFacilityUpgrade(facilityData.upgrades[i]);
    if (!upgradeValidation.valid) {
      return {
        valid: false,
        message: `Upgrade at index ${i}: ${upgradeValidation.message}`
      };
    }
    validatedUpgrades.push({
      upgradeName: upgradeValidation.upgradeName,
      upgradeDescription: upgradeValidation.upgradeDescription,
      upgradePrice: upgradeValidation.upgradePrice,
      maxPurchases: upgradeValidation.maxPurchases,
      upgradeCount: upgradeValidation.upgradeCount
    });
  }
  
  return {
    valid: true,
    type: facilityData.type,
    facilityName: nameValidation.value,
    facilityDescription: facilityDescription,
    facilityPrice: priceValidation.value,
    isPurchased: isPurchased,
    upgrades: validatedUpgrades
  };
}

/**
 * Validate minor facility slot data
 * @param {Object} slotData - Slot data object to validate
 * @returns {Object} { valid: boolean, slotNumber?, facilityName?, facilityDescription?, enabled?, message? }
 */
function validateMinorFacilitySlot(slotData) {
  // Validate slot number (1-6)
  const slotValidation = validateInteger(slotData.slotNumber, 'Slot Number', 1, 6);
  if (!slotValidation.valid) {
    return slotValidation;
  }
  
  // Validate facility name (can be empty string)
  const facilityName = (typeof slotData.facilityName === 'string') 
    ? slotData.facilityName 
    : '';
  
  // Validate facility description (can be empty string)
  const facilityDescription = (typeof slotData.facilityDescription === 'string') 
    ? slotData.facilityDescription 
    : '';
  
  // Validate enabled (boolean)
  const enabled = Boolean(slotData.enabled);
  
  return {
    valid: true,
    slotNumber: slotValidation.value,
    facilityName: facilityName,
    facilityDescription: facilityDescription,
    enabled: enabled
  };
}

/**
 * Apply facility cost modifier to a base price
 * 
 * IMPORTANT: This function is duplicated in shared-handlers.js (client-side).
 * Any changes to the calculation logic MUST be synchronized in both locations:
 * - Server-side: /helpers.js (this file)
 * - Client-side: /public/js/shared-handlers.js
 * 
 * The duplication is necessary because:
 * - Server needs this for actual purchase price calculations
 * - Client needs this for display purposes only
 * - No build system exists to share code between Node.js and browser environments
 * 
 * Modifier is a percentage (-100 to +300)
 * Final result is rounded to the nearest 50
 * 
 * Examples:
 *   - Base price 1000, modifier -30 => 700
 *   - Base price 1000, modifier +40 => 1400
 *   - Base price 1234, modifier 0 => 1250 (rounded)
 * 
 * @param {number} basePrice - The base price before modifier
 * @param {number} modifier - Percentage modifier (-100 to +300)
 * @returns {number} Modified price rounded to nearest 50
 */
function applyFacilityCostModifier(basePrice, modifier) {
  // Ensure basePrice is a number
  const price = Number(basePrice);
  if (Number.isNaN(price) || price < 0) {
    return 0;
  }
  
  // Ensure modifier is within valid range
  const mod = Number(modifier);
  if (Number.isNaN(mod)) {
    return Math.round(price / 50) * 50;
  }
  
  // Clamp modifier to valid range
  const clampedModifier = Math.max(-100, Math.min(300, mod));
  
  // Apply percentage modifier
  const modifiedPrice = price * (1 + clampedModifier / 100);
  
  // Round to nearest 50
  return Math.round(modifiedPrice / 50) * 50;
}

/**
 * Validate voting period state
 * @param {string} state - Voting period state to validate
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateVotingPeriodState(state) {
  if (!state || typeof state !== 'string') {
    return { valid: false, message: 'Voting period state is required' };
  }
  
  if (!VOTING_PERIOD_STATES.includes(state)) {
    return { 
      valid: false, 
      message: `Invalid voting period state. Must be one of: ${VOTING_PERIOD_STATES.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate job votes array
 * @param {Array} jobVotes - Array of job vote objects
 * @param {Array} jobs - Array of job objects (optional, for UUID validation)
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateJobVotes(jobVotes, jobs = null) {
  if (!Array.isArray(jobVotes)) {
    return { valid: false, message: 'jobVotes must be an array' };
  }
  
  // Track pilot UUIDs to ensure no duplicates across jobs
  const seenPilotIds = new Set();
  
  for (let i = 0; i < jobVotes.length; i++) {
    const jobVote = jobVotes[i];
    
    // Validate jobId
    if (!jobVote.jobId || typeof jobVote.jobId !== 'string') {
      return { valid: false, message: `jobVotes[${i}]: jobId is required and must be a string` };
    }
    
    // Validate job exists and is Active state (if jobs array provided)
    if (jobs && Array.isArray(jobs)) {
      const job = jobs.find(j => j.id === jobVote.jobId);
      if (!job) {
        return { valid: false, message: `jobVotes[${i}]: Job with id ${jobVote.jobId} not found` };
      }
      if (job.state !== 'Active') {
        return { valid: false, message: `jobVotes[${i}]: Only Active jobs can be included in voting periods (job "${job.name}" is ${job.state})` };
      }
    }
    
    // Validate votes array
    if (!Array.isArray(jobVote.votes)) {
      return { valid: false, message: `jobVotes[${i}]: votes must be an array` };
    }
    
    // Check for pilot UUID duplicates within this voting period
    for (const pilotId of jobVote.votes) {
      if (typeof pilotId !== 'string' || !pilotId) {
        return { valid: false, message: `jobVotes[${i}]: All votes must be non-empty strings` };
      }
      
      if (seenPilotIds.has(pilotId)) {
        return { 
          valid: false, 
          message: `Pilot ${pilotId} appears in multiple job vote lists. Each pilot may only vote for one job per voting period.` 
        };
      }
      
      seenPilotIds.add(pilotId);
    }
  }
  
  return { valid: true };
}

/**
 * Validate end time (nullable ISO date-time string)
 * @param {string|null} endTime - End time to validate
 * @returns {Object} { valid: boolean, message?: string }
 */
function validateEndTime(endTime) {
  // Null is allowed (infinite duration)
  if (endTime === null) {
    return { valid: true };
  }
  
  // If provided, must be a string
  if (typeof endTime !== 'string') {
    return { valid: false, message: 'endTime must be a string (ISO 8601 date-time) or null' };
  }
  
  // Validate ISO 8601 date-time format
  const date = new Date(endTime);
  if (isNaN(date.getTime())) {
    return { valid: false, message: 'endTime must be a valid ISO 8601 date-time string or null' };
  }
  
  return { valid: true };
}

/**
 * Validate complete voting period data
 * @param {Object} votingPeriodData - Voting period data to validate
 * @param {Array} jobs - Optional array of job objects for validation
 * @param {Array} pilots - Optional array of pilot objects for validation
 * @returns {Object} { valid: boolean, state, jobVotes, endTime, message? }
 */
function validateVotingPeriodData(votingPeriodData, jobs = null, pilots = null) {
  // Validate state
  const stateValidation = validateVotingPeriodState(votingPeriodData.state);
  if (!stateValidation.valid) {
    return stateValidation;
  }
  
  // Validate jobVotes
  const jobVotesValidation = validateJobVotes(votingPeriodData.jobVotes, jobs);
  if (!jobVotesValidation.valid) {
    return jobVotesValidation;
  }
  
  // Validate endTime
  const endTimeValidation = validateEndTime(votingPeriodData.endTime);
  if (!endTimeValidation.valid) {
    return endTimeValidation;
  }
  
  return {
    valid: true,
    state: votingPeriodData.state,
    jobVotes: votingPeriodData.jobVotes,
    endTime: votingPeriodData.endTime
  };
}

/**
 * Check if there is already an ongoing voting period
 * @param {Array} votingPeriods - Array of voting period objects
 * @returns {Object|null} Ongoing voting period or null if none exists
 */
function getOngoingVotingPeriod(votingPeriods) {
  if (!Array.isArray(votingPeriods)) {
    return null;
  }
  
  return votingPeriods.find(period => period.state === 'Ongoing') || null;
}

module.exports = {
  // Constants
  STANDING_LABELS,
  VALID_COLOR_SCHEMES,
  DATE_PATTERN,
  SAFE_EMBLEM_PATTERN,
  JOB_STATES,
  DEFAULT_JOB_STATE,
  VOTING_PERIOD_STATES,
  DEFAULT_VOTING_PERIOD_STATE,
  
  // Functions
  getStandingLabel,
  generateId,
  sanitizeEmblemBaseName,
  isSafeEmblemFilename,
  formatEmblemTitle,
  validateDate,
  isValidColorScheme,
  validateEmblem,
  validateRequiredString,
  validateInteger,
  validatePassword,
  validateJobState,
  validateFactionId,
  validateTransactionIds,
  validateReserveIds,
  validateDeploymentStatus,
  validateReserveObject,
  validatePilotReserves,
  validateReserveData,
  calculateFactionJobCounts,
  enrichFactionWithJobCounts,
  calculatePilotBalance,
  getActivePilotBalances,
  getDeduplicatedTransactionHistory,
  calculateCumulativeBalances,
  enrichPilotsWithReserves,
  validateFacilityUpgrade,
  validateCoreMajorFacility,
  validateMinorFacilitySlot,
  applyFacilityCostModifier,
  validateVotingPeriodState,
  validateJobVotes,
  validateEndTime,
  validateVotingPeriodData,
  getOngoingVotingPeriod,
  successResponse,
  errorResponse
};
