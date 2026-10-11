/**
 * Tests for the Operational Theaters feature.
 * - Validates theater/location schema shape against sample data
 * - Verifies migrateTheatersIfNeeded is idempotent and back-fills fields
 * - Verifies what a player is allowed to see, including over SSE
 *
 * Self-contained: uses a temporary data directory so it never touches real data.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

// ==================== Schema shape validation ====================

function validateLocation(loc, pathLabel) {
  assert(typeof loc.id === 'string' && loc.id.length > 0, `${pathLabel}.id must be non-empty string`);
  assert(typeof loc.name === 'string' && loc.name.length > 0, `${pathLabel}.name must be non-empty string`);
  if (loc.description !== undefined) {
    assert(typeof loc.description === 'string', `${pathLabel}.description must be a string`);
  }
  if (loc.galacticPos !== undefined) {
    assert(typeof loc.galacticPos === 'string', `${pathLabel}.galacticPos must be a string`);
  }
  assert(Array.isArray(loc.assignedJobIds), `${pathLabel}.assignedJobIds must be an array`);
  assert(typeof loc.visibleToPlayers === 'boolean', `${pathLabel}.visibleToPlayers must be boolean`);
  if (loc.x !== null && loc.x !== undefined) {
    assert(loc.x >= 0 && loc.x <= 1, `${pathLabel}.x must be within [0,1]`);
  }
  if (loc.y !== null && loc.y !== undefined) {
    assert(loc.y >= 0 && loc.y <= 1, `${pathLabel}.y must be within [0,1]`);
  }
}

function validateTheater(theater, pathLabel) {
  assert(typeof theater.id === 'string' && theater.id.length > 0, `${pathLabel}.id must be non-empty string`);
  assert(typeof theater.name === 'string' && theater.name.length > 0, `${pathLabel}.name must be non-empty string`);
  if (theater.description !== undefined) {
    assert(typeof theater.description === 'string', `${pathLabel}.description must be a string`);
  }
  if (theater.galacticPos !== undefined) {
    assert(typeof theater.galacticPos === 'string', `${pathLabel}.galacticPos must be a string`);
  }
  assert(Array.isArray(theater.locations), `${pathLabel}.locations must be an array`);
  theater.locations.forEach((loc, i) => validateLocation(loc, `${pathLabel}.locations[${i}]`));
}

test('sample theater conforms to expected shape', () => {
  const sample = {
    id: 'theater-1',
    name: 'Skaer-5 Theater',
    galacticPos: 'SKAER-5',
    description: 'Primary operational area',
    backgroundImage: 'map1.png',
    locations: [
      {
        id: 'loc-1',
        name: 'Drop Site Alpha',
        galacticPos: 'SKAER-5 // ALPHA',
        description: 'LZ',
        icon: 'token--world.svg',
        iconColor: '#e0e0e0',
        iconScale: 1,
        x: 0.42,
        y: 0.63,
        assignedJobIds: [],
        visibleToPlayers: true,
        childTheaterId: null
      }
    ]
  };
  validateTheater(sample, 'sample');
});

// ==================== Migration idempotency ====================

test('migrateTheatersIfNeeded back-fills fields and is idempotent', () => {
  // Set up a temporary BASE_PATH so dataStore writes into an isolated dir
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'theaters-test-'));
  const dataDir = path.join(tmpBase, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Minimal default_data reads are required by dataStore.init
  const repoRoot = __dirname;
  const dataStore = require('./models/dataStore');
  dataStore.init({
    BASE_PATH: tmpBase,
    DEFAULT_RESERVES: JSON.parse(fs.readFileSync(path.join(repoRoot, 'default_data', 'default_reserves.json'), 'utf8')),
    DEFAULT_CORE_MAJOR_FACILITIES: JSON.parse(fs.readFileSync(path.join(repoRoot, 'default_data', 'default_base_core_major_facilities.json'), 'utf8')),
    DEFAULT_MINOR_FACILITIES: JSON.parse(fs.readFileSync(path.join(repoRoot, 'default_data', 'default_base_minor_facilities.json'), 'utf8'))
  });

  // Write a legacy-shaped theater missing new fields
  const theatersFile = path.join(dataDir, 'theaters.json');
  const legacy = [
    {
      id: 'legacy-1',
      name: 'Legacy Theater',
      backgroundImage: 'legacy.png',
      locations: [
        { id: 'll-1', name: 'Old Location', x: 0.5, y: 0.5 }
      ]
    }
  ];
  fs.writeFileSync(theatersFile, JSON.stringify(legacy, null, 2));

  // First migration should back-fill
  dataStore.migrateTheatersIfNeeded();
  const afterFirst = JSON.parse(fs.readFileSync(theatersFile, 'utf8'));

  assert(afterFirst[0].active === true, 'active should default to true');
  const loc = afterFirst[0].locations[0];
  assert(Array.isArray(loc.assignedJobIds), 'assignedJobIds should be back-filled to array');
  assert(loc.childTheaterId === null, 'childTheaterId back-filled to null');
  assert(loc.iconColor === '#e0e0e0', 'iconColor back-filled');
  assert(loc.iconScale === 1, 'iconScale back-filled');
  assert(loc.visibleToPlayers === true, 'visibleToPlayers back-filled');

  // Second migration should be a no-op (idempotent)
  const before = fs.readFileSync(theatersFile, 'utf8');
  dataStore.migrateTheatersIfNeeded();
  const after = fs.readFileSync(theatersFile, 'utf8');
  assert(before === after, 'second migration should not change the file');

  // Clean up temp dir
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

// ==================== Player visibility ====================

const { theatersForPlayer } = require('./lib/theaterVisibility');

// A hidden theater whose hidden location holds an active job, plus a plainly
// visible one. Covers every branch of the rule in a single fixture.
function visibilityFixture() {
  return {
    theaters: [
      {
        id: 'open',
        name: 'Open Theater',
        active: true,
        locations: [
          { id: 'open-loc', name: 'Open Site', visibleToPlayers: true, assignedJobIds: [] },
          { id: 'secret-loc', name: 'Secret Site', visibleToPlayers: false, assignedJobIds: [] }
        ]
      },
      {
        id: 'hidden',
        name: 'Hidden Theater',
        active: false,
        locations: [
          { id: 'mission-loc', name: 'Mission Site', visibleToPlayers: false, assignedJobIds: ['job-active'] },
          { id: 'other-loc', name: 'Other Site', visibleToPlayers: false, assignedJobIds: ['job-done'] }
        ]
      }
    ],
    jobs: [
      { id: 'job-active', state: 'Active' },
      { id: 'job-done', state: 'Completed' }
    ]
  };
}

test('player sees nothing when the GM has theaters switched off', () => {
  const { theaters, jobs } = visibilityFixture();
  const result = theatersForPlayer(theaters, jobs, { theatersVisible: false });
  assert.deepStrictEqual(result, [], 'should return no theaters at all');
});

test('player sees visible theaters and not hidden locations', () => {
  const { theaters, jobs } = visibilityFixture();
  const open = theatersForPlayer(theaters, jobs, { theatersVisible: true })
    .find(t => t.id === 'open');
  const locIds = open.locations.map(l => l.id);
  assert(locIds.includes('open-loc'), 'visible location should be shown');
  assert(!locIds.includes('secret-loc'), 'hidden location must not be shown');
});

test('an active job keeps its hidden theater and location reachable', () => {
  const { theaters, jobs } = visibilityFixture();
  const hidden = theatersForPlayer(theaters, jobs, { theatersVisible: true })
    .find(t => t.id === 'hidden');
  assert(hidden, 'hidden theater holding an active job must stay reachable');
  const locIds = hidden.locations.map(l => l.id);
  assert(locIds.includes('mission-loc'), 'location with the active job must be shown');
  assert(!locIds.includes('other-loc'), 'hidden location without an active job must not be');
});

// ==================== SSE payload filtering ====================

test('theaters SSE payload sends players no hidden data', () => {
  const sseManager = require('./lib/sseManager');
  const dataStore = require('./models/dataStore');
  const { theaters, jobs } = visibilityFixture();

  // Serve the fixture instead of the real data files for this test
  const realReadJobs = dataStore.readJobs;
  const realReadSettings = dataStore.readSettings;
  dataStore.readJobs = () => jobs;
  dataStore.readSettings = () => ({ theatersVisible: true });

  const received = {};
  const fakeClient = role => ({
    write: message => {
      received[role] = JSON.parse(message.slice(message.indexOf('data: ') + 6));
    }
  });
  const adminRes = fakeClient('admin');
  const playerRes = fakeClient('client');

  try {
    sseManager.addClient(adminRes, 'admin');
    sseManager.addClient(playerRes, 'client');

    // Same shape the theater routes broadcast on an update
    const { broadcastTheaters } = require('./lib/theaterBroadcast');
    broadcastTheaters({ action: 'update', theater: theaters[1], theaters });

    assert(received.admin.theater, 'admin should still receive the changed theater');
    assert.strictEqual(received.admin.theaters.length, 2, 'admin should see every theater');

    assert.strictEqual(received.client.theater, undefined,
      'player payload must not carry the unfiltered changed theater');
    const clientLocIds = received.client.theaters
      .flatMap(t => t.locations.map(l => l.id));
    assert(!clientLocIds.includes('secret-loc'),
      'player payload must not carry a hidden location');
    assert(!clientLocIds.includes('other-loc'),
      'player payload must not carry a hidden location without an active job');
  } finally {
    sseManager.removeClient(adminRes);
    sseManager.removeClient(playerRes);
    dataStore.readJobs = realReadJobs;
    dataStore.readSettings = realReadSettings;
  }
});

test('theaters SSE sends players nothing when the GM switched theaters off', () => {
  const sseManager = require('./lib/sseManager');
  const dataStore = require('./models/dataStore');
  const { theaters, jobs } = visibilityFixture();

  const realReadJobs = dataStore.readJobs;
  const realReadSettings = dataStore.readSettings;
  dataStore.readJobs = () => jobs;
  dataStore.readSettings = () => ({ theatersVisible: false });

  let payload = null;
  const playerRes = {
    write: message => {
      payload = JSON.parse(message.slice(message.indexOf('data: ') + 6));
    }
  };

  try {
    sseManager.addClient(playerRes, 'client');
    const { broadcastTheaters } = require('./lib/theaterBroadcast');
    broadcastTheaters({ action: 'update', theater: theaters[0], theaters });
    assert.deepStrictEqual(payload.theaters, [], 'player should receive no theaters');
    assert.strictEqual(payload.theater, undefined, 'player should receive no theater');
  } finally {
    sseManager.removeClient(playerRes);
    dataStore.readJobs = realReadJobs;
    dataStore.readSettings = realReadSettings;
  }
});

// ==================== Single-location assignment ====================

test('assigning a job to a location drops it from every other location', () => {
  const { unassignJobsElsewhere } = require('./models/dataStore');
  const theaters = [
    {
      id: 't1',
      locations: [
        { id: 'keep', assignedJobIds: ['job-a', 'job-b'] },
        { id: 'old', assignedJobIds: ['job-a', 'job-c'] }
      ]
    },
    { id: 't2', locations: [{ id: 'far', assignedJobIds: ['job-b'] }] }
  ];

  const changed = unassignJobsElsewhere(theaters, ['job-a', 'job-b'], 'keep');

  assert(changed, 'should report a change');
  assert.deepStrictEqual(theaters[0].locations[0].assignedJobIds, ['job-a', 'job-b'], 'kept location untouched');
  assert.deepStrictEqual(theaters[0].locations[1].assignedJobIds, ['job-c'], 'other location in same theater stripped');
  assert.deepStrictEqual(theaters[1].locations[0].assignedJobIds, [], 'other theater stripped too');
  assert(!unassignJobsElsewhere(theaters, [], 'keep'), 'no jobs means no change');
});

// ==================== Summary ====================

console.log('\n' + '='.repeat(50));
console.log(`Theaters tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed === 0 ? 0 : 1);