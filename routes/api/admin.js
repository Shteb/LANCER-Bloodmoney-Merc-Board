const express = require('express');
const dataStore = require('../../models/dataStore');
const { requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');

const router = express.Router();

router.post('/jobs/progress-all', requireAdminAuth, async (req, res) => {
  const jobs = dataStore.readJobs();
  const pilots = dataStore.readPilots();
  
  // Update job states and track newly active jobs in a single pass
  const newlyActiveJobIds = [];
  let jobsModified = 0;
  let hasActiveToIgnored = false;
  
  const updatedJobs = jobs.map(job => {
    if (job.state === 'Active') {
      jobsModified++;
      hasActiveToIgnored = true;
      return { ...job, state: 'Ignored' };
    } else if (job.state === 'Pending') {
      jobsModified++;
      newlyActiveJobIds.push(job.id);
      return { ...job, state: 'Active' };
    }
    return job;
  });
  
  // Auto-archive ongoing voting period if any Active jobs changed to Ignored
  if (hasActiveToIgnored) {
    await dataStore.archiveOngoingVotingPeriod('Job progression (Active → Ignored)');
  }
  
  // Add newly active jobs to all active pilots' related jobs
  const updatedPilots = pilots.map(pilot => {
    if (pilot.active && newlyActiveJobIds.length > 0) {
      const existingJobIds = new Set(pilot.relatedJobs || []);
      newlyActiveJobIds.forEach(jobId => existingJobIds.add(jobId));
      return { ...pilot, relatedJobs: Array.from(existingJobIds) };
    }
    return pilot;
  });
  
  // Write updated data
  dataStore.writeJobs(updatedJobs);
  dataStore.writePilots(updatedPilots);
  
  // Broadcast SSE updates
  broadcastSSE('jobs', { action: 'progress-all', jobs: updatedJobs });
  broadcastSSE('pilots', { action: 'update-multiple', pilots: updatedPilots });
  
  res.json({ 
    success: true, 
    jobsProgressed: jobsModified,
    pilotsUpdated: updatedPilots.filter(p => p.active).length,
    newlyActiveJobs: newlyActiveJobIds.length
  });
});

// Progress operation for active pilots endpoint
router.post('/pilots/progress-operation', requireAdminAuth, (req, res) => {
  const pilots = dataStore.readPilots();
  
  // Track pilots that were reset to 0
  const resetPilots = [];
  let pilotsProgressed = 0;
  
  // Update personalOperationProgress for all active pilots
  const updatedPilots = pilots.map(pilot => {
    if (pilot.active) {
      pilotsProgressed++;
      const currentProgress = pilot.personalOperationProgress ?? 0;
      const newProgress = currentProgress >= 3 ? 0 : currentProgress + 1;
      
      if (newProgress === 0 && currentProgress === 3) {
        resetPilots.push({
          name: pilot.name,
          callsign: pilot.callsign
        });
      }
      
      return { ...pilot, personalOperationProgress: newProgress };
    }
    return pilot;
  });
  
  // Write updated data
  dataStore.writePilots(updatedPilots);
  
  // Broadcast SSE update
  broadcastSSE('pilots', { action: 'progress-operation', pilots: updatedPilots });
  
  res.json({
    success: true,
    pilotsProgressed,
    resetPilots
  });
});

module.exports = router;
