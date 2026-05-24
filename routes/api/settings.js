const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const settings = dataStore.readSettings();
  res.json(settings);
});

router.put('/', requireAdminAuth, (req, res) => {
  // Validate portal heading
  const headingValidation = helpers.validateRequiredString(req.body.portalHeading, 'Portal Heading', 100);
  if (!headingValidation.valid) {
    return res.status(400).json({ success: false, message: headingValidation.message });
  }
  
  // Validate color scheme
  const colorScheme = req.body.colorScheme || 'grey';
  if (!helpers.isValidColorScheme(colorScheme)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid color scheme. Must be one of: ${helpers.VALID_COLOR_SCHEMES.join(', ')}` 
    });
  }
  
  // Validate user group
  const userGroupValidation = helpers.validateRequiredString(req.body.userGroup, 'User Group', 100);
  if (!userGroupValidation.valid) {
    return res.status(400).json({ success: false, message: userGroupValidation.message });
  }
  
  // Validate UNT date format
  const unt = req.body.unt ?? '';
  const dateValidation = helpers.validateDate(unt);
  if (!dateValidation.valid) {
    return res.status(400).json({ success: false, message: dateValidation.message });
  }
  
  // Validate operation progress
  const operationProgress = parseInt(req.body.operationProgress ?? 0);
  if (isNaN(operationProgress) || operationProgress < 0 || operationProgress > 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operation Progress must be between 0 and 3' 
    });
  }
  
  // Parse openTable boolean
  const openTable = req.body.openTable === 'true' || req.body.openTable === true;
  
  // Validate passwords (alphanumeric only, empty allowed)
  const clientPasswordValidation = helpers.validatePassword(req.body.clientPassword, 'Pilot Password');
  if (!clientPasswordValidation.valid) {
    return res.status(400).json({ success: false, message: clientPasswordValidation.message });
  }
  
  const adminPasswordValidation = helpers.validatePassword(req.body.adminPassword, 'Admin Password');
  if (!adminPasswordValidation.valid) {
    return res.status(400).json({ success: false, message: adminPasswordValidation.message });
  }
  
  // Validate that CLIENT and ADMIN passwords are different (if both are non-empty)
  if (clientPasswordValidation.value !== '' && 
      adminPasswordValidation.value !== '' && 
      clientPasswordValidation.value === adminPasswordValidation.value) {
    return res.status(400).json({ 
      success: false, 
      message: 'Pilot Password and Admin Password must be different' 
    });
  }
  
  // Validate facility cost modifier
  const facilityCostModifier = parseFloat(req.body.facilityCostModifier ?? 0);
  if (isNaN(facilityCostModifier) || facilityCostModifier < -100 || facilityCostModifier > 300) {
    return res.status(400).json({ 
      success: false, 
      message: 'Facility Cost Modifier must be between -100 and 300' 
    });
  }
  
  // Validate currency icon (optional, defaults to manna_symbol.svg)
  const currencyIcon = (req.body.currencyIcon ?? 'manna_symbol.svg').trim();
  if (currencyIcon !== '') {
    const emblemValidation = helpers.validateEmblem(currencyIcon, dataStore.getLogoArtDir());
    if (!emblemValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid currency icon: ${emblemValidation.message}` 
      });
    }
  }
  
  const settings = {
    portalHeading: headingValidation.value,
    unt: unt.trim(),
    currentGalacticPos: (req.body.currentGalacticPos ?? '').trim(),
    colorScheme: colorScheme,
    userGroup: userGroupValidation.value,
    operationProgress: operationProgress,
    openTable: openTable,
    clientPassword: clientPasswordValidation.value,
    adminPassword: adminPasswordValidation.value,
    facilityCostModifier: facilityCostModifier,
    currencyIcon: currencyIcon || 'manna_symbol.svg'
  };
  
  dataStore.writeSettings(settings);
  
  // Broadcast SSE update
  broadcastSSE('settings', { action: 'update', settings });
  
  res.json({ success: true, settings });
});

module.exports = router;
