/**
 * Constants
 */
const POOL_SIZE = 10;
const REVERB_WET_DRY = 0.5;
const FILTER_FREQ = 2000;
const FILTER_TYPE = 'lowpass';
const OSCILLATOR_OPTS = {
  type: 'fatsawtooth',
  count: 2,
  spread: 10,
};

/**
 * Global effects
 */
const filter = new Tone.Filter(FILTER_FREQ, FILTER_TYPE);
const reverb = new Tone.Reverb();

reverb.wet.value = REVERB_WET_DRY;
filter.connect(reverb);
reverb.toDestination();

const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
  pool.push(new Tone.PolySynth(Tone.Synth, { oscillator: OSCILLATOR_OPTS }));
}

/**
 * Creates an opinionated synth voice.
 *
 * @returns {Tone.Synth} Synth voice
 */
const createSynth = () => {
  const synth = pool.shift();
  synth.connect(filter);
  Tone.start();
  return synth;
}

const disconnect = (synth) => {
  synth.disconnect(filter);
  pool.push(synth);
};

module.exports = { createSynth, disconnect };
