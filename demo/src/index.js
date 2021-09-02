/**
 * Imports
 */
const { obj } = require('../..');
const MeleeEditor = require('./editor');
const codeExamples = require('./examples');
const { createSynth, disconnect } = require('./synth');
const createTempoComponent = require('./tempo');
const { $$, noop } = require('./utils');

/**
 * Elements
 */
const playBtn = $$('play');
const pauseBtn = $$('pause');
const stopBtn = $$('stop');
const webControls = $$('webControls');
const editor = $$('editor');
const sync = $$('sync');
const synced = $$('synced');
const syncError = $$('syncError');

let synth = createSynth();
const tempo = createTempoComponent();
let stopped = true;
let hasErrors = false;
let isSynced = true;

const ui = new MeleeEditor({
  editor,
  codeExamples,
  onResetError: () => {
    playBtn.disabled = false;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    hasErrors = false;
    if (isSynced) {
      synced.style.display = 'block';
    }
  },
  onSuccess: noop,
  onError: () => {
    stop(true);
    playBtn.disabled = true;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    hasErrors = true;
    if (isSynced) {
      synced.style.display = 'none';
    }
  },
  onExample: (example) => {
    tempo.set(example.tempo ||  120);
    synced.style.display = 'block';
    sync.style.display = 'none';
    syncError.style.display = 'none';
    isSynced = true;
    if (stopped) {
      ui.unlock();
    }
  },
  onChangeStaged: () => {
    sync.style.display = ui.hasStageErrors ? 'none' : 'block';
    synced.style.display = 'none';
    syncError.style.display = ui.hasStageErrors ? 'block' : 'none';
    isSynced = false;
  },
  onChangeUnstaged: () => {
    synced.style.display = 'block';
    sync.style.display = 'none';
    syncError.style.display = 'none';
    isSynced = true;
    if (stopped) {
      ui.unlock();
    }
  },
});

function stop(skipReset, skipRestage) {
  webControls.classList.remove('playing');
  if (synth) {
    disconnect(synth);
    synth = null;
    // Debounce
    setTimeout(() => {
      synth = createSynth();
    }, 10);
  }
  Tone.Transport.stop();
  tempo.reset();
  if (!skipReset) {
    if (!ui.locked) {
      ui.sync();
    } else {
      ui.reset();
    }
    if (!skipRestage && !isSynced) ui.stage();
  }
  stopped = true;
  if (isSynced) ui.unlock();
}

Tone.Transport.scheduleRepeat((time) => {
  tempo.tick();
  const results = ui.clock();
  if (!results) return;
  results.on.forEach((result) => {
    if (result instanceof obj.MidiNote && synth) {
      synth.triggerAttackRelease(
        [result.scientificNotation().replace(/_/g, '-')],
        `0:0:${result.duration}`,
        time,
        result.velocity / 127.0,
      );
    }
  });
  if (results.done) stop(false, true);
}, '16n');

playBtn.addEventListener('click', () => {
  ui.lock();
  webControls.classList.add('playing');
  if (Tone.context.state !== 'running') {
    Tone.context.resume();
    Tone.start();
  }
  Tone.Transport.start();
  stopped = false;
});

pauseBtn.addEventListener('click', () => {
  webControls.classList.remove('playing');
  Tone.Transport.pause();
  stopped = false;
});

stopBtn.addEventListener('click', () => stop());

setTimeout(() => ui.initialize(), 250);
