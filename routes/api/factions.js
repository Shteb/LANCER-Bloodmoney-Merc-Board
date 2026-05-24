const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const factions = dataStore.readFactions();
  const jobs = dataStore.readJobs();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  
  res.json(enrichedFactions);
});

router.post('/', requireAdminAuth, (req, res) => {
  // Validate faction data
  const validation = dataStore.validateFactionData(req.body, dataStore.getLogoArtDir());
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const factions = dataStore.readFactions();
  const jobs = dataStore.readJobs();
  const newFaction = {
    id: helpers.generateId(),
    title: validation.title,
    emblem: validation.emblem,
    brief: validation.brief,
    standing: validation.standing,
    jobsCompletedOffset: validation.jobsCompletedOffset,
    jobsFailedOffset: validation.jobsFailedOffset,
    adminLog: req.body.adminLog || ''
  };
  factions.push(newFaction);
  dataStore.writeFactions(factions);
  
  // Enrich the new faction with calculated counts for the response
  const enrichedFaction = helpers.enrichFactionWithJobCounts(newFaction, jobs);
  
  // Broadcast SSE update with all enriched factions
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'create', faction: enrichedFaction, factions: enrichedFactions });
  
  res.json({ success: true, faction: enrichedFaction });
});

router.put('/:id', requireAdminAuth, (req, res) => {
  const factions = dataStore.readFactions();
  const index = factions.findIndex(f => f.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Faction not found' });
  }
  
  // Validate faction data
  const validation = dataStore.validateFactionData(req.body, dataStore.getLogoArtDir());
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const jobs = dataStore.readJobs();
  factions[index] = {
    id: req.params.id,
    title: validation.title,
    emblem: validation.emblem,
    brief: validation.brief,
    standing: validation.standing,
    jobsCompletedOffset: validation.jobsCompletedOffset,
    jobsFailedOffset: validation.jobsFailedOffset,
    adminLog: req.body.adminLog || ''
  };
  dataStore.writeFactions(factions);
  
  // Enrich the updated faction with calculated counts for the response
  const enrichedFaction = helpers.enrichFactionWithJobCounts(factions[index], jobs);
  
  // Broadcast SSE update with all enriched factions
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'update', faction: enrichedFaction, factions: enrichedFactions });
  
  res.json({ success: true, faction: enrichedFaction });
});

router.delete('/:id', requireAdminAuth, (req, res) => {
  let factions = dataStore.readFactions();
  const jobs = dataStore.readJobs();
  factions = factions.filter(f => f.id !== req.params.id);
  dataStore.writeFactions(factions);
  
  // Broadcast SSE update with enriched factions
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  broadcastSSE('factions', { action: 'delete', factionId: req.params.id, factions: enrichedFactions });
  
  res.json({ success: true });
});

module.exports = router;
