const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireClientAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
  // Enrich pilots with balance information for consistency with SSE broadcasts
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  res.json(enrichedPilots);
});

router.post('/', requireAdminAuth, (req, res) => {
  // Read manna data for transaction validation and reserves for reserve validation
  const manna = dataStore.readManna();
  const reserves = dataStore.readReserves();
  
  // Validate pilot data
  const validation = dataStore.validatePilotData(req.body, manna, reserves);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const pilots = dataStore.readPilots();
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
    reserves: validation.reserves,
    adminLog: req.body.adminLog || ''
  };
  pilots.push(newPilot);
  dataStore.writePilots(pilots);
  
  // Enrich pilots with balance data for SSE broadcast (manna already declared above)
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  const enrichedNewPilot = enrichedPilots.find(p => p.id === newPilot.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'create', pilot: enrichedNewPilot, pilots: enrichedPilots });
  
  res.json({ success: true, pilot: enrichedNewPilot });
});

router.put('/:id', requireAdminAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Read manna data for transaction validation and reserves for reserve validation
  const manna = dataStore.readManna();
  const reserves = dataStore.readReserves();
  
  // Validate pilot data
  const validation = dataStore.validatePilotData(req.body, manna, reserves);
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
    reserves: validation.reserves,
    adminLog: req.body.adminLog || ''
  };
  dataStore.writePilots(pilots);
  
  // Enrich pilots with balance data for SSE broadcast (manna already declared above)
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  const enrichedPilot = enrichedPilots.find(p => p.id === req.params.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichedPilots });
  
  res.json({ success: true, pilot: enrichedPilot });
});

router.delete('/:id', requireAdminAuth, (req, res) => {
  let pilots = dataStore.readPilots();
  pilots = pilots.filter(p => p.id !== req.params.id);
  dataStore.writePilots(pilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'delete', pilotId: req.params.id, pilots });
  
  res.json({ success: true });
});

// Update pilot notes only (CLIENT-side endpoint)
router.put('/:id/reserves', requireAnyAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Update only notes field (keeping endpoint name for backwards compatibility)
  pilots[index].notes = (req.body.reserves || req.body.notes || '').trim();
  dataStore.writePilots(pilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: pilots[index], pilots });
  
  res.json({ success: true, pilot: pilots[index] });
});

// Toggle pilot active/inactive state (CLIENT-side endpoint)
router.put('/:id/toggle-active', requireClientAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const index = pilots.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Pilot not found' });
  }
  
  // Toggle active state
  pilots[index].active = !pilots[index].active;
  dataStore.writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = dataStore.readManna();
  const enrichedPilot = dataStore.enrichPilotsWithBalance([pilots[index]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: dataStore.enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Update pilot reserves management (ADMIN-side endpoint)
router.put('/:id/reserves-management', requireAdminAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const reserves = dataStore.readReserves();
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
  dataStore.writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = dataStore.readManna();
  const enrichedPilot = dataStore.enrichPilotsWithBalance([pilots[index]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: dataStore.enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Cycle reserve deployment status (CLIENT-side endpoint)
router.put('/:pilotId/reserves/:reserveId/cycle', requireClientAuth, (req, res) => {
  const pilots = dataStore.readPilots();
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
  dataStore.writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = dataStore.readManna();
  const enrichedPilot = dataStore.enrichPilotsWithBalance([pilots[pilotIndex]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: dataStore.enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true, pilot: enrichedPilot });
});

// Transfer reserve to another pilot (CLIENT-side endpoint)
router.post('/:pilotId/reserves/:reserveId/transfer', requireClientAuth, (req, res) => {
  const pilots = dataStore.readPilots();
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
  dataStore.writePilots(pilots);
  
  // Enrich pilots with balance for SSE broadcast
  const manna = dataStore.readManna();
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  
  res.json({ success: true });
});

// Remove reserve from pilot (CLIENT-side endpoint)
router.delete('/:pilotId/reserves/:reserveId', requireClientAuth, (req, res) => {
  const pilots = dataStore.readPilots();
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
  dataStore.writePilots(pilots);
  
  // Enrich pilot with balance for SSE broadcast
  const manna = dataStore.readManna();
  const enrichedPilot = dataStore.enrichPilotsWithBalance([pilots[pilotIndex]], manna)[0];
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: dataStore.enrichPilotsWithBalance(pilots, manna) });
  
  res.json({ success: true });
});

// Get pilot balance and transaction history
router.get('/:id/balance', requireAnyAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
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
router.put('/:id/personal-transactions', requireAdminAuth, (req, res) => {
  const pilots = dataStore.readPilots();
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
  dataStore.writePilots(pilots);
  
  // Read manna data for balance enrichment
  const manna = dataStore.readManna();
  
  // Enrich pilots with balance data for SSE broadcast
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  const enrichedPilot = enrichedPilots.find(p => p.id === req.params.id);
  
  // Broadcast SSE update with enriched data
  broadcastSSE('pilots', { action: 'update', pilot: enrichedPilot, pilots: enrichedPilots });
  
  // Return enriched pilot with balance in response
  res.json({ success: true, pilot: enrichedPilot });
});

module.exports = router;
