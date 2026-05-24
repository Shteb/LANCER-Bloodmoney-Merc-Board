const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const manna = dataStore.readManna();
  const balances = dataStore.calculateBalancesFromPilots();
  res.json({ ...manna, balances });
});

router.post('/transaction', requireAdminAuth, (req, res) => {
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
  
  const manna = dataStore.readManna();
  const pilots = dataStore.readPilots();
  
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
  dataStore.writeManna(manna);
  
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
    dataStore.writePilots(pilots);
  }
  
  // Calculate new balances
  const balances = dataStore.calculateBalancesFromPilots();
  
  // Enrich pilots with balance for SSE broadcast (manna already declared above)
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE updates with enriched pilot data
  broadcastSSE('manna', { action: 'transaction', manna, balances });
  if (updatedPilots) {
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  }
  
  res.json({ success: true, manna, transaction: newTransaction, balances });
});

router.put('/transaction/:id', requireAdminAuth, (req, res) => {
  const manna = dataStore.readManna();
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
  
  dataStore.writeManna(manna);
  
  // Broadcast SSE update
  broadcastSSE('manna', { action: 'update', manna });
  
  res.json({ success: true, transaction: manna.transactions[transactionIndex] });
});

router.delete('/transaction/:id', requireAdminAuth, (req, res) => {
  const manna = dataStore.readManna();
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
  dataStore.writeManna(manna);
  
  // Remove transaction from all pilots
  const pilots = dataStore.readPilots();
  let pilotsUpdated = false;
  pilots.forEach(pilot => {
    if (pilot.personalTransactions && pilot.personalTransactions.includes(transactionId)) {
      pilot.personalTransactions = pilot.personalTransactions.filter(id => id !== transactionId);
      pilotsUpdated = true;
    }
  });
  
  // Calculate new balances
  const balances = dataStore.calculateBalancesFromPilots();
  
  // Broadcast updated pilots enriched with balance information
  if (pilotsUpdated) {
    dataStore.writePilots(pilots);
    // Use existing manna variable instead of re-reading from disk (already modified above)
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  }
  
  // Broadcast SSE update for manna and balances
  broadcastSSE('manna', { action: 'delete', manna, balances });
  
  res.json({ success: true, balances });
});

// Update pilot associations for a transaction
router.put('/transaction/:id/pilots', requireAdminAuth, (req, res) => {
  const manna = dataStore.readManna();
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
  
  const pilots = dataStore.readPilots();
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
  
  dataStore.writePilots(pilots);
  
  // Calculate new balances and enrich pilots with balance information for SSE
  const balances = dataStore.calculateBalancesFromPilots();
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  // Broadcast SSE updates with enriched pilot data
  broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
  broadcastSSE('manna', { action: 'update', manna, balances });
  
  res.json({ success: true, balances, pilots: enrichedPilots });
});

module.exports = router;
