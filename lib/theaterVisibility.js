// Shared "is this theater/location visible to players" rules for the
// operational-theaters feature: a hidden theater/location stays reachable
// to players while it holds an active job, so a job is never made
// unreachable by a GM visibility toggle.

function locationHasActiveJob(location, activeJobIds) {
  return ((location && location.assignedJobIds) || []).some(jobId => activeJobIds.has(jobId));
}

function theaterIsVisibleToPlayers(theater, activeJobIds) {
  return theater.active !== false || (theater.locations || []).some(location =>
    locationHasActiveJob(location, activeJobIds)
  );
}

function getActiveJobIds(jobs) {
  return new Set((jobs || []).filter(job => job.state === 'Active').map(job => job.id));
}

// Trim a full theaters array down to what a non-admin should see.
function filterTheatersForPlayers(theaters, activeJobIds) {
  return (theaters || [])
    .filter(theater => theaterIsVisibleToPlayers(theater, activeJobIds))
    .map(theater => ({
      ...theater,
      locations: (theater.locations || []).filter(location =>
        location.visibleToPlayers !== false || locationHasActiveJob(location, activeJobIds)
      )
    }));
}

// Everything a non-admin is allowed to see, in one place: nothing at all when
// the GM has switched the feature off, otherwise the visible subset. Every
// player-facing path (API, page render, SSE) must go through this so the three
// can't drift apart.
function theatersForPlayer(theaters, jobs, settings) {
  if (!settings || !settings.theatersVisible) return [];
  return filterTheatersForPlayers(theaters, getActiveJobIds(jobs));
}

// locationHasActiveJob and filterTheatersForPlayers stay internal: a caller
// reaching for the raw filter would skip the theatersVisible check.
module.exports = {
  theaterIsVisibleToPlayers,
  getActiveJobIds,
  theatersForPlayer
};
