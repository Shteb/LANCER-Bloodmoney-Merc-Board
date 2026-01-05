/**
 * Helper functions for the LANCER Bloodmoney Merc Board application
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

module.exports = {
  // Constants
  STANDING_LABELS,
  VALID_COLOR_SCHEMES,
  DATE_PATTERN,
  SAFE_EMBLEM_PATTERN,
  JOB_STATES,
  DEFAULT_JOB_STATE,
  
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
  validateJobState,
  validateFactionId,
  validateTransactionIds,
  calculateFactionJobCounts,
  enrichFactionWithJobCounts,
  calculatePilotBalance,
  getActivePilotBalances,
  getDeduplicatedTransactionHistory,
  calculateCumulativeBalances,
  successResponse,
  errorResponse
};
