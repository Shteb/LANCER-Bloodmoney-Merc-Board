const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireAdminAuth } = require('../../middleware/auth');
const { enrichJobs, broadcastJobs } = require('../../lib/jobBroadcast');

const router = express.Router();

// Check body.locationId names a real location. Run before the job is written.
function validateLocationId(locationId) {
  if (locationId === undefined) return null;
  const id = String(locationId || '');
  if (id && !dataStore.readTheaters().some(t => (t.locations || []).some(l => l.id === id))) {
    return 'Location not found';
  }
  return null;
}

// Write the job's location assignment. Must run *after* the job itself is
// saved: the assignment lives on the theater and would otherwise point at a
// job that does not exist if the job write failed. broadcastJobs announces it.
function applyLocation(jobId, locationId) {
  if (locationId === undefined) return;
  dataStore.setJobLocation(jobId, String(locationId || ''));
}

router.get('/', requireAnyAuth, (req, res) => {
  res.json(enrichJobs(dataStore.readJobs(), req.session && req.session.role === 'admin'));
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
  const locationError = validateLocationId(req.body.locationId);
  if (locationError) {
    return res.status(400).json({ success: false, message: locationError });
  }
  jobs.push(newJob);
  dataStore.writeJobs(jobs);
  applyLocation(newJob.id, req.body.locationId);

  // Broadcast SSE update
  broadcastJobs({ action: 'create', job: newJob, jobs });

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
  
  const locationError = validateLocationId(req.body.locationId);
  if (locationError) {
    return res.status(400).json({ success: false, message: locationError });
  }
  jobs[index] = newJob;
  dataStore.writeJobs(jobs);
  applyLocation(newJob.id, req.body.locationId);

  // Auto-archive ongoing voting period if Active job changes to another state
  if (wasActive && newJob.state !== 'Active') {
    await dataStore.archiveOngoingVotingPeriod('Active job state changed');
  }

  // Broadcast SSE update
  broadcastJobs({ action: 'update', job: jobs[index], jobs });
  
  res.json({ success: true, job: jobs[index] });
});

router.delete('/:id', requireAdminAuth, (req, res) => {
  let jobs = dataStore.readJobs();
  jobs = jobs.filter(j => j.id !== req.params.id);
  dataStore.writeJobs(jobs);

  // Drop the job from any location holding it. Left behind, the stale ID fails
  // the assignedJobIds check the next time that location is edited.
  applyLocation(req.params.id, '');

  // Broadcast SSE update
  broadcastJobs({ action: 'delete', jobId: req.params.id, jobs });

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
  broadcastJobs({ action: 'update', job: jobs[index], jobs });

  res.json({ success: true, job: jobs[index] });
});

module.exports = router;
