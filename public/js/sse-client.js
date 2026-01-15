/**
 * SSE Client for real-time updates
 * Establishes EventSource connection and handles incoming events
 */

// Initialize SSE connection
let eventSource = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

function initSSE() {
  // Close existing connection if any
  if (eventSource) {
    eventSource.close();
  }
  
  // Create new EventSource
  eventSource = new EventSource('/api/sse');
  
  // Connection established
  eventSource.addEventListener('connected', (e) => {
    console.log('SSE connected:', e.data);
    reconnectAttempts = 0;
  });
  
  // Handle jobs updates
  eventSource.addEventListener('jobs', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleJobsUpdate === 'function') {
      handleJobsUpdate(data);
    }
  });
  
  // Handle manna updates
  eventSource.addEventListener('manna', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleMannaUpdate === 'function') {
      handleMannaUpdate(data);
    }
  });
  
  // Handle faction updates
  eventSource.addEventListener('factions', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleFactionsUpdate === 'function') {
      handleFactionsUpdate(data);
    }
  });
  
  // Handle settings updates
  eventSource.addEventListener('settings', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleSettingsUpdate === 'function') {
      handleSettingsUpdate(data);
    }
  });
  
  // Handle pilots updates
  eventSource.addEventListener('pilots', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handlePilotsUpdate === 'function') {
      handlePilotsUpdate(data);
    }
  });
  
  // Handle store-config updates
  eventSource.addEventListener('store-config', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleStoreConfigUpdate === 'function') {
      handleStoreConfigUpdate(data);
    }
  });
  
  // Handle reserves updates
  eventSource.addEventListener('reserves', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleReservesUpdate === 'function') {
      handleReservesUpdate(data);
    }
  });
  
  // Handle facilities-core-major updates
  eventSource.addEventListener('facilities-core-major', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleFacilitiesCoreMajorUpdate === 'function') {
      handleFacilitiesCoreMajorUpdate(data);
    }
  });
  
  // Handle facilities-minor-slots updates
  eventSource.addEventListener('facilities-minor-slots', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleFacilitiesMinorSlotsUpdate === 'function') {
      handleFacilitiesMinorSlotsUpdate(data);
    }
  });
  
  // Handle voting-periods updates
  eventSource.addEventListener('voting-periods', (e) => {
    const data = JSON.parse(e.data);
    if (typeof handleVotingPeriodsUpdate === 'function') {
      handleVotingPeriodsUpdate(data);
    }
  });
  
  // Handle errors
  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
    eventSource.close();
    
    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
      setTimeout(initSSE, delay);
    } else {
      console.error('Max reconnection attempts reached. Please refresh the page.');
    }
  };
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSSE);
} else {
  initSSE();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});
