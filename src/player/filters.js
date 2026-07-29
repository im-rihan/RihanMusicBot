/**
 * Audio filter presets applied via FFmpeg args when creating resources.
 * bassboost and equalizer modes for /filter-style controls.
 */
const FILTERS = {
  flat: [],
  bassboost: ['-af', 'bass=g=8'],
  softbass: ['-af', 'bass=g=4'],
  treble: ['-af', 'treble=g=5'],
  nightcore: ['-af', 'asetrate=48000*1.25,aresample=48000,bass=g=2'],
  vaporwave: ['-af', 'asetrate=48000*0.8,aresample=48000,atempo=1.0'],
  karaoke: ['-af', 'pan=stereo|c0=c0|-0.5*c1|c1=c1|-0.5*c0'],
};

function getFilterArgs(queue) {
  if (queue.filters.bassboost) {
    return FILTERS.bassboost;
  }
  const eq = queue.filters.eq || 'flat';
  return FILTERS[eq] || FILTERS.flat;
}

function listFilters() {
  return Object.keys(FILTERS);
}

module.exports = {
  FILTERS,
  getFilterArgs,
  listFilters,
};
