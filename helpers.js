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

module.exports = {
  // Constants
  STANDING_LABELS,
  VALID_COLOR_SCHEMES,
  DATE_PATTERN,
  SAFE_EMBLEM_PATTERN,
  
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
  successResponse,
  errorResponse
};
