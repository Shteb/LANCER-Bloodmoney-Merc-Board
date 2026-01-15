/**
 * Test script for voting period validation functions
 */

const helpers = require('./helpers');

console.log('Testing Voting Period Validation Functions\n');

// Test 1: Validate voting period state
console.log('Test 1: Validate voting period state');
console.log('  Valid state (Ongoing):', helpers.validateVotingPeriodState('Ongoing'));
console.log('  Valid state (Archived):', helpers.validateVotingPeriodState('Archived'));
console.log('  Invalid state:', helpers.validateVotingPeriodState('Invalid'));
console.log('  Missing state:', helpers.validateVotingPeriodState(null));
console.log('');

// Test 2: Validate end time
console.log('Test 2: Validate end time');
console.log('  Valid ISO date:', helpers.validateEndTime('2025-12-31T23:59:59Z'));
console.log('  Null (infinite):', helpers.validateEndTime(null));
console.log('  Invalid date:', helpers.validateEndTime('not a date'));
console.log('  Non-string:', helpers.validateEndTime(12345));
console.log('');

// Test 3: Validate job votes
console.log('Test 3: Validate job votes');
const validJobVotes = [
  { jobId: 'job-uuid-1', votes: ['pilot-1', 'pilot-2'] },
  { jobId: 'job-uuid-2', votes: ['pilot-3'] }
];
console.log('  Valid job votes:', helpers.validateJobVotes(validJobVotes));

const duplicateVotes = [
  { jobId: 'job-uuid-1', votes: ['pilot-1', 'pilot-2'] },
  { jobId: 'job-uuid-2', votes: ['pilot-1'] } // pilot-1 appears twice
];
console.log('  Duplicate pilot across jobs:', helpers.validateJobVotes(duplicateVotes));

const invalidJobVotes = [
  { jobId: 'job-uuid-1', votes: 'not-an-array' }
];
console.log('  Invalid votes (not array):', helpers.validateJobVotes(invalidJobVotes));

// Test job state validation with jobs array
const mockJobs = [
  { id: 'job-1', name: 'Active Job', state: 'Active' },
  { id: 'job-2', name: 'Pending Job', state: 'Pending' },
  { id: 'job-3', name: 'Complete Job', state: 'Complete' }
];

const validJobVotesWithActiveJobs = [
  { jobId: 'job-1', votes: ['pilot-1'] }
];
console.log('  Valid job votes with Active job:', helpers.validateJobVotes(validJobVotesWithActiveJobs, mockJobs));

const invalidJobVotesWithNonActiveJob = [
  { jobId: 'job-2', votes: ['pilot-1'] } // Pending job
];
console.log('  Invalid job votes with non-Active job:', helpers.validateJobVotes(invalidJobVotesWithNonActiveJob, mockJobs));

const invalidJobVotesWithMissingJob = [
  { jobId: 'non-existent-job', votes: ['pilot-1'] }
];
console.log('  Invalid job votes with missing job:', helpers.validateJobVotes(invalidJobVotesWithMissingJob, mockJobs));
console.log('');

// Test 4: Validate complete voting period data
console.log('Test 4: Validate complete voting period data');
const validVotingPeriod = {
  state: 'Ongoing',
  jobVotes: [
    { jobId: 'job-uuid-1', votes: ['pilot-1', 'pilot-2'] },
    { jobId: 'job-uuid-2', votes: ['pilot-3'] }
  ],
  endTime: '2025-12-31T23:59:59Z'
};
console.log('  Valid voting period:', helpers.validateVotingPeriodData(validVotingPeriod));

const invalidVotingPeriod = {
  state: 'InvalidState',
  jobVotes: [
    { jobId: 'job-uuid-1', votes: ['pilot-1'] }
  ],
  endTime: '2025-12-31T23:59:59Z'
};
console.log('  Invalid voting period (bad state):', helpers.validateVotingPeriodData(invalidVotingPeriod));
console.log('');

// Test 5: Get ongoing voting period
console.log('Test 5: Get ongoing voting period');
const periodsWithOngoing = [
  { id: '1', state: 'Archived', jobVotes: [], endTime: null },
  { id: '2', state: 'Ongoing', jobVotes: [], endTime: null },
  { id: '3', state: 'Archived', jobVotes: [], endTime: null }
];
console.log('  Find ongoing period:', helpers.getOngoingVotingPeriod(periodsWithOngoing));

const periodsWithoutOngoing = [
  { id: '1', state: 'Archived', jobVotes: [], endTime: null },
  { id: '2', state: 'Archived', jobVotes: [], endTime: null }
];
console.log('  No ongoing period:', helpers.getOngoingVotingPeriod(periodsWithoutOngoing));
console.log('');

console.log('All tests completed!');
