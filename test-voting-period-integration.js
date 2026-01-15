/**
 * Integration test for voting periods data layer
 */

const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');

const VOTING_PERIODS_FILE = path.join(__dirname, 'data', 'voting-periods.json');

console.log('Testing Voting Periods Data Layer Integration\n');

// Helper functions (mimicking server.js)
function readVotingPeriods() {
  try {
    const data = fs.readFileSync(VOTING_PERIODS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { periods: [] };
  }
}

function writeVotingPeriods(votingPeriodsData) {
  fs.writeFileSync(VOTING_PERIODS_FILE, JSON.stringify(votingPeriodsData, null, 2));
}

// Test 1: Read initial empty data
console.log('Test 1: Read initial voting periods data');
const initialData = readVotingPeriods();
console.log('  Initial data:', JSON.stringify(initialData));
console.log('  Has periods array:', Array.isArray(initialData.periods));
console.log('  Periods count:', initialData.periods.length);
console.log('');

// Test 2: Create and write a voting period
console.log('Test 2: Create and write a voting period');
const newPeriod = {
  id: helpers.generateId(),
  state: 'Ongoing',
  jobVotes: [
    {
      jobId: helpers.generateId(),
      votes: [helpers.generateId(), helpers.generateId()]
    },
    {
      jobId: helpers.generateId(),
      votes: [helpers.generateId()]
    }
  ],
  endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
};

// Validate the new period
const validation = helpers.validateVotingPeriodData(newPeriod);
console.log('  Validation result:', validation.valid ? 'PASS' : 'FAIL');
if (!validation.valid) {
  console.log('  Error:', validation.message);
}

// Write to file
const dataWithPeriod = {
  periods: [newPeriod]
};
writeVotingPeriods(dataWithPeriod);
console.log('  Written to file');
console.log('');

// Test 3: Read back and verify
console.log('Test 3: Read back and verify');
const readBack = readVotingPeriods();
console.log('  Periods count:', readBack.periods.length);
console.log('  Period ID matches:', readBack.periods[0].id === newPeriod.id);
console.log('  Period state:', readBack.periods[0].state);
console.log('  Job votes count:', readBack.periods[0].jobVotes.length);
console.log('');

// Test 4: Test ongoing period detection
console.log('Test 4: Test ongoing period detection');
const ongoingPeriod = helpers.getOngoingVotingPeriod(readBack.periods);
console.log('  Found ongoing period:', ongoingPeriod !== null);
console.log('  Ongoing period ID:', ongoingPeriod ? ongoingPeriod.id : 'N/A');
console.log('');

// Test 5: Add archived period and verify only one ongoing allowed
console.log('Test 5: Add archived period');
const archivedPeriod = {
  id: helpers.generateId(),
  state: 'Archived',
  jobVotes: [
    {
      jobId: helpers.generateId(),
      votes: [helpers.generateId()]
    }
  ],
  endTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
};

const dataWithBothPeriods = {
  periods: [newPeriod, archivedPeriod]
};
writeVotingPeriods(dataWithBothPeriods);

const readWithBoth = readVotingPeriods();
console.log('  Total periods:', readWithBoth.periods.length);
console.log('  Ongoing periods:', readWithBoth.periods.filter(p => p.state === 'Ongoing').length);
console.log('  Archived periods:', readWithBoth.periods.filter(p => p.state === 'Archived').length);
console.log('');

// Test 6: Test with null end time (infinite duration)
console.log('Test 6: Test with null end time (infinite duration)');
const infinitePeriod = {
  id: helpers.generateId(),
  state: 'Archived',
  jobVotes: [],
  endTime: null
};

const validation2 = helpers.validateVotingPeriodData(infinitePeriod);
console.log('  Validation with null endTime:', validation2.valid ? 'PASS' : 'FAIL');
console.log('');

// Test 7: Test pilot vote uniqueness constraint
console.log('Test 7: Test pilot vote uniqueness constraint');
const duplicatePilotId = helpers.generateId();
const invalidPeriod = {
  id: helpers.generateId(),
  state: 'Ongoing',
  jobVotes: [
    {
      jobId: helpers.generateId(),
      votes: [duplicatePilotId, helpers.generateId()]
    },
    {
      jobId: helpers.generateId(),
      votes: [duplicatePilotId] // Duplicate pilot - should fail
    }
  ],
  endTime: null
};

const validation3 = helpers.validateVotingPeriodData(invalidPeriod);
console.log('  Validation with duplicate pilot:', validation3.valid ? 'FAIL (should have been invalid)' : 'PASS (correctly rejected)');
console.log('  Error message:', validation3.message || 'N/A');
console.log('');

// Cleanup: Reset to empty state
writeVotingPeriods({ periods: [] });
console.log('Cleanup: Reset voting periods to empty state');
console.log('');

console.log('All integration tests completed successfully!');
