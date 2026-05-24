const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const storeConfig = dataStore.readStoreConfig();
  res.json(storeConfig);
});

router.put('/', requireAdminAuth, (req, res) => {
  const storeConfig = dataStore.readStoreConfig() || {};
  
  // Update resupply items if provided
  if (req.body.resupplyItems) {
    // Validate resupply items array
    if (!Array.isArray(req.body.resupplyItems) || req.body.resupplyItems.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Resupply items must be an array of exactly 3 items' 
      });
    }
    
    // Validate each resupply item
    for (const item of req.body.resupplyItems) {
      if (!item.id || !item.name || typeof item.price !== 'number' || typeof item.enabled !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          message: 'Each resupply item must have id, name, price, and enabled fields' 
        });
      }
      
      if (item.price < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Resupply item prices must be non-negative' 
        });
      }
    }
    
    storeConfig.resupplyItems = req.body.resupplyItems;
  }
  
  // Update current stock if provided
  if (req.body.currentStock !== undefined) {
    if (!Array.isArray(req.body.currentStock)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current stock must be an array' 
      });
    }
    
    // Validate reserve UUIDs exist
    const reserves = dataStore.readReserves();
    const validation = helpers.validateReserveIds(req.body.currentStock, reserves);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    storeConfig.currentStock = req.body.currentStock;
  }
  
  // Update resupply settings if provided
  if (req.body.resupplySettings) {
    storeConfig.resupplySettings = req.body.resupplySettings;
  }
  
  dataStore.writeStoreConfig(storeConfig);
  
  // Broadcast SSE update
  broadcastSSE('store-config', { action: 'update', storeConfig });
  
  res.json({ success: true, storeConfig });
});

// Add random reserve to store stock
router.post('/add-random', requireAdminAuth, (req, res) => {
  const storeConfig = dataStore.readStoreConfig();
  const reserves = dataStore.readReserves();
  
  // Get filter parameters from request body
  const { rankFilter, hideDefaultReserves } = req.body;
  
  // Filter reserves based on parameters
  let filteredReserves = reserves;
  
  // Apply rank filter
  if (rankFilter && rankFilter !== 'all') {
    const rank = parseInt(rankFilter);
    filteredReserves = filteredReserves.filter(r => r.rank === rank);
  }
  
  // Apply hide default reserves filter
  if (hideDefaultReserves) {
    filteredReserves = filteredReserves.filter(r => r.isCustom);
  }
  
  if (filteredReserves.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No reserves match the current filter' 
    });
  }
  
  // Pick a random reserve from filtered list
  const randomIndex = Math.floor(Math.random() * filteredReserves.length);
  const selectedReserve = filteredReserves[randomIndex];
  
  // Add to stock
  storeConfig.currentStock = storeConfig.currentStock || [];
  storeConfig.currentStock.push(selectedReserve.id);
  
  dataStore.writeStoreConfig(storeConfig);
  
  // Broadcast SSE update
  broadcastSSE('store-config', { action: 'update', storeConfig });
  
  res.json({ 
    success: true, 
    storeConfig, 
    addedReserve: selectedReserve 
  });
});

// Remove reserve from store stock
router.post('/remove-stock', requireAdminAuth, (req, res) => {
  const storeConfig = dataStore.readStoreConfig();
  const { reserveIds, removeAll } = req.body;
  
  if (removeAll) {
    // Remove all selected reserves from stock
    if (!Array.isArray(reserveIds) || reserveIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No reserves selected to remove' 
      });
    }
    
    const initialLength = storeConfig.currentStock.length;
    storeConfig.currentStock = storeConfig.currentStock.filter(id => !reserveIds.includes(id));
    const removedCount = initialLength - storeConfig.currentStock.length;
    
    dataStore.writeStoreConfig(storeConfig);
    broadcastSSE('store-config', { action: 'update', storeConfig });
    
    return res.json({ 
      success: true, 
      storeConfig, 
      removedCount 
    });
  } else {
    // Remove single reserve (first occurrence)
    if (!reserveIds || reserveIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No reserve selected to remove' 
      });
    }
    
    const reserveId = reserveIds[0];
    const index = storeConfig.currentStock.indexOf(reserveId);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reserve not found in stock' 
      });
    }
    
    storeConfig.currentStock.splice(index, 1);
    
    dataStore.writeStoreConfig(storeConfig);
    broadcastSSE('store-config', { action: 'update', storeConfig });
    
    return res.json({ 
      success: true, 
      storeConfig 
    });
  }
});

module.exports = router;
