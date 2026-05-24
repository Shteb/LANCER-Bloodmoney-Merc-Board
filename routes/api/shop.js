const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireClientAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');
const fileMutex = require('../../lib/fileMutex');

const router = express.Router();

router.post('/purchase', requireClientAuth, async (req, res) => {
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
    const reserves = dataStore.readReserves();
    const storeConfig = dataStore.readStoreConfig();
    const pilots = dataStore.readPilots();
    const manna = dataStore.readManna();
    
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
    dataStore.writeManna(manna);
    dataStore.writePilots(pilots);
    dataStore.writeStoreConfig(storeConfig);
    
    // Calculate balances for SSE broadcast
    const balances = dataStore.calculateBalancesFromPilots();
    
    // Enrich pilots with balance data
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    
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

module.exports = router;
