/**
 * Shared handler functions for SSE updates across all client pages
 */

// Global variable to store current currency icon path
let currentCurrencyIcon = 'manna_symbol.svg';

/**
 * HTML escape function to prevent XSS attacks
 * Used across all client views for consistent escaping
 * @param {string} text - The text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Apply facility cost modifier to a base price
 * 
 * IMPORTANT: This function is duplicated in helpers.js (server-side).
 * Any changes to the calculation logic MUST be synchronized in both locations:
 * - Client-side: /public/js/shared-handlers.js (this file)
 * - Server-side: /helpers.js
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
  const price = Number(basePrice);
  if (Number.isNaN(price) || price < 0) {
    return 0;
  }
  
  const mod = Number(modifier);
  if (Number.isNaN(mod)) {
    return Math.round(price / 50) * 50;
  }
  
  const clampedModifier = Math.max(-100, Math.min(300, mod));
  const modifiedPrice = price * (1 + clampedModifier / 100);
  return Math.round(modifiedPrice / 50) * 50;
}

/**
 * Handle settings update from SSE
 * Updates portal heading, user group, UNT date, galactic position, color scheme, operation progress, and openTable
 * 
 * Note: This is exposed as window.handleSettingsUpdate_Shared for pages that need custom handling
 */
function handleSettingsUpdate_Shared(data) {
  if (!data || !data.settings) {
    return;
  }

  const settings = data.settings;

  // Helper to update element text only when a value is provided
  function updateTextIfDefined(elementId, value) {
    if (value !== undefined && value !== null && value !== '') {
      const el = document.getElementById(elementId);
      if (el) {
        el.textContent = value;
      }
    }
  }

  // Update header text
  updateTextIfDefined('portal-heading', settings.portalHeading);
  updateTextIfDefined('user-group', settings.userGroup);
  updateTextIfDefined('unt', settings.unt);
  updateTextIfDefined('galactic-pos', settings.currentGalacticPos);

  // Update color scheme
  if (settings.colorScheme) {
    document.body.className = settings.colorScheme;
  }
  
  // Update currency icon
  if (settings.currencyIcon) {
    currentCurrencyIcon = settings.currencyIcon;
    // Update all currency icons on the page
    const currencyIcons = document.querySelectorAll('.currency-icon');
    currencyIcons.forEach(icon => {
      if (icon.tagName === 'IMG' && (icon.src.includes('/emblems/') || icon.src.includes('/css/images/manna_symbol.svg'))) {
        icon.src = `/emblems/${settings.currencyIcon}?v=${Date.now()}`;
      }
    });
  }
  
  // Update operation progress bar
  if (settings.operationProgress !== undefined) {
    updateOperationProgress(settings.operationProgress);
  }
  
  // Handle openTable setting - toggle global operation progress visibility
  if (settings.openTable !== undefined) {
    const operationProgressDiv = document.querySelector('.operation-progress');
    if (operationProgressDiv) {
      if (settings.openTable) {
        operationProgressDiv.style.display = 'none';
      } else {
        operationProgressDiv.style.display = '';
      }
    }
    
    // Update currentSettings if available (for pilot page)
    if (typeof currentSettings !== 'undefined') {
      currentSettings = settings;
      // Re-render pilots if on pilot page
      if (typeof currentPilots !== 'undefined' && typeof renderPilots === 'function') {
        renderPilots(currentPilots);
      }
    }
  }
}

/**
 * Unified settings update handler
 * Always runs shared behavior, then an optional per-page hook.
 *
 * Pages that need custom behavior should assign:
 *   window.handleSettingsUpdateHook = function (data) { ... };
 */
function handleSettingsUpdate(data) {
  // Run shared behavior first
  handleSettingsUpdate_Shared(data);

  // Then run optional page-specific hook, if defined
  if (typeof window.handleSettingsUpdateHook === 'function') {
    window.handleSettingsUpdateHook(data);
  }
}

// Expose as window properties for easier access and extension
window.handleSettingsUpdate_Shared = handleSettingsUpdate_Shared;
window.handleSettingsUpdate = handleSettingsUpdate;

/**
 * Update operation progress bar visual state
 * @param {number} progress - Progress value (0-3)
 */
function updateOperationProgress(progress) {
  const progressValue = parseInt(progress) || 0;
  
  // Update all three segments
  for (let i = 1; i <= 3; i++) {
    const segment = document.getElementById(`progress-segment-${i}`);
    if (segment) {
      if (i <= progressValue) {
        segment.classList.add('filled');
      } else {
        segment.classList.remove('filled');
      }
    }
  }
}

/**
 * Open job details modal
 * @param {string} jobId - The job ID to display
 * @param {Array} jobs - Array of job objects
 * @param {Array} factions - Array of faction objects
 */
function openJobDetails(jobId, jobs, factions) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  
  const faction = factions.find(f => f.id === job.factionId);
  
  const jobDetailsModal = document.getElementById('job-details-modal');
  const jobDetailsContainer = document.getElementById('job-details-container');
  
  const jobEmblemHtml = job.emblem ? `
    <div class="job-details-emblem">
      <img src="/emblems/${job.emblem}" alt="Job Emblem">
    </div>
  ` : `
    <div class="job-details-emblem">
      <div style="width: 60px; height: 60px; border: 2px dashed var(--border-color);"></div>
    </div>
  `;
  
  const rankStars = '★'.repeat(job.rank) + '☆'.repeat(3 - job.rank);
  
  jobDetailsContainer.innerHTML = `
    <div class="job-details">
      <div class="job-details-header">
        <div class="job-details-title">
          <h3>> ${job.name}</h3>
          <div class="job-rank" style="font-size: 18px;">${rankStars}</div>
        </div>
        ${jobEmblemHtml}
      </div>
      
      <div class="job-details-field">
        <span class="field-label">FACTION:</span>
        <span class="field-value">${faction ? faction.title : 'FACTION_NULL'}</span>
      </div>
      
      <div class="job-details-field">
        <span class="field-label">JOB_TYPE:</span>
        <span class="field-value">${job.jobType}</span>
      </div>
      
      <div class="job-details-field">
        <span class="field-label">OBJECTIVE:</span>
        <span class="field-value">${job.description}</span>
      </div>
      
      <div class="job-details-field">
        <span class="field-label">CLIENT_BRIEF:</span>
        <span class="field-value">${job.clientBrief}</span>
      </div>
      
      <div class="job-details-field">
        <span class="field-label">PAYMENT:</span>
        <span class="field-value">${job.currencyPay.replace(/m$/i, '')}<img src="/emblems/${currentCurrencyIcon}" alt="Currency Icon" class="currency-icon" style="width: 14px; height: 14px; margin-left: 3px;"></span>
      </div>
      
      ${job.additionalPay ? `
      <div class="job-details-field">
        <span class="field-label">ADDITIONAL_PAY:</span>
        <span class="field-value">${job.additionalPay}</span>
      </div>
      ` : ''}
      
      <div class="job-details-field">
        <span class="field-label">STATUS:</span>
        <span class="field-value">${job.state.toUpperCase()}</span>
      </div>
    </div>
  `;
  
  jobDetailsModal.classList.add('active');
}

/**
 * Close modal by ID
 * @param {string} modalId - The modal ID to close
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Initialize modal close handlers (call once on page load)
 * Closes modals when clicking on the overlay background
 */
function initializeModalHandlers() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
}
