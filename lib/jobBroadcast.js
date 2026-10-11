// Role-aware job enrichment and SSE broadcast.
//
// Lives here rather than on a route module because two routes need it (jobs
// API, admin progress-all), and a job must carry its location on every update
// or the player job board drops the LOCATION line until a reload.
const dataStore = require('../models/dataStore');
const { broadcastSSE } = require('./sseManager');
const { theatersForPlayer } = require('./theaterVisibility');
const { broadcastTheaters } = require('./theaterBroadcast');

// Enrich jobs with faction + assigned location data. A non-admin must not learn
// a location exists by seeing it named on a job, so they get the filtered view.
function enrichJobs(jobs, isAdmin = false) {
  const withFactions = dataStore.enrichJobsWithFactions(jobs, dataStore.readFactions());
  const theaters = dataStore.readTheaters();
  return dataStore.enrichJobsWithLocations(
    withFactions,
    isAdmin ? theaters : theatersForPlayer(theaters, jobs, dataStore.readSettings())
  );
}

// Broadcast a jobs update, enriched per recipient: an admin must still see the
// locations a player is not allowed to. Theaters follow, because which of them
// a player may see depends on which jobs are Active (and where they are).
function broadcastJobs(payload) {
  broadcastSSE('jobs', payload, (data, role) => ({
    ...data,
    jobs: enrichJobs(data.jobs, role === 'admin')
  }));
  broadcastTheaters({ action: 'jobs-update', theaters: dataStore.readTheaters() });
}

module.exports = { enrichJobs, broadcastJobs };
