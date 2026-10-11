// Role-filtered SSE broadcast for theater updates.
//
// Lives here rather than on a route module because three routes need it
// (theaters API, theater uploads, jobs API when a job's location changes),
// and a player must never receive hidden theaters/locations in the payload.
const dataStore = require('../models/dataStore');
const { broadcastSSE } = require('./sseManager');
const { theatersForPlayer } = require('./theaterVisibility');

function broadcastTheaters(payload) {
  broadcastSSE('theaters', payload, (data, role) => {
    if (role === 'admin') return data;
    // `theater` is the single changed theater, unfiltered -- hidden locations
    // and all. Only the admin editor reads it; players re-render from
    // `theaters`. Drop it rather than filter it, so a payload added later
    // can't quietly reintroduce the leak.
    const { theater, ...rest } = data;
    return {
      ...rest,
      theaters: theatersForPlayer(data.theaters, dataStore.readJobs(), dataStore.readSettings())
    };
  });
}

module.exports = { broadcastTheaters };
