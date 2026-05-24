const express = require('express');
const helpers = require('../../helpers');
const dataStore = require('../../models/dataStore');
const { requireAnyAuth, requireClientAuth, requireAdminAuth } = require('../../middleware/auth');
const { broadcastSSE } = require('../../lib/sseManager');
const fileMutex = require('../../lib/fileMutex');

const router = express.Router();

router.get('/', requireAnyAuth, (req, res) => {
  const votingPeriodsData = dataStore.readVotingPeriods();
  res.json(votingPeriodsData);
});

router.post('/', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = dataStore.readVotingPeriods();
    const jobs = dataStore.readJobs();
    const pilots = dataStore.readPilots();
    
    // Check if there's already an ongoing voting period
    const existingOngoing = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
    if (existingOngoing) {
      return res.status(400).json({ 
        success: false, 
        message: 'There is already an ongoing voting period. Please archive it before starting a new one.' 
      });
    }
    
    // Validate voting period data
    const validation = helpers.validateVotingPeriodData(req.body, jobs, pilots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    const newVotingPeriod = {
      id: helpers.generateId(),
      state: validation.state,
      jobVotes: validation.jobVotes,
      endTime: validation.endTime
    };
    
    votingPeriodsData.periods.push(newVotingPeriod);
    dataStore.writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'create', votingPeriod: newVotingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: newVotingPeriod });
  } catch (error) {
    console.error('Error creating voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to create voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

router.put('/:id', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = dataStore.readVotingPeriods();
    const jobs = dataStore.readJobs();
    const pilots = dataStore.readPilots();
    
    const index = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    // Validate voting period data
    const validation = helpers.validateVotingPeriodData(req.body, jobs, pilots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    // If changing state to Ongoing, check if there's already another ongoing period
    if (validation.state === 'Ongoing' && votingPeriodsData.periods[index].state !== 'Ongoing') {
      const existingOngoing = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
      if (existingOngoing && existingOngoing.id !== req.params.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'There is already an ongoing voting period. Please archive it before starting a new one.' 
        });
      }
    }
    
    const updatedVotingPeriod = {
      id: req.params.id,
      state: validation.state,
      jobVotes: validation.jobVotes,
      endTime: validation.endTime
    };
    
    votingPeriodsData.periods[index] = updatedVotingPeriod;
    dataStore.writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'update', votingPeriod: updatedVotingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: updatedVotingPeriod });
  } catch (error) {
    console.error('Error updating voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to update voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

router.delete('/:id', requireAdminAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = dataStore.readVotingPeriods();
    
    const index = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    const deletedPeriod = votingPeriodsData.periods[index];
    votingPeriodsData.periods.splice(index, 1);
    dataStore.writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update (normalized to include votingPeriod instead of periodId)
    broadcastSSE('voting-periods', { action: 'delete', votingPeriod: deletedPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: deletedPeriod });
  } catch (error) {
    console.error('Error deleting voting period:', error);
    res.status(500).json({ success: false, message: 'Failed to delete voting period' });
  } finally {
    fileMutex.release(lockKey);
  }
});

// Cast vote endpoint - CLIENT accessible
router.post('/:id/cast-vote', requireClientAuth, async (req, res) => {
  const lockKey = 'voting-periods';
  
  try {
    // Acquire mutex lock to prevent race conditions
    await fileMutex.acquire(lockKey);
    
    const votingPeriodsData = dataStore.readVotingPeriods();
    const pilots = dataStore.readPilots();
    const jobs = dataStore.readJobs();
    
    const { pilotId, jobId } = req.body;
    
    // Validate required fields
    if (!pilotId || !jobId) {
      return res.status(400).json({ success: false, message: 'pilotId and jobId are required' });
    }
    
    // Find voting period
    const votingPeriod = votingPeriodsData.periods.find(p => p.id === req.params.id);
    if (!votingPeriod) {
      return res.status(404).json({ success: false, message: 'Voting period not found' });
    }
    
    // Validate voting period is ongoing
    if (votingPeriod.state !== 'Ongoing') {
      return res.status(400).json({ success: false, message: 'Voting period is not ongoing' });
    }
    
    // Check if voting period has ended (server-side validation)
    if (votingPeriod.endTime !== null) {
      const now = new Date();
      const endTime = new Date(votingPeriod.endTime);
      if (now > endTime) {
        return res.status(400).json({ success: false, message: 'Voting period has ended' });
      }
    }
    
    // Validate pilot exists
    const pilot = pilots.find(p => p.id === pilotId);
    if (!pilot) {
      return res.status(400).json({ success: false, message: 'Pilot not found' });
    }
    
    // Validate job exists and is Active state
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(400).json({ success: false, message: 'Job not found' });
    }
    if (job.state !== 'Active') {
      return res.status(400).json({ success: false, message: 'Can only vote for Active jobs' });
    }
    
    // Validate job is in the voting period
    const jobVoteEntry = votingPeriod.jobVotes.find(jv => jv.jobId === jobId);
    if (!jobVoteEntry) {
      return res.status(400).json({ success: false, message: 'Job is not part of this voting period' });
    }
    
    // Remove pilot's vote from any other job (pilot can only vote for one job)
    votingPeriod.jobVotes.forEach(jv => {
      const index = jv.votes.indexOf(pilotId);
      if (index !== -1) {
        jv.votes.splice(index, 1);
      }
    });
    
    // Add pilot's vote to the selected job (if not already there)
    if (!jobVoteEntry.votes.includes(pilotId)) {
      jobVoteEntry.votes.push(pilotId);
    }
    
    // Update the voting period
    const periodIndex = votingPeriodsData.periods.findIndex(p => p.id === req.params.id);
    votingPeriodsData.periods[periodIndex] = votingPeriod;
    dataStore.writeVotingPeriods(votingPeriodsData);
    
    // Broadcast SSE update
    broadcastSSE('voting-periods', { action: 'vote-cast', votingPeriod: votingPeriod, periods: votingPeriodsData.periods });
    
    res.json({ success: true, votingPeriod: votingPeriod });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    fileMutex.release(lockKey);
  }
});

module.exports = router;
