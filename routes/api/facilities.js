const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireClientAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');
const fileMutex = require('../../lib/fileMutex');

const router = express.Router();

const FACILITY_COUNTS = {
  CORE_COUNT: 3,
  MAJOR_COUNT: 6,
  MINOR_SLOTS_COUNT: 6,
  TOTAL_CORE_MAJOR_COUNT: 9
};

router.get('/core-major', requireAnyAuth, (req, res) => {
  const facilities = dataStore.readCoreMajorFacilities();
  res.json(facilities);
});

router.put('/core-major', requireAdminAuth, (req, res) => {
  const facilities = req.body;
  
  if (!Array.isArray(facilities) || facilities.length !== FACILITY_COUNTS.TOTAL_CORE_MAJOR_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Core/Major facilities must have exactly ${FACILITY_COUNTS.TOTAL_CORE_MAJOR_COUNT} facilities` 
    });
  }
  
  // Validate each facility
  for (let i = 0; i < facilities.length; i++) {
    const validation = helpers.validateCoreMajorFacility(facilities[i]);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Facility at index ${i}: ${validation.message}`
      });
    }
  }
  
  dataStore.writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

router.get('/minor-slots', requireAnyAuth, (req, res) => {
  const minorFacilities = dataStore.readMinorFacilitiesSlots();
  res.json(minorFacilities);
});

router.put('/minor-slots', requireAdminAuth, (req, res) => {
  const minorFacilities = req.body;
  
  if (!minorFacilities || !minorFacilities.slots || !Array.isArray(minorFacilities.slots) || minorFacilities.slots.length !== FACILITY_COUNTS.MINOR_SLOTS_COUNT) {
    return res.status(400).json({ 
      success: false, 
      message: `Minor facilities must have exactly ${FACILITY_COUNTS.MINOR_SLOTS_COUNT} slots` 
    });
  }
  
  // Validate each slot
  for (let i = 0; i < minorFacilities.slots.length; i++) {
    const validation = helpers.validateMinorFacilitySlot(minorFacilities.slots[i]);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: `Slot at index ${i}: ${validation.message}`
      });
    }
  }
  
  dataStore.writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// Get list of available minor facility options (from default data)
router.get('/minor-options', requireAnyAuth, (req, res) => {
  res.json(dataStore.getDefaultMinorFacilities());
});

// PATCH endpoint to toggle facility purchased status
router.patch('/core-major/:index/purchased', requireAdminAuth, (req, res) => {
  const facilityIndex = parseInt(req.params.index);
  const { isPurchased } = req.body;
  
  const facilities = dataStore.readCoreMajorFacilities();
  
  if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid facility index' 
    });
  }
  
  facilities[facilityIndex].isPurchased = Boolean(isPurchased);
  dataStore.writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

// PATCH endpoint to update upgrade count
router.patch('/core-major/:facilityIndex/upgrades/:upgradeIndex', requireAdminAuth, (req, res) => {
  const facilityIndex = parseInt(req.params.facilityIndex);
  const upgradeIndex = parseInt(req.params.upgradeIndex);
  const { upgradeCount } = req.body;
  
  const facilities = dataStore.readCoreMajorFacilities();
  
  if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid facility index' 
    });
  }
  
  const facility = facilities[facilityIndex];
  
  if (!Array.isArray(facility.upgrades) || facility.upgrades.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Facility has no upgrades configured'
    });
  }
  
  const upgrades = facility.upgrades;
  
  if (Number.isNaN(upgradeIndex) || upgradeIndex < 0 || upgradeIndex >= upgrades.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid upgrade index' 
    });
  }
  
  const upgrade = upgrades[upgradeIndex];
  const count = parseInt(upgradeCount);
  
  if (isNaN(count) || count < 0 || count > upgrade.maxPurchases) {
    return res.status(400).json({ 
      success: false, 
      message: `Upgrade count must be between 0 and ${upgrade.maxPurchases}` 
    });
  }
  
  upgrade.upgradeCount = count;
  dataStore.writeCoreMajorFacilities(facilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-core-major', { action: 'update', facilities });
  
  res.json({ success: true, facilities });
});

// PUT endpoint to assign minor facility to slot
router.put('/minor-slots/:slotNumber/assign', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { facilityName, facilityDescription } = req.body;
  
  const minorFacilities = dataStore.readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  if (!slot.enabled) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cannot assign facility to disabled slot' 
    });
  }
  
  // Validate facilityName input
  if (typeof facilityName !== 'string' || facilityName.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility name is required and must be a non-empty string' 
    });
  }
  
  // Validate facilityDescription input
  if (facilityDescription !== undefined && typeof facilityDescription !== 'string') {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility description must be a string' 
    });
  }
  
  // Check uniqueness - facility name must not be used in other slots
  const isNameUsed = minorFacilities.slots.some(s => 
    s.slotNumber !== slotNumber && s.facilityName === facilityName
  );
  
  if (isNameUsed) {
    return res.status(400).json({ 
      success: false, 
      message: 'This facility is already assigned to another slot' 
    });
  }
  
  slot.facilityName = facilityName.trim();
  slot.facilityDescription = (facilityDescription || '').trim();
  
  dataStore.writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// DELETE endpoint to clear minor facility slot
router.delete('/minor-slots/:slotNumber/clear', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  
  const minorFacilities = dataStore.readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  slot.facilityName = '';
  slot.facilityDescription = '';
  
  dataStore.writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// PATCH endpoint to toggle minor slot enabled status
router.patch('/minor-slots/:slotNumber/toggle-enabled', requireAdminAuth, (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { enabled } = req.body;
  
  const minorFacilities = dataStore.readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  // Only last 2 slots (5 and 6) can be toggled
  if (slotNumber < 5) {
    return res.status(400).json({ 
      success: false, 
      message: 'Only slots 5 and 6 can be enabled/disabled' 
    });
  }
  
  slot.enabled = Boolean(enabled);
  
  // If disabling, clear the slot
  if (!slot.enabled) {
    slot.facilityName = '';
    slot.facilityDescription = '';
  }
  
  dataStore.writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

// CLIENT Facility Purchase Endpoints

// POST endpoint to purchase a Core/Major facility
router.post('/core-major/:index/purchase', requireClientAuth, async (req, res) => {
  const facilityIndex = parseInt(req.params.index);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('facility-purchase');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const facilities = dataStore.readCoreMajorFacilities();
    
    if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility index' 
      });
    }
    
    const facility = facilities[facilityIndex];
    
    // Validate facility can be purchased
    if (facility.isPurchased) {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility is already purchased' 
      });
    }
    
    if (facility.facilityPrice === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Core facilities cannot be purchased (they are already owned)' 
      });
    }
    
    // Load data
    const pilots = dataStore.readPilots();
    const manna = dataStore.readManna();
    const settings = dataStore.readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = facility.facilityPrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
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
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased facility: ${facility.facilityName}`
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
    
    // Mark facility as purchased
    facility.isPurchased = true;
    
    // Save all changes
    dataStore.writeCoreMajorFacilities(facilities);
    dataStore.writeManna(manna);
    dataStore.writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-core-major', { action: 'update', facilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, facilities });
  } finally {
    // Always release the lock
    fileMutex.release('facility-purchase');
  }
});

// POST endpoint to purchase a facility upgrade
router.post('/core-major/:facilityIndex/upgrades/:upgradeIndex/purchase', requireClientAuth, async (req, res) => {
  const facilityIndex = parseInt(req.params.facilityIndex);
  const upgradeIndex = parseInt(req.params.upgradeIndex);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('facility-upgrade-purchase');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const facilities = dataStore.readCoreMajorFacilities();
    
    if (Number.isNaN(facilityIndex) || facilityIndex < 0 || facilityIndex >= facilities.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility index' 
      });
    }
    
    const facility = facilities[facilityIndex];
    
    // Validate facility is purchased
    if (!facility.isPurchased) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot purchase upgrades for an unpurchased facility' 
      });
    }
    
    if (!Array.isArray(facility.upgrades) || facility.upgrades.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Facility has no upgrades configured'
      });
    }
    
    if (Number.isNaN(upgradeIndex) || upgradeIndex < 0 || upgradeIndex >= facility.upgrades.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid upgrade index' 
      });
    }
    
    const upgrade = facility.upgrades[upgradeIndex];
    
    // Validate upgrade can be purchased
    if (upgrade.upgradeCount >= upgrade.maxPurchases) {
      return res.status(400).json({ 
        success: false, 
        message: 'Upgrade is already at maximum purchases' 
      });
    }
    
    // Load data
    const pilots = dataStore.readPilots();
    const manna = dataStore.readManna();
    const settings = dataStore.readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = upgrade.upgradePrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
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
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased upgrade: ${upgrade.upgradeName} for ${facility.facilityName}`
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
    
    // Increment upgrade count
    upgrade.upgradeCount += 1;
    
    // Save all changes
    dataStore.writeCoreMajorFacilities(facilities);
    dataStore.writeManna(manna);
    dataStore.writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-core-major', { action: 'update', facilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, facilities });
  } finally {
    // Always release the lock
    fileMutex.release('facility-upgrade-purchase');
  }
});

// POST endpoint to enable (purchase) a minor facility slot
router.post('/minor-slots/:slotNumber/enable', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('minor-slot-enable');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const minorFacilities = dataStore.readMinorFacilitiesSlots();
    
    if (Number.isNaN(slotNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
    if (slotIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slot = minorFacilities.slots[slotIndex];
    
    // Only last 2 slots (5 and 6) can be purchased/enabled
    if (slotNumber < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only slots 5 and 6 can be unlocked' 
      });
    }
    
    if (slot.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slot is already enabled' 
      });
    }
    
    // Load data
    const pilots = dataStore.readPilots();
    const manna = dataStore.readManna();
    const settings = dataStore.readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Fixed base price for slot unlock, apply modifier
    const basePrice = 5000;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
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
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Unlocked minor facility slot ${slotNumber}`
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
    
    // Enable the slot
    slot.enabled = true;
    
    // Save all changes
    dataStore.writeMinorFacilitiesSlots(minorFacilities);
    dataStore.writeManna(manna);
    dataStore.writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, minorFacilities });
  } finally {
    // Always release the lock
    fileMutex.release('minor-slot-enable');
  }
});

// POST endpoint to assign (purchase) a minor facility to a slot
router.post('/minor-slots/:slotNumber/assign', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  const { facilityName, facilityDescription, expensePilots } = req.body;
  
  // Acquire mutex lock to prevent race conditions
  // FileMutex has a built-in 5-second timeout that will throw an error if lock cannot be acquired
  await fileMutex.acquire('minor-slot-assign');
  
  try {
    // Validate inputs
    if (!Array.isArray(expensePilots) || expensePilots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid purchase request: expensePilots must be a non-empty array' 
      });
    }
    
    const minorFacilities = dataStore.readMinorFacilitiesSlots();
    
    if (Number.isNaN(slotNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
    if (slotIndex === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid slot number' 
      });
    }
    
    const slot = minorFacilities.slots[slotIndex];
    
    if (!slot.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot assign facility to disabled slot' 
      });
    }
    
    if (slot.facilityName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slot already has a facility assigned. Demolish it first.' 
      });
    }
    
    // Validate facilityName input
    if (typeof facilityName !== 'string' || facilityName.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility name is required and must be a non-empty string' 
      });
    }
    
    // Validate facilityDescription input
    if (facilityDescription !== undefined && typeof facilityDescription !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Facility description must be a string' 
      });
    }
    
    // Check uniqueness - facility name must not be used in other slots
    const isNameUsed = minorFacilities.slots.some(s => 
      s.slotNumber !== slotNumber && s.facilityName === facilityName
    );
    
    if (isNameUsed) {
      return res.status(400).json({ 
        success: false, 
        message: 'This facility is already assigned to another slot' 
      });
    }
    
    // Find the facility in default options to get price
    const facilityOption = dataStore.getDefaultMinorFacilities().find(f => f.minorFacilityName === facilityName);
    if (!facilityOption) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid facility name: not found in available options' 
      });
    }
    
    // Load data
    const pilots = dataStore.readPilots();
    const manna = dataStore.readManna();
    const settings = dataStore.readSettings();
    
    // Validate all expense pilots exist
    const invalidPilots = expensePilots.filter(id => !pilots.find(p => p.id === id));
    if (invalidPilots.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid pilot IDs in expense list' 
      });
    }
    
    // Apply facility cost modifier
    const basePrice = facilityOption.minorFacilityPrice;
    const modifier = settings.facilityCostModifier || 0;
    const modifiedPrice = helpers.applyFacilityCostModifier(basePrice, modifier);
    
    // Calculate cost per pilot (rounded up)
    const costPerPilot = Math.ceil(modifiedPrice / expensePilots.length);
    
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
    
    // Create transaction
    const now = new Date().toISOString();
    const transaction = {
      id: helpers.generateId(),
      date: now,
      amount: -costPerPilot,
      description: `Purchased minor facility: ${facilityName}`
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
    
    // Assign facility to slot
    slot.facilityName = facilityName.trim();
    slot.facilityDescription = (facilityDescription || '').trim();
    
    // Save all changes
    dataStore.writeMinorFacilitiesSlots(minorFacilities);
    dataStore.writeManna(manna);
    dataStore.writePilots(pilots);
    
    // Broadcast SSE updates
    broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
    broadcastSSE('manna', { action: 'update', manna });
    const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
    broadcastSSE('pilots', { action: 'update', pilots: enrichedPilots });
    
    res.json({ success: true, minorFacilities });
  } finally {
    // Always release the lock
    fileMutex.release('minor-slot-assign');
  }
});

// DELETE endpoint to demolish (clear) minor facility slot
router.delete('/minor-slots/:slotNumber/demolish', requireClientAuth, async (req, res) => {
  const slotNumber = parseInt(req.params.slotNumber);
  
  const minorFacilities = dataStore.readMinorFacilitiesSlots();
  
  if (Number.isNaN(slotNumber)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slotIndex = minorFacilities.slots.findIndex(slot => slot.slotNumber === slotNumber);
  if (slotIndex === -1) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid slot number' 
    });
  }
  
  const slot = minorFacilities.slots[slotIndex];
  
  if (!slot.facilityName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Slot is already empty' 
    });
  }
  
  // Clear the slot (free operation, no transaction)
  slot.facilityName = '';
  slot.facilityDescription = '';
  
  dataStore.writeMinorFacilitiesSlots(minorFacilities);
  
  // Broadcast SSE update
  broadcastSSE('facilities-minor-slots', { action: 'update', minorFacilities });
  
  res.json({ success: true, minorFacilities });
});

module.exports = router;
