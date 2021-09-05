/**
 * Constants
 */
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

/**
 * Creates an opinionated synth voice.
 *
 * @returns {Tone.Synth} Synth voice
 */
const createSynth = () => {
  const synth = new Tone.PolySynth(Tone.Synth, { oscillator: OSCILLATOR_OPTS });
  synth.connect(filter);
  return synth;
}

module.exports = { createSynth };
