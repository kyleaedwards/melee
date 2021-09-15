/**
 * Imports
 */
const { obj } = require('../../dist');
const MeleeEditor = require('./editor');
const codeExamples = require('./examples');
const { cc, instruments } = require('./instruments');
const createTempoComponent = require('./tempo');
const { TONE_FREQ } = require('./time');
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
  callbacks: {
    send(result) {
      if (result instanceof obj.MidiCC) {
        if (cc[result.channel]) {
          cc[result.channel](result.key, result.value, Tone.now());
        }
      }
    }
  }
});

let runningNotes = {};

function stop(skipReset, skipRestage) {
  webControls.classList.remove('playing');
  Object.values(runningNotes).forEach((note) => {
    instruments[note.channel].off(note, Tone.now());
  });
  runningNotes = {};
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
  if (stopped) return;
  const results = ui.clock();
  if (!results) return;
  results.off.forEach((off) => {
    delete runningNotes[`${off.channel}-${off.pitch}`];
  });
  results.on.forEach((result) => {
    if (result instanceof obj.MidiNote && result.channel < instruments.length) {
      if (!runningNotes[result.pitch]) {
        const dur = {};
        dur[TONE_FREQ] = result.duration;
        instruments[result.channel].on(result, dur, time);
        runningNotes[`${result.channel}-${result.pitch}`] = result;
      }
    }
  });
  if (results.done) stop(false, true);
}, TONE_FREQ);

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
  Object.values(runningNotes).forEach((note) => {
    instruments[note.channel].off(note, Tone.now());
  });
  runningNotes = {};
  Tone.Transport.pause();
  stopped = false;
});

stopBtn.addEventListener('click', () => stop());

setTimeout(async () => {
  Tone.setContext(new Tone.Context({ latencyHint: 'playback' }));
  ui.initialize();
}, 250);
