const express = require('express');
const fs = require('fs');
const helpers = require('../helpers');
const dataStore = require('../models/dataStore');
const { requireClientAuth, requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

// Client routes
router.get('/client', requireClientAuth, (req, res) => {
  res.redirect('/client/overview');
});

router.get('/client/overview', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const manna = dataStore.readManna();
  const pilots = dataStore.readPilots();
  
  // Calculate active pilot balances
  const activePilotBalances = helpers.getActivePilotBalances(pilots, manna.transactions);
  const totalBalance = activePilotBalances.reduce((sum, pb) => sum + pb.balance, 0);
  
  // Get full unique transaction history with pilot info (newest-first)
  const allTransactions = helpers.getDeduplicatedTransactionHistory(pilots, manna.transactions, 0);
  
  // Calculate cumulative balances across all transactions (oldest-first for running total)
  const sortedOldestFirst = [...allTransactions].reverse();
  const withCumulativeOldestFirst = helpers.calculateCumulativeBalances(sortedOldestFirst);
  
  // Convert back to newest-first and take the last 5 for display
  const withCumulativeNewestFirst = [...withCumulativeOldestFirst].reverse();
  const recentWithBalance = withCumulativeNewestFirst.slice(0, 5);
  
  res.render('client-overview', { 
    settings, 
    colorScheme: settings.colorScheme, 
    totalBalance,
    recentTransactions: recentWithBalance
  });
});

router.get('/client/finances', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const manna = dataStore.readManna();
  const pilots = dataStore.readPilots();
  
  // Calculate active pilot balances
  const activePilotBalances = helpers.getActivePilotBalances(pilots, manna.transactions);
  const totalBalance = activePilotBalances.reduce((sum, pb) => sum + pb.balance, 0);
  
  // Get all unique transactions with pilot info
  const allTransactions = helpers.getDeduplicatedTransactionHistory(pilots, manna.transactions, 0);
  
  // Calculate cumulative balances (need oldest first for calculation)
  const sortedOldestFirst = [...allTransactions].reverse();
  const withCumulative = helpers.calculateCumulativeBalances(sortedOldestFirst);
  
  // Reverse back to newest first for display
  const transactionsForDisplay = withCumulative.reverse();
  
  res.render('client-finances', { 
    settings, 
    colorScheme: settings.colorScheme, 
    totalBalance,
    allTransactions: transactionsForDisplay
  });
});

router.get('/client/jobs', requireClientAuth, (req, res) => {
  const allJobs = dataStore.readJobs();
  // Filter to show only Active jobs for clients
  const jobs = allJobs.filter(job => job.state === 'Active');
  const settings = dataStore.readSettings();
  const factions = dataStore.readFactions();
  
  // Enrich jobs with faction data
  const enrichedJobs = dataStore.enrichJobsWithFactions(jobs, factions);
  
  res.render('client-jobs', { jobs: enrichedJobs, settings, colorScheme: settings.colorScheme });
});

router.get('/client/base', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const coreMajorFacilities = dataStore.readCoreMajorFacilities();
  const minorFacilitiesSlots = dataStore.readMinorFacilitiesSlots();
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
  
  // Enrich pilots with balance information
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  res.render('client-base', { 
    settings, 
    colorScheme: settings.colorScheme, 
    coreMajorFacilities,
    minorFacilitiesSlots,
    pilots: enrichedPilots,
    minorOptions: dataStore.getDefaultMinorFacilities()
  });
});

router.get('/client/factions', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const factions = dataStore.readFactions();
  const jobs = dataStore.readJobs();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  
  res.render('client-factions', { settings, colorScheme: settings.colorScheme, factions: enrichedFactions });
});

router.get('/client/pilots', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  res.render('client-pilots', { settings, colorScheme: settings.colorScheme, pilots: enrichedPilots, manna });
});

router.get('/client/shop', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
  const reserves = dataStore.readReserves();
  const storeConfig = dataStore.readStoreConfig();
  
  // Validate storeConfig exists
  if (!storeConfig) {
    return res.status(500).send('Error: Store configuration not found');
  }
  
  // Enrich pilots with balance information
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  // Get reserves from current stock
  const stockReserves = (storeConfig.currentStock || [])
    .map(id => reserves.find(r => r.id === id))
    .filter(r => r !== undefined)
    .sort((a, b) => {
      // Sort by rank ascending, then by name A-Z
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    });
  
  res.render('client-shop', { 
    settings, 
    colorScheme: settings.colorScheme, 
    pilots: enrichedPilots,
    allReserves: reserves,
    stockReserves,
    storeConfig,
    resupplyItems: storeConfig.resupplyItems || []
  });
});

router.get('/client/reserves', requireClientAuth, (req, res) => {
  const settings = dataStore.readSettings();
  const pilots = dataStore.readPilots();
  const manna = dataStore.readManna();
  const reserves = dataStore.readReserves();
  
  // Filter pilots to only those with reserves
  const pilotsWithReserves = pilots.filter(p => p.reserves && p.reserves.length > 0);
  
  // Enrich pilots with balance and reserve objects
  let enrichedPilots = dataStore.enrichPilotsWithBalance(pilotsWithReserves, manna);
  enrichedPilots = helpers.enrichPilotsWithReserves(enrichedPilots, reserves);
  
  res.render('client-reserves', { 
    settings, 
    colorScheme: settings.colorScheme, 
    pilots: enrichedPilots,
    allPilots: pilots,  // Pass all pilots for transfer modal
    allReserves: reserves
  });
});

router.get('/admin', requireAdminAuth, (req, res) => {
  const jobs = dataStore.readJobs();
  const settings = dataStore.readSettings();
  const manna = dataStore.readManna();
  const coreMajorFacilities = dataStore.readCoreMajorFacilities();
  const minorFacilitiesSlots = dataStore.readMinorFacilitiesSlots();
  const factions = dataStore.readFactions();
  const pilots = dataStore.readPilots();
  const reserves = dataStore.readReserves();
  const storeConfig = dataStore.readStoreConfig();
  const votingPeriodsData = dataStore.readVotingPeriods();
  const emblemFiles = fs.readdirSync(dataStore.getLogoArtDir())
    .filter(file => file.endsWith('.svg'))
    .sort();
  
  // Calculate balances from pilot transactions
  const balances = dataStore.calculateBalancesFromPilots();
  
  // Enrich factions with calculated job counts
  const enrichedFactions = dataStore.enrichAllFactions(factions, jobs);
  
  // Enrich pilots with balance information
  const enrichedPilots = dataStore.enrichPilotsWithBalance(pilots, manna);
  
  // Create faction lookup map for efficient template rendering
  const factionMap = dataStore.createFactionMap(enrichedFactions);
  
  // Enrich jobs with faction data and state class, then reverse for newest first
  const enrichedJobs = jobs.map(job => ({
    ...job,
    stateClass: job.state ? job.state.toLowerCase() : helpers.DEFAULT_JOB_STATE.toLowerCase(),
    faction: factionMap[job.factionId] || null
  })).reverse();
  
  // Get active job IDs for voting period creation
  const activeJobIds = jobs.filter(j => j.state === 'Active').map(j => j.id);
  
  // Get ongoing voting period
  const ongoingPeriod = helpers.getOngoingVotingPeriod(votingPeriodsData.periods);
  
  res.render('admin', { 
    jobs: enrichedJobs, 
    settings, 
    manna, 
    balances,
    coreMajorFacilities,
    minorFacilitiesSlots,
    minorFacilityOptions: dataStore.getDefaultMinorFacilities(),
    factions: enrichedFactions, 
    pilots: enrichedPilots,
    reserves,
    storeConfig,
    votingPeriods: votingPeriodsData.periods || [],
    activeJobIds: activeJobIds,
    ongoingPeriod: ongoingPeriod,
    emblems: emblemFiles, 
    formatEmblemTitle: helpers.formatEmblemTitle,
    jobStates: helpers.JOB_STATES,
    defaultJobState: helpers.DEFAULT_JOB_STATE
  });
});

module.exports = router;
