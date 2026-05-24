const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const reserves = dataStore.readReserves();
  res.json(reserves);
});

router.post('/', requireAdminAuth, (req, res) => {
  const reserves = dataStore.readReserves();
  
  // Validate reserve data
  const validation = helpers.validateReserveData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newReserve = {
    id: helpers.generateId(),
    rank: validation.rank,
    name: validation.name,
    price: validation.price,
    description: validation.description,
    adminLog: req.body.adminLog || '',
    isCustom: true // All reserves created via admin are custom
  };
  
  reserves.push(newReserve);
  dataStore.writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'create', reserve: newReserve, reserves });
  
  res.json({ success: true, reserve: newReserve });
});

router.put('/:id', requireAdminAuth, (req, res) => {
  const reserves = dataStore.readReserves();
  const index = reserves.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found' });
  }
  
  // Validate reserve data
  const validation = helpers.validateReserveData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  // Update reserve (preserve ID and isCustom flag)
  reserves[index] = {
    id: reserves[index].id,
    rank: validation.rank,
    name: validation.name,
    price: validation.price,
    description: validation.description,
    isCustom: reserves[index].isCustom,
    adminLog: req.body.adminLog || ''
  };
  
  dataStore.writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'update', reserve: reserves[index], reserves });
  
  res.json({ success: true, reserve: reserves[index] });
});

router.delete('/:id', requireAdminAuth, (req, res) => {
  const reserves = dataStore.readReserves();
  const pilots = dataStore.readPilots();
  const storeConfig = dataStore.readStoreConfig();
  
  const index = reserves.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Reserve not found' });
  }
  
  // Check if reserve is in use by any pilot
  const inUseByPilot = pilots.some(pilot => 
    pilot.reserves && pilot.reserves.some(r => {
      // Handle both legacy UUID format and new object format
      if (typeof r === 'string') {
        return r === req.params.id;
      } else if (r && typeof r === 'object') {
        return r.reserveId === req.params.id;
      }
      return false;
    })
  );
  
  if (inUseByPilot) {
    return res.status(409).json({ 
      success: false, 
      message: 'Cannot delete reserve: it is currently owned by one or more pilots' 
    });
  }
  
  // Remove from store stock if present
  if (storeConfig && storeConfig.currentStock) {
    const updatedStock = storeConfig.currentStock.filter(id => id !== req.params.id);
    if (updatedStock.length !== storeConfig.currentStock.length) {
      storeConfig.currentStock = updatedStock;
      dataStore.writeStoreConfig(storeConfig);
      broadcastSSE('store-config', { action: 'update', storeConfig });
    }
  }
  
  const deletedReserve = reserves[index];
  reserves.splice(index, 1);
  dataStore.writeReserves(reserves);
  
  // Broadcast SSE update
  broadcastSSE('reserves', { action: 'delete', reserveId: req.params.id, reserves });
  
  res.json({ success: true, reserve: deletedReserve });
});

module.exports = router;
