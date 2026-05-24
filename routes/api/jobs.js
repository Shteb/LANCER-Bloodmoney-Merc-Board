const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const jobs = dataStore.readJobs();
  const factions = dataStore.readFactions();
  
  // Enrich jobs with faction data
  const enrichedJobs = dataStore.enrichJobsWithFactions(jobs, factions);
  
  res.json(enrichedJobs);
});

router.post('/', requireAdminAuth, (req, res) => {
  const jobs = dataStore.readJobs();
  const factions = dataStore.readFactions();
  
  // Validate job data
  const validation = dataStore.validateJobData(req.body, factions, dataStore.getLogoArtDir());
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newJob = {
    id: helpers.generateId(),
    name: req.body.name,
    rank: parseInt(req.body.rank),
    jobType: req.body.jobType,
    description: req.body.description,
    clientBrief: req.body.clientBrief,
    currencyPay: req.body.currencyPay,
    additionalPay: req.body.additionalPay,
    adminLog: req.body.adminLog || '',
    emblem: validation.emblem,
    state: validation.state,
    factionId: validation.factionId
  };
  jobs.push(newJob);
  dataStore.writeJobs(jobs);
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'create', job: newJob, jobs });
  
  res.json({ success: true, job: newJob });
});

router.put('/:id', requireAdminAuth, async (req, res) => {
  const jobs = dataStore.readJobs();
  const factions = dataStore.readFactions();
  
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Store old job state to check for Active -> other state transitions
  const oldJob = jobs[index];
  const wasActive = oldJob.state === 'Active';
  
  // Validate job data
  const validation = dataStore.validateJobData(req.body, factions, dataStore.getLogoArtDir());
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }
  
  const newJob = {
    id: req.params.id,
    name: req.body.name,
    rank: parseInt(req.body.rank),
    jobType: req.body.jobType,
    description: req.body.description,
    clientBrief: req.body.clientBrief,
    currencyPay: req.body.currencyPay,
    additionalPay: req.body.additionalPay,
    adminLog: req.body.adminLog || '',
    emblem: validation.emblem,
    state: validation.state,
    factionId: validation.factionId
  };
  
  jobs[index] = newJob;
  dataStore.writeJobs(jobs);
  
  // Auto-archive ongoing voting period if Active job changes to another state
  if (wasActive && newJob.state !== 'Active') {
    await dataStore.archiveOngoingVotingPeriod('Active job state changed');
  }
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'update', job: jobs[index], jobs });
  
  res.json({ success: true, job: jobs[index] });
});

router.delete('/:id', requireAdminAuth, (req, res) => {
  let jobs = dataStore.readJobs();
  jobs = jobs.filter(j => j.id !== req.params.id);
  dataStore.writeJobs(jobs);
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'delete', jobId: req.params.id, jobs });
  
  res.json({ success: true });
});

// API endpoint to update job state only
router.put('/:id/state', requireAdminAuth, async (req, res) => {
  const jobs = dataStore.readJobs();
  const index = jobs.findIndex(j => j.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }
  
  // Store old job state to check for Active -> other state transitions
  const oldJob = jobs[index];
  const wasActive = oldJob.state === 'Active';
  
  // Validate job state
  const stateValidation = helpers.validateJobState(req.body.state);
  if (!stateValidation.valid) {
    return res.status(400).json({ success: false, message: stateValidation.message });
  }
  
  // Update only the state field
  jobs[index].state = stateValidation.value;
  dataStore.writeJobs(jobs);
  
  // Auto-archive ongoing voting period if Active job changes to another state
  if (wasActive && stateValidation.value !== 'Active') {
    await dataStore.archiveOngoingVotingPeriod('Active job state changed');
  }
  
  // Broadcast SSE update
  broadcastSSE('jobs', { action: 'update', job: jobs[index], jobs });
  
  res.json({ success: true, job: jobs[index] });
});

module.exports = router;
