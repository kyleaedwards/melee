/**
 * Global effects
 */
const reverb = new Tone.Reverb();
reverb.wet.value = 0.4;
reverb.toDestination();

/**
 * Instrument #1: Saw Bass
 */
const filter = new Tone.Filter(2000, 'lowpass');
filter.connect(reverb);
const sawbass = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: 'fatsawtooth',
    count: 2,
    spread: 10,
  }
});
sawbass.connect(filter);

/**
 * Instrument #2: Pluck
 */
const pingPong = new Tone.PingPongDelay("16n", 0.25);
pingPong.connect(reverb);
const pluck = new Tone.PluckSynth().toDestination();
pluck.connect(pingPong);

/**
 * Instrument #3: Membrane
 */
const dist = new Tone.Distortion(0.5);
dist.wet.value = 0;
dist.toDestination();
const membrane = new Tone.MembraneSynth();
membrane.connect(dist);

window.instruments = [
  sawbass,
  pluck,
  membrane,
];

const cc = [
  (key, value, time) => {
    if (key !== 1) return;
    const freq = value * 60 + 500;
    filter.frequency.exponentialRampToValueAtTime(freq, "+0.01");
  },
  (key, value, time) => {
    if (key !== 1) return;
    pingPong.wet.exponentialRampToValueAtTime(value / 150, "+0.01");
  },
  (key, value, time) => {
    if (key !== 1) return;
    dist.wet.exponentialRampToValueAtTime(value / 150, "+0.01");
  },
]

const instruments = [
  {
    on: (note, duration, time) => {
      sawbass.triggerAttackRelease(
        [note.scientificNotation()],
        duration,
        time,
        note.velocity / 127.0,
      )
    },
    off: (note, time) => {
      sawbass.triggerRelease(note.scientificNotation(), time);
    },
  },
  {
    on: (note, duration, time) => {
      pluck.triggerAttackRelease(note.scientificNotation(), duration, time, note.velocity / 127.0);
    },
    off: () => {},
  },
  {
    on: (note, duration, time) => {
      membrane.triggerAttackRelease(note.scientificNotation(), duration, time, note.velocity / 127.0);
    },
    off: () => {},
  },
];

module.exports = {
  instruments,
  cc,
};
