(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Imports
 */
const { Runtime, obj, errors: meleeErrors } = require('../../dist');
const prepareMeleeHighlighting = require('./syntax');
const {
  $$,
  noop,
  store,
  retrieve,
} = require('./utils');

/**
 * Constants
 */
const DEBOUNCE_TIME = 400;
const DEFAULT_THEME = 'dracula';
const DEFAULT_ENTRY_TEXT = `main := gen () {
  // Write code here
};\n`;

class MeleeEditor {
  constructor(opts = {}) {
    this.melee = new Runtime(true, {
      print: (...args) => {
        this.log(args.map(arg => arg.inspectObject()).join('<br />'));
      }
    });
    this.highlightedErrors = [];

    /* Callbacks */
    this.onSuccess = opts.onSuccess || noop;
    this.onError = opts.onError || noop;
    this.onResetError = opts.onResetError || noop;
    this.onExample = opts.onExample || noop;
    this.onChangeStaged = opts.onChangeStaged || noop;
    this.onChangeUnstaged = opts.onChangeUnstaged || noop;

    this.opts = opts;
    this.locked = false;
    this.changesStaged = false;
    this.hasStageErrors = false;

    this.debounce = null;
  }

  lock() { this.locked = true; }
  unlock() { this.locked = false; }

  initialize() {
    const { opts } = this;

    /* Components */
    this.initializeEditor(opts);
    this.initializeConsole(opts);
    this.initializeHelptext(opts);
    this.initializeLoadingPanel(opts);
    this.initializeExamples(opts);
    this.initializeKeybindings(opts);

    this.execute(this.ide.getValue());
    
    setTimeout(() => {
      document.body.classList.add('loaded');
      this.clearConsole();
    }, 250);
  }

  sync() {
    if (!this.changesStaged) return;
    if (this.hasStageErrors) return;
    const value = this.ide.getValue();
    if (this.execute(value)) {
      this.savedValue = value;
      this.onChangeUnstaged();
    }
  }

  reset() {
    this.execute(this.savedValue);
  }

  resetErrors() {
    this.onResetError();
    while (this.highlightedErrors.length) {
      this.highlightedErrors.shift().clear();
    }
  }

  showErrors(stageErrors) {
    let errors = stageErrors;
    if (!stageErrors && this.melee) {
      errors = this.melee.errors;
    }
    if (this.ide && Array.isArray(errors) && errors.length) {
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        const [err] = errors;
        if (err instanceof meleeErrors.MeleeError) {
          this.err(`${err.message} at line ${err.line}, column ${err.column}`);
        } else {
          this.err(errors[0].message);
        }
      }, DEBOUNCE_TIME);
      console.log(errors);
      errors.forEach(({ line, column, length }) => {
        console.log({ line, column, length });
        this.highlightedErrors.push(this.ide.markText(
          { line, ch: column },
          { line, ch: column + length },
          { className: 'syntax-error' },
        ));
      });
    }
    if (!stageErrors) this.onError();
  }

  stage() {
    this.resetErrors();
    const errors = this.melee.stageChanges(this.ide.getValue());
    this.hasStageErrors = errors.length > 0;
    this.showErrors(errors);
    this.onChangeStaged();
  }

  execute(code) {
    this.changesStaged = false;
    this.hasStageErrors = false;
    try {
      this.resetErrors();
      this.melee.exec(code);
      if (this.melee.errors.length) {
        this.showErrors();
        return;
      }
      store('buffer', this.ide.getValue());
      this.onSuccess();
      return true;
    } catch (e) {
      console.log(e);
      this.showErrors();
    }
  }

  getNextValue() {
    return this.melee.getNextValue();
  }

  clock() {
    let results;
    try {
      results = this.melee.clock();
    } catch (e) {
      this.err(e.message);
      this.showErrors();
    }
    return results;
  }

  /* IDE */

  initializeEditor(opts = {}) {
    const entryText = retrieve('buffer') || opts.entryText || DEFAULT_ENTRY_TEXT;
    const editor = opts.editor || $$('editor');

    prepareMeleeHighlighting(CodeMirror);
    const ide = CodeMirror.fromTextArea(editor, {
      lineNumbers: true,
      theme: opts.theme || DEFAULT_THEME,
      extraKeys: {
        'Tab': cm => cm.replaceSelection('  ', 'end'),
        'Ctrl-S': () => { this.sync() },
        'Cmd-S': () => { this.sync() },
      },
    });
    this.savedValue = entryText;
    ide.setValue(entryText);
    ide.on('beforeChange', (_, d) => {
      if (!d || typeof d.update !== 'function') {
        return d;
      }
      return d.update(null, null, d.text.map(l => l.replace(/\t/g, '  ')));
    });
    ide.on('change', () => {
      this.changesStaged = true;
      if (this.locked) {
        this.stage();
        return;
      }
      clearTimeout(this.debounce);
      this.sync();
    });
    this.ide = ide;
  }

  getCode() {
    return this.ide.getValue();
  }

  /* Console */

  initializeConsole(opts = {}) {
    this.console = opts.consoleBody || $$('consoleBody');
    this.toggle = opts.consoleToggle || $$('toggleConsole');
    
    this.consoleShown = false;
    this.items = [];
    this.historyLimit = opts.historyLimit || 25;

    if (retrieve('consoleToggled') === 'true') {
      this.showConsole();
    }

    this.toggle.addEventListener('click', () => {
      this.consoleShown ? this.hideConsole() : this.showConsole();
      store('consoleToggled', this.consoleShown);
    });
  }

  showConsole() {
    document.body.classList.add('show-console');
    this.toggle.innerText = 'Hide Console';
    this.consoleShown = true;
  }

  hideConsole() {
    document.body.classList.remove('show-console');
    this.toggle.innerText = 'Show Console';
    this.consoleShown = false;
  }

  clearConsole() {
    this.items = [];
    this.console.innerHTML = '';
    this.log('<i>Use </i>print()<i> to output values here for debugging.</i>', 'sys');
  }

  log(text, className) {
    if (!this.console) return;
    const div = document.createElement('pre');
    div.className = className || 'log';
    div.innerHTML = this.prettyPrint(text);
    this.console.appendChild(div);
    this.items.push(div);
    while (this.items.length > this.historyLimit) {
      this.console.removeChild(this.items.shift());
    }
    this.console.scrollTop = this.console.scrollHeight;
  }

  err(text) {
    this.log(`[ERROR] ${text}`, 'err');
    this.showConsole();
  }

  prettyPrint(result) {
    if (result instanceof obj.MidiNote) {
      let output;
      if (result.pitch < 0) {
        output = `Skip <em>${result.duration}</em>`;
      } else {
        output = `Play <em>${result.scientificNotation()}</em> for <em>${result.duration}</em>`;
      }
      return `${output} clock beat${result.duration !== 1 ? 's' : ''}`;
    } else if (result && result.inspectObject) {
      return result.inspectObject();
    }
    return result.toString();
  }

  /* Helptext */

  initializeHelptext(opts) {
    this.helptext = opts.helptext || $$('helptext');
    this.helptextToggle = opts.helptextToggle || $$('helptextToggle');

    let helptextHidden = false;
    if (retrieve('helptextHidden') === 'true') {
      this.helptext.classList.add('hidden');
      helptextHidden = true;
    }
    this.helptextToggle.addEventListener('click', () => {
      this.helptext.classList.toggle('hidden');
      helptextHidden = !helptextHidden;
      store('helptextHidden', helptextHidden);
    });
  }

  /* Loading Panel */

  initializeLoadingPanel(opts) {
    this.loadingPanel = opts.loadingPanel || $$('loadingPanel');
    setTimeout(() => {
      this.loadingPanel.style.display = 'none';
    }, 650);
  }

  /* Examples */

  initializeExamples(opts) {
    this.examples = opts.examples || $$('examples');
    this.codeExamples = opts.codeExamples || [];
    this.codeExamples.forEach((example) => {
      const { name, code } = example;
      const li = document.createElement('li');
      li.innerText = name;
      li.addEventListener('click', () => {
        this.clearConsole();
        this.ide.setValue(code);
        this.execute(code);
        this.onExample(example);
        this.savedValue = code;
        this.onChangeUnstaged();
      });
      this.examples.appendChild(li);
    });
  }

  /* Keybindings */

  initializeKeybindings(opts) {
    hotkeys('ctrl+s,control+s,command+s', (event) => {
      event.preventDefault();
      this.sync();
      return false;
    });
  }
}

module.exports = MeleeEditor;

},{"../../dist":13,"./syntax":4,"./utils":7}],2:[function(require,module,exports){
/**
 * Examples used when defining the helptext for the demo page. Each demo is an
 * object consisting of a descriptive `name`, the default `tempo` for the
 * demonstration, and the `code` itself.
 */
module.exports = [
  {
    name: 'Simple Loop',
    tempo: 120,
    code: `// Example: Simple Loop
//
// We're barely scratching the surface of what Melee can
// do. While it can sometimes be useful to have quick loops
// like this, the real magic happens when we use more of the
// features (like probability, randomization, scales, etc...)
// together.

main := gen () {
  loop {
    yield note [C3];
    yield note [D3];
    yield note [F3];
    yield note [G3];
  }
};\n`,
  },
  {
    name: 'One-shot Sequence',
    tempo: 120,
    code: `// Example: One-shot Sequence
//
// Not all sequences need to be loops. This is especially
// useful in the Max for Live version, as each sequence can
// be triggered (and repeated) with incoming MIDI notes.
// This makes sequences more playable and active than
// simply looping indefinitely.

main := gen () {
  yield note [C3];
  yield note [D3];
  yield note [F3];
  yield note [G3];
};\n`,
  },
  {
    name: 'Notes in G maj',
    tempo: 120,
    code: `// Example: Notes in G maj
//
// Here we're just using random number generators rand()
// and rrand(), as well as the scale() function to create
// a generative sequence of notes with different lengths
// that still conform to a G major scale.

main := gen () {
  loop {
    noteDuration := rrand(1, 5);
    notePitch := scale(SCALE_MAJOR, G2, rand(24));
    yield note [notePitch, noteDuration];
  }
};\n`,
  },
  {
    name: 'Probabilities',
    tempo: 88,
    code: `// Example: Probabilities
//
// On each cycle through the main loop, we step through
// each note in order, giving E4 a 1 in 2 chance to play,
// F#4 a 1 in 3 chance, G4 a 1 in 4 chance, and B4 a 1
// in 5.

main := gen () {
  loop {
    if (rand(2) == 0) {
      yield note [E4];
    }
    if (rand(3) == 0) {
      yield note [F#4];
    }
    if (rand(4) == 0) {
      yield note [G4];
    }
    if (rand(5) == 0) {
      yield note [B4];
    }
  }
};\n`,
  },
  {
    name: 'Random Walk',
    tempo: 120,
    code: `// Example: Random Walk
//
// This example generates notes by making single steps left or
// right (or not at all) through the array below, rolling around
// to the other side of the array if it passes the beginning or
// the end. Because of this, the sequence will only play notes
// that are adjacent to one another. In this example, it might
// happen to output a sequence like so:
//
// C3 -> C3 -> C4 -> C3 -> Eb3 -> E3 -> Eb3

main := gen () {
  position := 0;
  notes := [C3, C4, D4, G3, E3, Eb3];
  loop {
    // rand(3) returns a random number from 0 to 2. If we subtract
    // 1 from this, we either get -1, 0, or 1. Meaning that if we
    // add this to the position value, it will randomly take steps
    // forward or backwards by 1, or stay at the same value.
    position += rand(3) - 1;

    // If the number is negative, we can get the index back in the
    // positive ranges by adding the length of the array to it,
    // until it's greater than or equal to zero.
    while (position < 0) {
      position += len(notes);
    }
    
    // The mod operator (%) returns the remainder of position
    // divided by the length of the notes array. These two
    // operations together ensure that the position will always
    // be somewhere within the array's bounds, and we can use
    // the value to retrieve one of its elements.
    position %= len(notes);

    // Yield out a note object with a pitch from the list.
    yield note [notes[position], 2, 127];
  }
};`,
  },
  {
    name: 'It\'s All Generators...',
    tempo: 120,
    code: `// Example: It's All Generators...
//
// We can use multiple generators to create subsequences
// looping with different frequencies.

// We start out with a generator that loops forever, picking a random note
// out of an array.
notePitch := gen () {
  loop {
    yield [D2, A2, G2, C3, F3, E4][rand(6)];
  }
}(); // If we don't need arguments, we can call the generator immediately.

// Lets check out some built-in functions! First we'll use the
// range(n) function to create an array of numbers from 0 to n.
nums := range(5);

// Now we'll map() over them, returning a new array using the
// transform function we provide.
biggerNums := map(nums, fn(x) { return x + 1; });

// Rather than define generators with the gen keyword, we can
// also convert arrays to sequences using conv() to create a
// one-shot sequence, or cycle() to have it loop forever.
noteDuration := cycle(biggerNums);

main := gen () {
  loop {
    // Every time through the loop, we take the next item out
    // of each sequence, but since their loops have different
    // numbers of elements, they quickly get out of sync.
    yield note [next notePitch, next noteDuration];
  }
};\n`,
  },
  {
    name: 'Composing Sequences',
    tempo: 80,
    code: `// Example: Composing Sequences
//
// We can compose sequences out of random notes by introducing
// repetition into the mix. Here we're taking a generator that
// creates random notes of a scale, and pulling out four 8-note
// sequences. Each time through the loop, we repeat each
// sequence 4 times to give more structure to the melody.

// With \`cycle\` we're making a sequence of velocities that give
// some rhythmic consistency to our sequence.
velocity := cycle([127, 0, 101, 33, 47, 75, 120, 55]);

createNotes := gen (root) { // We've given this generator an
                            // argument, so it's easy to change
                            // the root note from main().
  loop {
    vl := next velocity; // Pull off next item from velocity seq.
    pt := scale(SCALE_PENT_MINOR, root, rand(18));
    yield note [pt, 1, vl];
  }
};

main := gen () {
  // Create a generator to pull random notes from.
  notes := createNotes(C3);
  
  // Create 4 sets of 8 notes up front to use in the main loop.
  sets := [];
  for i in range(4) {
    // take(seq, n) pulls the next n notes from the sequence.
    push(sets, take(notes, 8));
  }

  loop {
    // Repeat for each of the 4 sets.
    for i in range(4) {
      set := sets[i];
  
      // Loop four times over each 8-note sequence.
      for j in range(4) {
        for n in set {
          yield n;
        }
      }
    }
  }
};\n`,
  },
  {
    name: 'Polyphony',
    tempo: 101,
    code: `// Example: Polyphony
//
// Using the merge() and poly() functions, we can combine
// sequences together to create polyphonic sequences that
// play independently of one another.

// Here we have a bassline generator that plays notes
// for a full quarter note.
bass := gen () {
  loop {
    notePitch := scale(SCALE_PENT_MAJOR, G2, rand(8));
    yield note [notePitch, 8];
  }
};

// The melody plays much quicker around an octave higher
// than the bass.
melody := gen () {
  loop {
    noteDuration := rrand(1, 4);
    notePitch := scale(SCALE_MAJOR, G3, rand(16));
    yield note [notePitch, noteDuration];
  }
};

main := gen () {
  // poly(...seq) creates a new sequence from whatever
  // sequences you provide the function.
  m := poly(bass(), melody());
  loop {
    n := next m;
    yield n;
  }
};\n`,   
  },
  {
    name: 'BOC',
    tempo: 94,
    code: `// Example: BOC
//
// Not much to this one. If you know you know.

main := gen () {
  loop {
    yield note [G#2, 2];
    yield skip 1;
    yield note [A#2];
    yield note [B3];
    yield note [B3];
    yield note [G#2];
    yield note [B3];
    yield note [G#2];
    yield note [A#3];
    yield note [F#3];
    yield note [G#2];
    yield note [B1, 2];
    yield note [A#2];
    yield note [G#2];
    yield note [C#3, 4];
    yield note [C#2, 6];
    yield note [F#3, 4];
    yield note [G#3, 2];
    yield note [G#1, 3];
    yield note [A#2];
    yield note [D#3];
    yield note [A#2];
    yield note [D#3];
    yield note [A#2];
    yield note [F#2];
    yield note [F#3];
    yield note [F#3];
    yield note [A#2];
    yield note [F#3];
    yield note [G#3];
    yield note [G#3, 2];
    yield note [C#2, 2];
    yield note [D#2];
    yield note [F3];
    yield note [D#2, 2];
    yield note [F3, 2];
    yield note [B3, 2];
    yield note [F3];
    yield note [B3];
    yield note [F3];
    yield note [A#3];
    yield note [F#3, 2];
  }
};\n`,
  },
];

},{}],3:[function(require,module,exports){
/**
 * Imports
 */
const { obj } = require('../../dist');
const MeleeEditor = require('./editor');
const codeExamples = require('./examples');
const { createSynth } = require('./synth');
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

let runningNotes = {};

function stop(skipReset, skipRestage) {
  webControls.classList.remove('playing');
  if (synth) {
    Object.values(runningNotes).forEach((note) => {
      synth.triggerRelease(note, Tone.now());
    });
    runningNotes = {};
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
  if (stopped) return;
  const results = ui.clock();
  if (!results) return;
  results.off.forEach((off) => {
    delete runningNotes[off];
  });
  results.on.forEach((result) => {
    if (result instanceof obj.MidiNote && synth) {
      if (!runningNotes[result.pitch]) {
        const sciNote = result.scientificNotation();
        console.log(result.duration);
        synth.triggerAttackRelease(
          [sciNote],
          `0:0:${result.duration}`,
          time,
          result.velocity / 127.0,
        );
        runningNotes[result.pitch] = sciNote;
      }
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
  Object.values(runningNotes).forEach((note) => {
    console.log(note);
    synth.triggerRelease(note, Tone.now());
  });
  runningNotes = {};
  Tone.Transport.pause();
  stopped = false;
});

stopBtn.addEventListener('click', () => stop());

setTimeout(async () => {
  Tone.setContext(new Tone.Context({ latencyHint: 'playback' }))
  // await Tone.start();
  ui.initialize()
}, 250);

},{"../../dist":13,"./editor":1,"./examples":2,"./synth":5,"./tempo":6,"./utils":7}],4:[function(require,module,exports){
/**
 * Imports
 */
const { KNOWN_LABELS } = require('../../dist');

module.exports = (CodeMirror) => {
  CodeMirror.defineMode('melee', (config) => {
    const indentUnit = config.indentUnit;
    const keywords = {
      'break': true,
      'cc': true,
      'continue': true,
      'else': true,
      'for': true, 
      'fn': true,
      'gen': true,
      'if': true,
      'in': true,
      'loop': true,
      'next': true,
      'note': true,
      'return': true,
      'skip': true,
      'while': true,
      'yield': true,
    };

    const atoms = {
      'true': true,
      'false': true,
      ...KNOWN_LABELS.reduce((acc, cur) => ({
        ...acc,
        [cur]: true,
      }), {}),
    };

    const isOperatorChar = /[+\-*&^%:=<>!|\/]/;

    let curPunc;

    function tokenBase(stream, state) {
      const ch = stream.next();

      if (/[\d\.]/.test(ch)) {
        stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
        return 'number';
      }
      if (/[\[\]{}\(\),;\:\.=]/.test(ch)) {
        curPunc = ch;
        return null;
      }
      if (ch == '/') {
        if (stream.eat('/')) {
          stream.skipToEnd();
          return 'comment';
        }
      }
      if (isOperatorChar.test(ch)) {
        stream.eatWhile(isOperatorChar);
        return 'operator';
      }
      stream.eatWhile(/[\w\$#_\xa1-\uffff]/);
      var cur = stream.current();
      if (keywords.propertyIsEnumerable(cur)) {
        return 'keyword';
      }
      if (atoms.propertyIsEnumerable(cur)) return 'atom';
      return 'variable';
    }

    function Context(indented, column, type, align, prev) {
      this.indented = indented;
      this.column = column;
      this.type = type;
      this.align = align;
      this.prev = prev;
    }

    function pushContext(state, col, type) {
      return state.context = new Context(state.indented, col, type, null, state.context);
    }

    function popContext(state) {
      if (!state.context.prev) return;
      var t = state.context.type;
      if (t == ')' || t == ']' || t == '}')
        state.indented = state.context.indented;
      return state.context = state.context.prev;
    }

    return {
      startState: function(basecolumn) {
        return {
          tokenize: null,
          context: new Context((basecolumn || 0) - indentUnit, 0, 'top', false),
          indented: 0,
          startOfLine: true
        };
      },

      token: function(stream, state) {
        var ctx = state.context;
        if (stream.sol()) {
          if (ctx.align == null) ctx.align = false;
          state.indented = stream.indentation();
          state.startOfLine = true;
        }
        if (stream.eatSpace()) return null;
        curPunc = null;
        var style = (state.tokenize || tokenBase)(stream, state);
        if (style == 'comment') return style;
        if (ctx.align == null) ctx.align = true;

        if (curPunc == '{') pushContext(state, stream.column(), '}');
        else if (curPunc == '[') pushContext(state, stream.column(), ']');
        else if (curPunc == '(') pushContext(state, stream.column(), ')');
        else if (curPunc == '}' && ctx.type == '}') popContext(state);
        else if (curPunc == ctx.type) popContext(state);
        state.startOfLine = false;
        return style;
      },

      indent: function(state, textAfter) {
        if (state.tokenize != tokenBase && state.tokenize != null) return CodeMirror.Pass;
        var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
        var closing = firstChar == ctx.type;
        if (ctx.align) return ctx.column + (closing ? 0 : 1);
        else return ctx.indented + (closing ? 0 : indentUnit);
      },

      electricChars: '{}):',
      closeBrackets: '()[]{}',
      fold: 'brace',
      lineComment: '//'
    };
  });

  CodeMirror.defineMIME('text/x-melee', 'melee');
};

},{"../../dist":13}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
/**
 * Imports
 */
const { $$, store, retrieve, clampWithDefault } = require('./utils');

/**
 * Create a tempo component.
 *
 * @returns {object} Tempo component functions
 */
module.exports = () => {
  const valueEl = $$('tempoValue');
  const indicator = $$('indicator');

  valueEl.addEventListener('keypress', (e) => {
    if (e.key !== 'Backspace' && isNaN(parseInt(e.key, 10))) e.preventDefault();
  });
  valueEl.addEventListener('focusout', (e) => {
    let tempo = parseInt(valueEl.innerText, 10);
    setTempo(tempo);
  });
  
  const setTempo = (tempo) => {
    const t = clampWithDefault(tempo, 20, 300, Tone.Transport.bpm.value);
    valueEl.innerText = t;
    Tone.Transport.bpm.value = t;
    store('tempo', t);
  };

  const startingTempo = retrieve('tempo') || 120;
  setTempo(startingTempo);

  let ticks = 0;
  return {
    set: setTempo,
    tick: () => {
      ticks++;
      if (ticks % 4 === 0) {
        ticks = 0;
        indicator.classList.add('on');
        setTimeout(() => {
          indicator.classList.remove('on');
        }, 100);
      }
    },
    reset: () => {
      ticks = 0;
    }
  };
};

},{"./utils":7}],7:[function(require,module,exports){
/**
 * Shortcut for document.getElementById(id).
 *
 * @param {string} id HTML element ID attribute
 * @returns {HTMLElement} Element if present
 */
const $$ = id => document.getElementById(id);

/**
 * No-op function; does nothing, returns nothing.
 */
const noop = () => {};

/**
 * Retrieves the project name from the query string, a global variable
 * or if those fail, the default value.
 *
 * @returns {string} Project name
 */
const getProject = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const project = urlParams.get('project');
  if (project) return project;
  return window.PROJECT || 'default';
};

/**
 * Store local variables relative to the current project.
 * @param {string} key LocalStorage partial key
 * @param {*} val Result to be saved
 */
const store = (key, val) => localStorage.setItem(`${getProject()}__${key}`, val);

/**
 * Retrieve local variables relative to the current project.
 * @param {string} key LocalStorage partial key
 * @returns {*} Result to be returned
 */
const retrieve = (key) => localStorage.getItem(`${getProject()}__${key}`);

/**
 * Clamp with default value.
 * 
 * @param {number} num Number to clamp
 * @param {number} lo Lower bound
 * @param {number} hi Upper bound
 * @param {number} def Default value
 */
const clampWithDefault = (num, lo, hi, def) => {
  const n = parseInt(num, 10);
  if (isNaN(n)) return def;
  if (typeof n !== 'number') return def;
  return Math.max(lo, Math.min(hi, n));
};

module.exports = {
  $$,
  noop,
  store,
  retrieve,
  clampWithDefault,
};

},{}],8:[function(require,module,exports){
"use strict";
/**
 * Abstract syntax tree mechanisms and node types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CCExpression = exports.SkipExpression = exports.NoteExpression = exports.CallExpression = exports.IndexExpression = exports.NextExpression = exports.GeneratorLiteral = exports.FunctionLiteral = exports.IfExpression = exports.InfixExpression = exports.PrefixExpression = exports.ArrayLiteral = exports.BooleanLiteral = exports.IntegerLiteral = exports.CompoundAssignExpression = exports.AssignExpression = exports.Identifier = exports.WhileStatement = exports.ForStatement = exports.BreakStatement = exports.ContinueStatement = exports.BlockStatement = exports.ExpressionStatement = exports.YieldStatement = exports.ReturnStatement = exports.DeclareStatement = exports.Program = void 0;
/**
 * Root-level program node encapsulating the full abstract syntax tree.
 *
 * @public
 */
class Program {
    constructor() {
        this.statements = [];
    }
    toString() {
        return this.statements.map((stmt) => stmt.toString()).join('\n');
    }
}
exports.Program = Program;
/**
 * Statements
 */
/**
 * AST node type representing a variable definition statement like `var := 1;`.
 *
 * @public
 */
class DeclareStatement {
    constructor(token, name, value) {
        this.token = token;
        this.name = name;
        this.value = value;
        this.nodeType = 'statement';
    }
    toString() {
        return `${this.name.toString()} := ${this.value ? this.value.toString() : ''};`;
    }
}
exports.DeclareStatement = DeclareStatement;
/**
 * AST node type representing a return statement like `return var;`.
 *
 * @public
 */
class ReturnStatement {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'statement';
    }
    toString() {
        return this.value
            ? `${this.token.literal} ${this.value.toString()};`
            : `${this.token.literal};`;
    }
}
exports.ReturnStatement = ReturnStatement;
/**
 * AST node type representing a yield statement like `yield var;`. Must
 * be used within a generator function.
 *
 * @public
 */
class YieldStatement {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'statement';
    }
    toString() {
        return this.value
            ? `${this.token.literal} ${this.value.toString()};`
            : `${this.token.literal};`;
    }
}
exports.YieldStatement = YieldStatement;
/**
 * AST statement encapsulating an expression like `1 + 2;`.
 *
 * @public
 */
class ExpressionStatement {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'statement';
    }
    toString() {
        if (this.value) {
            return `${this.value.toString()};`;
        }
        return '';
    }
}
exports.ExpressionStatement = ExpressionStatement;
/**
 * AST statement encapsulating a group of statements for a function body,
 * conditional, while loop, etc.
 *
 * @public
 */
class BlockStatement {
    constructor(token, statements) {
        this.token = token;
        this.statements = statements;
        this.nodeType = 'statement';
    }
    toString() {
        return `{ ${this.statements
            .map((s) => s.toString())
            .join('\n')} }`;
    }
}
exports.BlockStatement = BlockStatement;
/**
 * AST node type representing a `continue` statement for flow control within
 * a loop.
 *
 * @public
 */
class ContinueStatement {
    constructor(token) {
        this.token = token;
        this.nodeType = 'statement';
    }
    toString() {
        return `continue;`;
    }
}
exports.ContinueStatement = ContinueStatement;
/**
 * AST node type representing a `break` statement for flow control within
 * a loop.
 *
 * @public
 */
class BreakStatement {
    constructor(token) {
        this.token = token;
        this.nodeType = 'statement';
    }
    toString() {
        return `break;`;
    }
}
exports.BreakStatement = BreakStatement;
/**
 * AST node type representing a `for x in arr {}` expression.
 *
 * @public
 */
class ForStatement {
    constructor(token, identifier, collection, block) {
        this.token = token;
        this.identifier = identifier;
        this.collection = collection;
        this.block = block;
        this.nodeType = 'statement';
    }
    toString() {
        return `for ${this.identifier.toString()} in ${this.collection.toString()} ${this.block.toString()}`;
    }
}
exports.ForStatement = ForStatement;
/**
 * AST node type representing a `while` or `loop` expression.
 *
 * @public
 */
class WhileStatement {
    constructor(token, condition, block) {
        this.token = token;
        this.condition = condition;
        this.block = block;
        this.nodeType = 'statement';
    }
    toString() {
        if (this.token.tokenType === 'loop') {
            return `loop ${this.block.toString()}`;
        }
        return `while (${this.condition.toString()}) ${this.block.toString()}`;
    }
}
exports.WhileStatement = WhileStatement;
/**
 * Expressions
 */
/**
 * AST node type a variable identifier.
 *
 * @public
 */
class Identifier {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'expression';
    }
    toString() {
        return this.value;
    }
}
exports.Identifier = Identifier;
/**
 * AST node type representing a variable assignment expression like `var = 1;`
 * or `arr[0] = 2`.
 *
 * @public
 */
class AssignExpression {
    constructor(token, name, value) {
        this.token = token;
        this.name = name;
        this.value = value;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.name.toString()} = ${this.value ? this.value.toString() : ''};`;
    }
}
exports.AssignExpression = AssignExpression;
/**
 * AST node type representing a compound assignment expression like `var += 1;`
 * or `arr[0] *= 2`.
 *
 * @public
 */
class CompoundAssignExpression {
    constructor(token, name, operator, value) {
        this.token = token;
        this.name = name;
        this.operator = operator;
        this.value = value;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.name.toString()} ${this.operator} ${this.value ? this.value.toString() : ''};`;
    }
}
exports.CompoundAssignExpression = CompoundAssignExpression;
/**
 * AST node type representing an integer literal.
 *
 * @public
 */
class IntegerLiteral {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'expression';
    }
    toString() {
        return this.value.toString();
    }
}
exports.IntegerLiteral = IntegerLiteral;
/**
 * AST node type representing a boolean literal.
 *
 * @public
 */
class BooleanLiteral {
    constructor(token, value) {
        this.token = token;
        this.value = value;
        this.nodeType = 'expression';
    }
    toString() {
        return this.value.toString();
    }
}
exports.BooleanLiteral = BooleanLiteral;
/**
 * AST node type representing an array literal.
 *
 * @public
 */
class ArrayLiteral {
    constructor(token, values) {
        this.token = token;
        this.values = values;
        this.nodeType = 'expression';
    }
    toString() {
        return `[${this.values
            .map((value) => value.toString())
            .join(', ')}]`;
    }
}
exports.ArrayLiteral = ArrayLiteral;
/**
 * AST node type representing a unary operator expression like `!true` or `-2`.
 *
 * @public
 */
class PrefixExpression {
    constructor(token, operator, right) {
        this.token = token;
        this.operator = operator;
        this.right = right;
        this.nodeType = 'expression';
    }
    toString() {
        return `(${this.operator}${this.right ? this.right.toString() : ''})`;
    }
}
exports.PrefixExpression = PrefixExpression;
/**
 * AST node type representing a binary operator expression like `1 + 2`.
 *
 * @public
 */
class InfixExpression {
    constructor(token, left, operator, right) {
        this.token = token;
        this.left = left;
        this.operator = operator;
        this.right = right;
        this.nodeType = 'expression';
    }
    toString() {
        return `(${this.left ? this.left.toString() : ''} ${this.operator} ${this.right ? this.right.toString() : ''})`;
    }
}
exports.InfixExpression = InfixExpression;
/**
 * AST node type representing an `if` or (`if`/`else`) conditional expression.
 *
 * @public
 */
class IfExpression {
    constructor(token, condition, consequence, alternative) {
        this.token = token;
        this.condition = condition;
        this.consequence = consequence;
        this.alternative = alternative;
        this.nodeType = 'expression';
    }
    toString() {
        let str = `if (${this.condition.toString()}) ${this.consequence.toString()}`;
        if (this.alternative) {
            str += ` else ${this.alternative.toString()}`;
        }
        return str;
    }
}
exports.IfExpression = IfExpression;
/**
 * AST node type representing a function literal (`fn(...params) { ... }`).
 *
 * @public
 */
class FunctionLiteral {
    constructor(token, parameters, body, name) {
        this.token = token;
        this.parameters = parameters;
        this.body = body;
        this.name = name;
        this.nodeType = 'expression';
    }
    toString() {
        const params = this.parameters
            .map((p) => p.toString())
            .join(', ');
        return `${this.name || '<anonymous fn>'}(${params}) ${this.body.toString()}`;
    }
}
exports.FunctionLiteral = FunctionLiteral;
/**
 * AST node type representing a generator literal (`gen(...params) { ... }`).
 *
 * @public
 */
class GeneratorLiteral {
    constructor(token, parameters, body, name) {
        this.token = token;
        this.parameters = parameters;
        this.body = body;
        this.name = name;
        this.nodeType = 'expression';
    }
    toString() {
        const params = this.parameters
            .map((p) => p.toString())
            .join(', ');
        return `${this.name || '<anonymous gen>'}(${params}) ${this.body.toString()}`;
    }
}
exports.GeneratorLiteral = GeneratorLiteral;
/**
 * AST node type representing a `next` expression.
 *
 * @public
 */
class NextExpression {
    constructor(token, right) {
        this.token = token;
        this.right = right;
        this.nodeType = 'expression';
    }
    toString() {
        if (!this.right) {
            return 'next';
        }
        return `next ${this.right.toString()}`;
    }
}
exports.NextExpression = NextExpression;
/**
 * AST node type representing an array index expression like `arr[1]`.
 *
 * @public
 */
class IndexExpression {
    constructor(token, collection, index) {
        this.token = token;
        this.collection = collection;
        this.index = index;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.collection.toString()}[${this.index.toString()}]`;
    }
}
exports.IndexExpression = IndexExpression;
/**
 * AST node type representing a function or generator call expression
 * like `f(...args)`.
 *
 * @public
 */
class CallExpression {
    constructor(token, fn, args) {
        this.token = token;
        this.fn = fn;
        this.args = args;
        this.nodeType = 'expression';
    }
    toString() {
        const args = this.args.map((p) => p.toString()).join(', ');
        return `${this.fn ? this.fn.toString() : ''}(${args})`;
    }
}
exports.CallExpression = CallExpression;
/**
 * AST node type representing a MIDI note expression.
 *
 * @public
 */
class NoteExpression {
    constructor(token, note) {
        this.token = token;
        this.note = note;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.token.literal} ${this.note ? this.note.toString() : ''}`;
    }
}
exports.NoteExpression = NoteExpression;
/**
 * AST node type representing a MIDI skip expression.
 *
 * @public
 */
class SkipExpression {
    constructor(token, duration) {
        this.token = token;
        this.duration = duration;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.token.literal} ${this.duration ? this.duration.toString() : ''}`;
    }
}
exports.SkipExpression = SkipExpression;
/**
 * AST node type representing a MIDI CC message expression.
 *
 * @public
 */
class CCExpression {
    constructor(token, message) {
        this.token = token;
        this.message = message;
        this.nodeType = 'expression';
    }
    toString() {
        return `${this.token.literal} ${this.message ? this.message.toString() : ''}`;
    }
}
exports.CCExpression = CCExpression;

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_LABELS = exports.NATIVE_FN_KEYS = exports.BUILTIN_KEYS = exports.BUILTINS = exports.NATIVE_FNS = void 0;
const object_1 = require("./object");
const NULL = new object_1.Null();
/**
 * Collection of native function implementations that cannot be implemented
 * as easily with the compiled code itself.
 *
 * @internal
 */
exports.NATIVE_FNS = [
    /**
     * chord(Note, Arr, Int): Arr
     * (alternatively: chord(Int, Arr, Int): Arr)
     * Creates a chord of notes or pitches either with an existing
     * root note or root pitch value.
     */
    new object_1.NativeFn('chord', (_, ...args) => {
        const [root, chord, inversion] = args;
        let rootPitch;
        if (root instanceof object_1.MidiNote) {
            rootPitch = root.pitch;
        }
        else if (root instanceof object_1.Int) {
            rootPitch = root.value;
        }
        else {
            throw new Error('The first argument to `chord` must be an Int pitch or a MIDI note object');
        }
        if (!(chord instanceof object_1.Arr)) {
            throw new Error('Chord requires second argument to be an existing chord variable or an array of note intervals');
        }
        let inversionValue = 0;
        if (inversion) {
            if (!(inversion instanceof object_1.Int)) {
                throw new Error('Inversion must be a number');
            }
            inversionValue = inversion.value;
        }
        const len = chord.items.length;
        const inversionOcts = Math.floor(inversionValue / len);
        const intervals = chord.items.map((item, i) => {
            if (!(item instanceof object_1.Int)) {
                throw new Error('Chord requires second argument to be an existing chord variable or an array of note intervals');
            }
            return item.value + 12 * (inversionOcts + (i % len));
        });
        // while (inversionValue-- > 0) {
        //   const interval = intervals.shift();
        //   if (interval !== undefined) {
        //     intervals.push(interval + 12);
        //   }
        // }
        const items = intervals.map((interval) => {
            if (root instanceof object_1.MidiNote) {
                return new object_1.MidiNote(rootPitch + interval, root.duration, root.velocity);
            }
            return object_1.Int.from(rootPitch + interval);
        });
        return new object_1.Arr(items);
    }),
    /**
     * concat(...Arr): Arr
     * Given an arbitrary number of array arguments, returns a new
     * array containing all of the arrays' children.
     */
    new object_1.NativeFn('concat', (_, ...args) => {
        let items = [];
        args.forEach((arg) => {
            if (!(arg instanceof object_1.Arr)) {
                throw new Error('Function `concat` only accepts array arguments');
            }
            items = items.concat(arg.items);
        });
        return new object_1.Arr(items);
    }),
    /**
     * conv(Arr): VirtualSeq
     * Converts an array into a one-shot sequence.
     */
    new object_1.NativeFn('conv', (_, ...args) => {
        const arr = args[0];
        if (!(arr instanceof object_1.Arr)) {
            throw new Error('Function `conv` takes a single array argument');
        }
        const items = arr.items;
        const length = items.length;
        let index = 0;
        const seq = new object_1.VirtualSeq(() => {
            if (seq.done) {
                return NULL;
            }
            const item = items[index++];
            if (index >= length) {
                seq.done = true;
            }
            return item;
        });
        return seq;
    }),
    /**
     * cycle(Arr): VirtualSeq
     * Converts an array into a looping sequence.
     */
    new object_1.NativeFn('cycle', (_, ...args) => {
        const arr = args[0];
        if (!(arr instanceof object_1.Arr)) {
            throw new Error('Function `cycle` takes a single array argument');
        }
        const items = arr.items;
        const length = items.length;
        let index = 0;
        const seq = new object_1.VirtualSeq(() => {
            const item = items[index++];
            if (index >= length) {
                index = 0;
            }
            return item;
        });
        return seq;
    }),
    /**
     * dur(Note): Int
     * Given a MIDI note object, returns its duration.
     */
    new object_1.NativeFn('dur', (_, ...args) => {
        const note = args[0];
        if (args.length !== 1 || !(note instanceof object_1.MidiNote)) {
            throw new Error('Function `dur` takes a single MIDI note argument');
        }
        return object_1.Int.from(note.duration);
    }),
    /**
     * filter(Arr, Fn): Arr
     * Given an array and a function, returns a new array containing
     * only the elements that return truthy when provided to the function.
     */
    new object_1.NativeFn('filter', (vm, ...args) => {
        const [arr, fn] = args;
        if (args.length !== 2 ||
            !(arr instanceof object_1.Arr) ||
            !(fn instanceof object_1.Closure || fn instanceof object_1.NativeFn)) {
            throw new Error('Function `filter` requires an array and a function');
        }
        const items = arr.items.filter((item, i) => {
            const res = vm.callAndReturn(fn, [item, object_1.Int.from(i)]);
            return object_1.isTruthy(res);
        });
        return new object_1.Arr(items);
    }),
    /**
     * len(Arr): Int
     * Returns the length of a Melee array object.
     */
    new object_1.NativeFn('len', (_, ...args) => {
        const arr = args[0];
        if (!(arr instanceof object_1.Arr)) {
            throw new Error('Function `len` takes a single array argument');
        }
        return object_1.Int.from(arr.items.length);
    }),
    /**
     * map(Arr, Fn): Arr
     * Given an array and a function, performs the function on each
     * array element and returns an array containing the return values
     * of each.
     */
    new object_1.NativeFn('map', (vm, ...args) => {
        const [arr, fn] = args;
        if (args.length !== 2 ||
            !(arr instanceof object_1.Arr) ||
            !(fn instanceof object_1.Closure || fn instanceof object_1.NativeFn)) {
            throw new Error('Function `map` takes an array and a function to transform each element');
        }
        const items = arr.items.map((item, i) => vm.callAndReturn(fn, [item, object_1.Int.from(i)]));
        return new object_1.Arr(items);
    }),
    /**
     * max(Arr): Int | Null
     * Given an array of integers, returns the largest integer value.
     */
    new object_1.NativeFn('max', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `max` takes a single array argument');
        }
        const items = [];
        for (let i = 0; i < arr.items.length; i++) {
            const item = arr.items[i];
            if (item instanceof object_1.Int) {
                items.push(item.value);
            }
        }
        if (!items.length) {
            return NULL;
        }
        return object_1.Int.from(Math.max.apply(null, items));
    }),
    /**
     * merge(...Seq): Seq
     * Given a variable length list of sequences, returns a new sequence
     * that returns an array of next values for each one.
     */
    new object_1.NativeFn('merge', (vm, ...args) => {
        const seqs = [];
        args.forEach((arg) => {
            if (!(arg instanceof object_1.Iterable)) {
                throw new Error('Function `merge` takes a flexible number of sequence objects');
            }
            seqs.push(arg);
        });
        const seq = new object_1.VirtualSeq(() => {
            const output = new Array(seqs.length);
            seqs.forEach((seq, i) => {
                output[i] = vm.takeNext(seq);
            });
            return new object_1.Arr(output);
        });
        return seq;
    }),
    /**
     * min(Arr): Int | Null
     * Given an array of integers, returns the smallest integer value.
     */
    new object_1.NativeFn('min', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `min` takes a single array argument');
        }
        const items = [];
        for (let i = 0; i < arr.items.length; i++) {
            const item = arr.items[i];
            if (item instanceof object_1.Int) {
                items.push(item.value);
            }
        }
        if (!items.length) {
            return NULL;
        }
        return object_1.Int.from(Math.min.apply(null, items));
    }),
    /**
     * pitch(Note): Int
     * Given a MIDI note object, returns its pitch.
     */
    new object_1.NativeFn('pitch', (_, ...args) => {
        const note = args[0];
        if (args.length !== 1 || !(note instanceof object_1.MidiNote)) {
            throw new Error('Function `pitch` takes a single MIDI note argument');
        }
        return object_1.Int.from(note.pitch);
    }),
    /**
     * poly(...Seq): Seq
     * Polyphony helper to process multiple sequences of notes and
     * chords at the same time.
     */
    new object_1.NativeFn('poly', (vm, ...args) => {
        const seqs = [];
        args.forEach((arg) => {
            if (!(arg instanceof object_1.Iterable)) {
                throw new Error('Function `poly` takes a flexible number of sequence objects');
            }
            seqs.push(arg);
        });
        const durations = [];
        for (let i = 0; i < seqs.length; i++)
            durations[i] = -1;
        const pitches = [];
        for (let i = 0; i < seqs.length; i++)
            pitches[i] = -1;
        const seq = new object_1.VirtualSeq(() => {
            const output = new Array(seqs.length);
            seqs.forEach((seq, i) => {
                if (durations[i] > 0) {
                    output[i] = object_1.provisionHold(pitches[i], durations[i]);
                }
                else {
                    const note = vm.takeNext(seq);
                    if (note instanceof object_1.MidiNote) {
                        durations[i] = note.duration;
                        pitches[i] = note.pitch;
                    }
                    else if (note instanceof object_1.Arr) {
                        let minDuration = -1;
                        let pitch = -1;
                        for (let j = 0; j < note.items.length; j++) {
                            const item = note.items[j];
                            if (!(item instanceof object_1.MidiNote)) {
                                throw new Error('`poly` sequences must yield MIDI notes or chords');
                            }
                            if (minDuration < 0) {
                                minDuration = item.duration;
                            }
                            else {
                                minDuration = Math.min(minDuration, item.duration);
                            }
                            pitch = item.pitch;
                        }
                        durations[i] = minDuration;
                        pitches[i] = pitch;
                    }
                    else {
                        throw new Error('`poly` sequences must yield MIDI notes or chords');
                    }
                    output[i] = note;
                }
            });
            const min = Math.min(...durations.filter((d) => d > 0));
            for (let i = 0; i < seqs.length; i++) {
                durations[i] = Math.max(0, durations[i] - min);
                const hold = output[i];
                if (hold instanceof object_1.Hold) {
                    hold.duration = min;
                }
            }
            const flattenedNotes = output.reduce((acc, cur) => {
                if (cur instanceof object_1.Arr) {
                    return [...acc, ...cur.items];
                }
                return [...acc, cur];
            }, []);
            return new object_1.Arr(flattenedNotes);
        });
        return seq;
    }),
    /**
     * pop(Arr): *
     * Pops an item off of the end of an array.
     */
    new object_1.NativeFn('pop', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `pop` takes a single array argument');
        }
        return arr.items.pop() || NULL;
    }),
    /**
     * print(...*): Null
     * Prints the provided arguments to the console.
     */
    new object_1.NativeFn('print', (vm, ...args) => {
        if (vm.callbacks && vm.callbacks.print) {
            vm.callbacks.print(...args);
        }
        return NULL;
    }),
    /**
     * push(Arr, *): Arr
     * Pushes an arbitrary item onto the end of an array.
     */
    new object_1.NativeFn('push', (_, ...args) => {
        const arr = args[0];
        const next = args[1] || NULL;
        if (args.length !== 2 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `push` takes an array and an item to push');
        }
        arr.items.push(next);
        return arr;
    }),
    /**
     * quant(Arr, Int | Note, Int | Note): Int | Note
     * Given a scale, a root note, and an input note, calculates and
     * returns the next closest note that fits the scale.
     */
    new object_1.NativeFn('quant', (_, ...args) => {
        const [scale, root, note] = args;
        if (!(scale instanceof object_1.Arr) ||
            !scale.items.every((item) => item instanceof object_1.Int)) {
            throw new Error('Function `quant` requires the first argument to be an array of integers');
        }
        let rootPitch;
        if (root instanceof object_1.Int) {
            rootPitch = root.value;
        }
        else if (root instanceof object_1.MidiNote) {
            rootPitch = root.pitch;
        }
        else {
            throw new Error('Function `quant` requires a scale array, a root note or pitch, and a note or pitch to quantize');
        }
        let notePitch;
        if (note instanceof object_1.Int) {
            notePitch = note.value;
        }
        else if (note instanceof object_1.MidiNote) {
            notePitch = note.pitch;
        }
        else {
            throw new Error('Function `quant` requires a scale array, a root note or pitch, and a note or pitch to quantize');
        }
        let base = notePitch - rootPitch;
        const octave = Math.floor(base / 12);
        while (base < 0) {
            base += 12;
        }
        base %= 12;
        let quantized = 12;
        for (let i = 0; i < scale.items.length; i++) {
            const item = scale.items[i];
            if (item.value >= base) {
                quantized = item.value;
                break;
            }
        }
        quantized += rootPitch + octave * 12;
        if (note instanceof object_1.MidiNote) {
            return new object_1.MidiNote(quantized, note.duration, note.velocity);
        }
        return object_1.Int.from(quantized);
    }),
    /**
     * rand(Int): Int
     * Given number `n`, returns a random number between `0` and `n - 1`.
     */
    new object_1.NativeFn('rand', (_, ...args) => {
        const hi = args[0];
        if (args.length !== 1 || !(hi instanceof object_1.Int)) {
            throw new Error('Function `rand(num)` takes a single integer argument, which returns a number from 0 up to, but not including, num');
        }
        return object_1.Int.from(Math.floor(Math.random() * hi.value));
    }),
    /**
     * range(Int): Arr
     * Given an integer `n`, returns a Melee array object containing
     * integers `0` through `n - 1`.
     */
    new object_1.NativeFn('range', (_, ...args) => {
        const num = args[0];
        if (args.length !== 1 || !(num instanceof object_1.Int)) {
            throw new Error('Function `range` takes a single integer argument');
        }
        if (num.value < 1) {
            throw new Error('Function `range(num)` requires num to be at least 1');
        }
        const items = [];
        for (let i = 0; i < num.value; i++) {
            items.push(object_1.Int.from(i));
        }
        return new object_1.Arr(items);
    }),
    /**
     * rev(Arr): Arr
     * Given an array, returns a new array with the items in reverse order.
     */
    new object_1.NativeFn('rev', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `rev` takes a single array argument');
        }
        const items = [];
        for (let i = 0; i < arr.items.length; i++) {
            items.push(arr.items[arr.items.length - 1 - i]);
        }
        return new object_1.Arr(items);
    }),
    /**
     * rrand(Int, Int): Int
     * Given numbers `lo` and `hi`, returns a random number between `lo`
     * and `hi - 1`.
     */
    new object_1.NativeFn('rrand', (_, ...args) => {
        const lo = args[0];
        const hi = args[1];
        if (args.length !== 2 ||
            !(hi instanceof object_1.Int) ||
            !(lo instanceof object_1.Int)) {
            throw new Error('Function `rrand(lo, hi)` takes a two integer arguments, returning a random number from lo up to, but not including, hi');
        }
        const x = Math.min(lo.value, hi.value);
        const y = Math.max(lo.value, hi.value);
        return object_1.Int.from(x + Math.floor(Math.random() * (y - x)));
    }),
    /**
     * scale(Arr, Int | Note, Int): Int | Note
     * Given a scale, a root note, and an interval, calculates and returns
     * the pitch value at that interval.
     */
    new object_1.NativeFn('scale', (_, ...args) => {
        const [scale, root, interval] = args;
        if (!(scale instanceof object_1.Arr) ||
            !scale.items.every((item) => item instanceof object_1.Int)) {
            throw new Error('Function `scale` requires the first argument to be an array of integers');
        }
        let rootPitch;
        if (root instanceof object_1.Int) {
            rootPitch = root.value;
        }
        else if (root instanceof object_1.MidiNote) {
            rootPitch = root.pitch;
        }
        else {
            throw new Error('Function `scale` requires a scale array, a root note or pitch, and an integer interval');
        }
        if (!(interval instanceof object_1.Int)) {
            throw new Error('Function `scale` requires a scale array, a root note or pitch, and an integer interval');
        }
        let base = interval.value;
        while (base < 0) {
            base += scale.items.length;
        }
        const offset = scale.items[base % scale.items.length];
        const octave = Math.floor(interval.value / scale.items.length);
        const pitch = rootPitch + octave * 12 + offset.value;
        if (root instanceof object_1.MidiNote) {
            return new object_1.MidiNote(pitch, root.duration, root.velocity);
        }
        return object_1.Int.from(pitch);
    }),
    /**
     * shift(Arr): *
     * Shifts an item off of the beginning of an array.
     */
    new object_1.NativeFn('shift', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `shift` takes a single array argument');
        }
        return arr.items.shift() || NULL;
    }),
    /**
     * sort(Arr): Arr
     * Given an array, returns a new array with the values sorted.
     */
    new object_1.NativeFn('sort', (_, ...args) => {
        const arr = args[0];
        if (args.length !== 1 || !(arr instanceof object_1.Arr)) {
            throw new Error('Function `sort` takes a single array argument');
        }
        const items = arr.items.sort((a, b) => {
            let aVal = NaN;
            let bVal = NaN;
            if (a instanceof object_1.Int) {
                aVal = a.value;
            }
            else if (a instanceof object_1.Bool) {
                aVal = a.value ? 1 : 0;
            }
            if (b instanceof object_1.Int) {
                bVal = b.value;
            }
            else if (b instanceof object_1.Bool) {
                bVal = b.value ? 1 : 0;
            }
            if (isNaN(aVal) && isNaN(bVal))
                return 0;
            if (isNaN(bVal))
                return -1;
            if (isNaN(aVal))
                return 1;
            return aVal - bVal;
        });
        return new object_1.Arr(items);
    }),
    /**
     * take(Seq, Int): Arr
     * Given a sequence and an integer `n`, returns an array containing
     * the next `n` items from the sequence.
     */
    new object_1.NativeFn('take', (vm, ...args) => {
        const [seq, num] = args;
        if (args.length !== 2 ||
            !(seq instanceof object_1.Iterable) ||
            !(num instanceof object_1.Int)) {
            throw new Error('Function `take` requires a sequence object and an integer');
        }
        const items = [];
        for (let i = 0; i < num.value; i++) {
            items.push(vm.takeNext(seq) || NULL);
        }
        return new object_1.Arr(items);
    }),
    /**
     * vel(Note): Int
     * Given a MIDI note object, returns its velocity.
     */
    new object_1.NativeFn('vel', (_, ...args) => {
        const note = args[0];
        if (args.length !== 1 || !(note instanceof object_1.MidiNote)) {
            throw new Error('Function `vel` takes a single MIDI note argument');
        }
        return object_1.Int.from(note.velocity);
    }),
];
/**
 * Create a mapping of chord names to arrays of pitch intervals.
 *
 * @returns Object containing map of chord arrays by name
 *
 * @internal
 */
function createChordMap() {
    const CHORD_MAP = {
        ROOT_4: [0, 5],
        ROOT_5: [0, 7],
        ROOT_6: [0, 9],
        SUS_2: [0, 2, 7],
        SUS_4: [0, 5, 7],
        ROOT_5_ADD_9: [0, 7, 14],
        ROOT_6_ADD_9: [0, 9, 14],
        MAJ: [0, 4, 7],
        MIN: [0, 3, 7],
        MAJ_7: [0, 4, 7, 11],
        MIN_7: [0, 3, 7, 10],
        DOM_7: [0, 4, 7, 10],
        MIN_MAJ_7: [0, 3, 7, 11],
        MAJ_9: [0, 4, 7, 11, 14],
        MAJ_ADD_9: [0, 3, 7, 14],
        MIN_9: [0, 3, 7, 10, 14],
        MIN_ADD_9: [0, 3, 7, 14],
        DOM_9: [0, 4, 7, 10, 14],
        MAJ_11: [0, 4, 7, 11, 14, 17],
        MIN_11: [0, 3, 7, 10, 14, 17],
    };
    return Object.keys(CHORD_MAP).reduce((acc, cur) => ({
        ...acc,
        [cur]: new object_1.Arr(CHORD_MAP[cur].map((interval) => object_1.Int.from(interval))),
    }), {});
}
/**
 * Create a mapping of scale names to arrays of intervals.
 *
 * @returns Object containing map of scale arrays by name
 *
 * @internal
 */
function createScaleMap() {
    const SCALE_MAP = {
        SCALE_MAJOR: [0, 2, 4, 5, 7, 9, 11],
        SCALE_IONIAN: [0, 2, 4, 5, 7, 9, 11],
        SCALE_MINOR: [0, 2, 3, 5, 7, 8, 10],
        SCALE_AEOLIAN: [0, 2, 3, 5, 7, 8, 10],
        SCALE_DORIAN: [0, 2, 3, 5, 7, 9, 10],
        SCALE_PENT_MAJOR: [0, 2, 4, 7, 9],
        SCALE_PENT_MINOR: [0, 3, 5, 7, 10],
        SCALE_BLUES: [0, 3, 5, 6, 7, 10],
        SCALE_MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
        SCALE_PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
        SCALE_LYDIAN: [0, 2, 4, 6, 7, 9, 11],
        SCALE_LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
    };
    return Object.keys(SCALE_MAP).reduce((acc, cur) => ({
        ...acc,
        [cur]: new object_1.Arr(SCALE_MAP[cur].map((interval) => object_1.Int.from(interval))),
    }), {});
}
/**
 * Default global variables placed in scope on startup.
 *
 * @internal
 */
exports.BUILTINS = {
    ...createChordMap(),
    ...object_1.MIDI_VALUES,
    ...createScaleMap(),
};
exports.BUILTIN_KEYS = Object.keys(exports.BUILTINS);
exports.NATIVE_FN_KEYS = exports.NATIVE_FNS.map((fn) => fn.label);
exports.KNOWN_LABELS = [...exports.BUILTIN_KEYS, ...exports.NATIVE_FN_KEYS];

},{"./object":15}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disassemble = exports.createInstruction = exports.unpackBigEndian = exports.packBigEndian = exports.OPCODES = exports.Opcode = void 0;
/**
 * Byte value enumeration of an instruction's opcode (its first byte).
 */
var Opcode;
(function (Opcode) {
    Opcode[Opcode["CONST"] = 1] = "CONST";
    Opcode[Opcode["ARRAY"] = 2] = "ARRAY";
    Opcode[Opcode["LEN"] = 3] = "LEN";
    Opcode[Opcode["INDEX"] = 4] = "INDEX";
    Opcode[Opcode["SET_INDEX"] = 5] = "SET_INDEX";
    Opcode[Opcode["TRUE"] = 10] = "TRUE";
    Opcode[Opcode["FALSE"] = 11] = "FALSE";
    Opcode[Opcode["NULL"] = 12] = "NULL";
    Opcode[Opcode["ADD"] = 20] = "ADD";
    Opcode[Opcode["SUB"] = 21] = "SUB";
    Opcode[Opcode["MUL"] = 22] = "MUL";
    Opcode[Opcode["DIV"] = 23] = "DIV";
    Opcode[Opcode["MOD"] = 24] = "MOD";
    Opcode[Opcode["BANG"] = 30] = "BANG";
    Opcode[Opcode["MINUS"] = 31] = "MINUS";
    Opcode[Opcode["AND"] = 40] = "AND";
    Opcode[Opcode["OR"] = 41] = "OR";
    Opcode[Opcode["EQ"] = 50] = "EQ";
    Opcode[Opcode["NOT_EQ"] = 51] = "NOT_EQ";
    Opcode[Opcode["GT"] = 52] = "GT";
    Opcode[Opcode["GTE"] = 53] = "GTE";
    Opcode[Opcode["GETN"] = 60] = "GETN";
    Opcode[Opcode["SETG"] = 70] = "SETG";
    Opcode[Opcode["GETG"] = 71] = "GETG";
    Opcode[Opcode["SET"] = 80] = "SET";
    Opcode[Opcode["GET"] = 81] = "GET";
    Opcode[Opcode["CLOSURE"] = 90] = "CLOSURE";
    Opcode[Opcode["SELF"] = 91] = "SELF";
    Opcode[Opcode["GETC"] = 92] = "GETC";
    Opcode[Opcode["SETC"] = 93] = "SETC";
    Opcode[Opcode["RET"] = 100] = "RET";
    Opcode[Opcode["CALL"] = 101] = "CALL";
    Opcode[Opcode["JMP"] = 110] = "JMP";
    Opcode[Opcode["JMP_IF_NOT"] = 111] = "JMP_IF_NOT";
    Opcode[Opcode["NOTE"] = 200] = "NOTE";
    Opcode[Opcode["CC"] = 201] = "CC";
    Opcode[Opcode["SKIP"] = 202] = "SKIP";
    Opcode[Opcode["YIELD"] = 210] = "YIELD";
    Opcode[Opcode["NEXT"] = 211] = "NEXT";
    Opcode[Opcode["POP"] = 253] = "POP";
    Opcode[Opcode["NOT_IMPLEMENTED"] = 254] = "NOT_IMPLEMENTED";
    Opcode[Opcode["HALT"] = 255] = "HALT";
})(Opcode = exports.Opcode || (exports.Opcode = {}));
exports.OPCODES = {};
// Precalculate all total opcode instruction sizes.
const operations = [
    [Opcode.CONST, 'CONST', [2]],
    [Opcode.ARRAY, 'ARRAY', [2]],
    [Opcode.LEN, 'LEN'],
    [Opcode.INDEX, 'INDEX'],
    [Opcode.SET_INDEX, 'SET_INDEX'],
    [Opcode.HALT, 'HALT'],
    [Opcode.TRUE, 'TRUE'],
    [Opcode.FALSE, 'FALSE'],
    [Opcode.NULL, 'NULL'],
    [Opcode.ADD, 'ADD'],
    [Opcode.SUB, 'SUB'],
    [Opcode.MUL, 'MUL'],
    [Opcode.DIV, 'DIV'],
    [Opcode.MOD, 'MOD'],
    [Opcode.AND, 'AND'],
    [Opcode.OR, 'OR'],
    [Opcode.BANG, 'BANG'],
    [Opcode.MINUS, 'MINUS'],
    [Opcode.EQ, 'EQ'],
    [Opcode.NOT_EQ, 'NOT_EQ'],
    [Opcode.GT, 'GT'],
    [Opcode.GTE, 'GTE'],
    [Opcode.GETN, 'GETN', [1]],
    [Opcode.SETG, 'SETG', [2]],
    [Opcode.GETG, 'GETG', [2]],
    [Opcode.SET, 'SET', [1]],
    [Opcode.GET, 'GET', [1]],
    [Opcode.JMP, 'JMP', [2]],
    [Opcode.JMP_IF_NOT, 'JMP_IF_NOT', [2]],
    [Opcode.POP, 'POP'],
    [Opcode.RET, 'RET'],
    [Opcode.CALL, 'CALL', [1]],
    [Opcode.CLOSURE, 'CLOSURE', [2, 1]],
    [Opcode.SELF, 'SELF'],
    [Opcode.GETC, 'GETC', [1]],
    [Opcode.SETC, 'SETC', [1]],
    [Opcode.NOTE, 'NOTE'],
    [Opcode.CC, 'CC'],
    [Opcode.SKIP, 'SKIP'],
    [Opcode.YIELD, 'YIELD'],
    [Opcode.NEXT, 'NEXT'],
];
operations.forEach(([op, name, operands]) => {
    exports.OPCODES[op] = {
        name,
        operands,
        size: operands ? operands.reduce((acc, cur) => acc + cur, 1) : 1,
    };
});
/**
 * Packs operand value of given bytes at an offset within an instruction array.
 *
 * @param arr - Instruction bytes
 * @param offset - Bytes into instruction
 * @param size - Byte width of operand
 * @param value - Value inserted into instruction at offset
 */
function packBigEndian(arr, offset, size, value) {
    let n = value;
    while (size--) {
        arr[offset + size] = n & 255;
        n >>= 8;
    }
}
exports.packBigEndian = packBigEndian;
/**
 * Retrieves operand value of the given bytes at an offset within an
 * instruction array.
 *
 * @param arr - Instruction bytes
 * @param offset - Bytes into instruction
 * @param size - Byte width of operand
 * @returns Integer value at offset
 */
function unpackBigEndian(arr, offset, size) {
    let n = 0;
    for (let i = 0; i < size; i++) {
        n += arr[offset + i] * Math.pow(256, size - i - 1);
    }
    return n;
}
exports.unpackBigEndian = unpackBigEndian;
/**
 * Create new instruction, packing operands in big-endian byte order.
 *
 * @param op - Opcode value
 * @param args - Additional operands
 * @returns Packed instruction bytes
 */
function createInstruction(op, ...args) {
    const operation = exports.OPCODES[op];
    if (!operation) {
        return new Uint8Array(0);
    }
    const instruction = new Uint8Array(operation.size);
    instruction[0] = op;
    if (!operation.operands) {
        return instruction;
    }
    let offset = 1;
    for (let i = 0; i < operation.operands.length; i++) {
        packBigEndian(instruction, offset, operation.operands[i], args[i]);
        offset += operation.operands[i];
    }
    return instruction;
}
exports.createInstruction = createInstruction;
/**
 * Disassemble a bytecode into a more human-readable format.
 *
 * @param bytecode - Series of instruction bytes
 * @returns Stringified bytecode
 */
function disassemble(bytecode) {
    let pos = 0;
    let output = '';
    while (pos < bytecode.length) {
        const operation = exports.OPCODES[bytecode[pos]];
        const { name, operands } = operation;
        const address = `0000${pos}`.slice(-4);
        pos += 1;
        if (!operands) {
            output += `${address} ${name}\n`;
            continue;
        }
        const args = [];
        operands.forEach((width) => {
            args.push(unpackBigEndian(bytecode, pos, width).toString());
            pos += width;
        });
        output += `${address} ${name} (${args.join(', ')})\n`;
    }
    return output;
}
exports.disassemble = disassemble;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Compiler = void 0;
const ast = require("./ast");
const bytecode_1 = require("./bytecode");
const object_1 = require("./object");
const symbols_1 = require("./symbols");
const builtins_1 = require("./builtins");
const errors_1 = require("./errors");
/**
 * Compiles AST into serial bytecode instructions.
 */
class Compiler {
    constructor(
    /**
     * Constant values referenced by the VM.
     */
    constants = [], symbolTable) {
        this.constants = constants;
        this.loopStarts = [];
        this.breaks = [];
        this.scopeIndex = -1;
        this.scopes = [];
        // Create native symbol table for built-in functions and values.
        this.symbolTable = new symbols_1.SymbolTable(symbols_1.ScopeType.NATIVE);
        builtins_1.NATIVE_FNS.forEach((fn) => {
            this.symbolTable.add(fn.label);
        });
        this.pushScope(symbolTable);
    }
    /**
     * Gets the current scope. (Can't use getters in ES3.)
     *
     * @returns Current scope
     *
     * @internal
     */
    scope() {
        return this.scopes[this.scopeIndex];
    }
    /**
     * Gets the current scope's instructions. (Can't use getters in ES3.)
     *
     * @returns Instruction bytecode
     *
     * @internal
     */
    instructions() {
        return this.scopes[this.scopeIndex].instructions;
    }
    /**
     * Compiles an AST node into bytecode.
     *
     * @param node - AST node, preferrably a program node
     */
    compile(node) {
        if (node instanceof ast.Program ||
            node instanceof ast.BlockStatement) {
            for (let i = 0; i < node.statements.length; i++) {
                this.compile(node.statements[i]);
            }
        }
        else if (node instanceof ast.ExpressionStatement) {
            if (node.value) {
                this.compile(node.value);
            }
            this.emit(bytecode_1.Opcode.POP);
        }
        else if (node instanceof ast.DeclareStatement) {
            const index = this.symbolTable.add(node.name.value);
            if (node.value) {
                this.compile(node.value);
            }
            this.emit(this.symbolTable.type === symbols_1.ScopeType.GLOBAL
                ? bytecode_1.Opcode.SETG
                : bytecode_1.Opcode.SET, index);
        }
        else if (node instanceof ast.AssignExpression) {
            const name = node.name;
            if (!(name instanceof ast.Identifier)) {
                // Assignment for array expressions
                if (name instanceof ast.IndexExpression) {
                    this.compile(name.collection);
                    this.compile(name.index);
                    if (node.value) {
                        this.compile(node.value);
                    }
                    this.emit(bytecode_1.Opcode.SET_INDEX);
                    this.compile(name.collection);
                    this.compile(name.index);
                    this.emit(bytecode_1.Opcode.INDEX);
                    return;
                }
                throw new errors_1.CompilerError('Left-hand of assignment must be a variable or an array index expression', name.token);
            }
            const sym = this.symbolTable.get(name.value);
            if (!sym) {
                throw new errors_1.CompilerError(`Cannot assign undefined variable ${name.value}`, name.token);
            }
            if (node.value) {
                this.compile(node.value);
            }
            let opcode;
            let fetch;
            switch (sym.type) {
                case symbols_1.ScopeType.FREE:
                    opcode = bytecode_1.Opcode.SETC;
                    fetch = bytecode_1.Opcode.GETC;
                    break;
                case symbols_1.ScopeType.LOCAL:
                    opcode = bytecode_1.Opcode.SET;
                    fetch = bytecode_1.Opcode.GET;
                    break;
                case symbols_1.ScopeType.GLOBAL:
                    opcode = bytecode_1.Opcode.SETG;
                    fetch = bytecode_1.Opcode.GETG;
                    break;
                default:
                    throw new errors_1.CompilerError(`Cannot assign unassigned variable ${name.value}`, name.token);
            }
            this.emit(opcode, sym.index);
            this.emit(fetch, sym.index);
        }
        else if (node instanceof ast.CompoundAssignExpression) {
            const name = node.name;
            if (!(name instanceof ast.Identifier)) {
                // Assignment for array expressions
                if (name instanceof ast.IndexExpression) {
                    this.compile(name.collection);
                    this.compile(name.index);
                    this.compile(name.collection);
                    this.compile(name.index);
                    this.emit(bytecode_1.Opcode.INDEX);
                    if (node.value) {
                        this.compile(node.value);
                    }
                    switch (node.operator) {
                        case '+=':
                            this.emit(bytecode_1.Opcode.ADD);
                            break;
                        case '-=':
                            this.emit(bytecode_1.Opcode.SUB);
                            break;
                        case '*=':
                            this.emit(bytecode_1.Opcode.MUL);
                            break;
                        case '/=':
                            this.emit(bytecode_1.Opcode.DIV);
                            break;
                        case '%=':
                            this.emit(bytecode_1.Opcode.MOD);
                            break;
                    }
                    this.emit(bytecode_1.Opcode.SET_INDEX);
                    this.compile(name.collection);
                    this.compile(name.index);
                    this.emit(bytecode_1.Opcode.INDEX);
                    return;
                }
                throw new errors_1.CompilerError('Left-hand of assignment must be a variable or an array index expression', name.token);
            }
            const sym = this.symbolTable.get(name.value);
            if (!sym) {
                throw new errors_1.CompilerError(`Cannot assign undefined variable ${name.value}`, name.token);
            }
            this.compile(name);
            if (node.value) {
                this.compile(node.value);
            }
            switch (node.operator) {
                case '+=':
                    this.emit(bytecode_1.Opcode.ADD);
                    break;
                case '-=':
                    this.emit(bytecode_1.Opcode.SUB);
                    break;
                case '*=':
                    this.emit(bytecode_1.Opcode.MUL);
                    break;
                case '/=':
                    this.emit(bytecode_1.Opcode.DIV);
                    break;
                case '%=':
                    this.emit(bytecode_1.Opcode.MOD);
                    break;
            }
            let opcode;
            let fetch;
            switch (sym.type) {
                case symbols_1.ScopeType.FREE:
                    opcode = bytecode_1.Opcode.SETC;
                    fetch = bytecode_1.Opcode.GETC;
                    break;
                case symbols_1.ScopeType.LOCAL:
                    opcode = bytecode_1.Opcode.SET;
                    fetch = bytecode_1.Opcode.GET;
                    break;
                case symbols_1.ScopeType.GLOBAL:
                    opcode = bytecode_1.Opcode.SETG;
                    fetch = bytecode_1.Opcode.GETG;
                    break;
                default:
                    throw new errors_1.CompilerError(`Cannot assign unassigned variable ${name.value}`, name.token);
            }
            this.emit(opcode, sym.index);
            this.emit(fetch, sym.index);
        }
        else if (node instanceof ast.Identifier) {
            const sym = this.symbolTable.get(node.value);
            if (typeof sym === 'undefined') {
                throw new errors_1.CompilerError(`Attempting to use undefined variable ${node.value}`, node.token);
            }
            let opcode;
            switch (sym.type) {
                case symbols_1.ScopeType.FREE:
                    opcode = bytecode_1.Opcode.GETC;
                    break;
                case symbols_1.ScopeType.NATIVE:
                    opcode = bytecode_1.Opcode.GETN;
                    break;
                case symbols_1.ScopeType.GLOBAL:
                    opcode = bytecode_1.Opcode.GETG;
                    break;
                case symbols_1.ScopeType.SELF:
                    opcode = bytecode_1.Opcode.SELF;
                    break;
                default:
                    opcode = bytecode_1.Opcode.GET;
            }
            this.emit(opcode, sym.index);
        }
        else if (node instanceof ast.PrefixExpression) {
            if (node.right) {
                this.compile(node.right);
            }
            switch (node.operator) {
                case '-':
                    this.emit(bytecode_1.Opcode.MINUS);
                    break;
                case '!':
                    this.emit(bytecode_1.Opcode.BANG);
                    break;
            }
        }
        else if (node instanceof ast.InfixExpression) {
            if (node.operator === '<' || node.operator === '<=') {
                if (node.right) {
                    this.compile(node.right);
                }
                if (node.left) {
                    this.compile(node.left);
                }
                this.emit(node.operator === '<' ? bytecode_1.Opcode.GT : bytecode_1.Opcode.GTE);
                return;
            }
            if (node.left) {
                this.compile(node.left);
            }
            if (node.right) {
                this.compile(node.right);
            }
            switch (node.operator) {
                case '+':
                    this.emit(bytecode_1.Opcode.ADD);
                    break;
                case '-':
                    this.emit(bytecode_1.Opcode.SUB);
                    break;
                case '*':
                    this.emit(bytecode_1.Opcode.MUL);
                    break;
                case '/':
                    this.emit(bytecode_1.Opcode.DIV);
                    break;
                case '%':
                    this.emit(bytecode_1.Opcode.MOD);
                    break;
                case '==':
                    this.emit(bytecode_1.Opcode.EQ);
                    break;
                case '!=':
                    this.emit(bytecode_1.Opcode.NOT_EQ);
                    break;
                case '>':
                    this.emit(bytecode_1.Opcode.GT);
                    break;
                case '>=':
                    this.emit(bytecode_1.Opcode.GTE);
                    break;
                case '&&':
                    this.emit(bytecode_1.Opcode.AND);
                    break;
                case '||':
                    this.emit(bytecode_1.Opcode.OR);
                    break;
            }
        }
        else if (node instanceof ast.IfExpression) {
            this.compile(node.condition);
            // Jump to else clause (or outside of conditional statement if else doesn't exist).
            const jumpToElse = this.emit(bytecode_1.Opcode.JMP_IF_NOT, 0xffff);
            this.compile(node.consequence);
            this.removeInstructionIf(bytecode_1.Opcode.POP);
            const jumpOut = this.emit(bytecode_1.Opcode.JMP, 0xffff);
            this.replaceInstruction(jumpToElse, this.instructions().length);
            if (node.alternative) {
                this.compile(node.alternative);
                this.removeInstructionIf(bytecode_1.Opcode.POP);
            }
            else {
                this.emit(bytecode_1.Opcode.NULL);
            }
            this.replaceInstruction(jumpOut, this.instructions().length);
        }
        else if (node instanceof ast.IntegerLiteral) {
            // TODO: Why use constants for MIDI Ints, could we just bake them
            // into the bytecode instead?
            const o = object_1.Int.from(node.value);
            this.emit(bytecode_1.Opcode.CONST, this.addConstant(o));
        }
        else if (node instanceof ast.BooleanLiteral) {
            this.emit(node.value ? bytecode_1.Opcode.TRUE : bytecode_1.Opcode.FALSE);
        }
        else if (node instanceof ast.ArrayLiteral) {
            node.values.forEach(this.compile.bind(this));
            this.emit(bytecode_1.Opcode.ARRAY, node.values.length);
        }
        else if (node instanceof ast.IndexExpression) {
            this.compile(node.collection);
            this.compile(node.index);
            this.emit(bytecode_1.Opcode.INDEX);
        }
        else if (node instanceof ast.FunctionLiteral ||
            node instanceof ast.GeneratorLiteral) {
            this.pushScope();
            if (node.name) {
                this.symbolTable.setSelf(node.name);
            }
            node.parameters.forEach((param) => {
                this.symbolTable.add(param.value);
            });
            this.compile(node.body);
            const { freeSymbols, numSymbols } = this.symbolTable;
            if (this.scope().lastInstruction.opcode !== bytecode_1.Opcode.RET) {
                this.emit(bytecode_1.Opcode.NULL);
                this.emit(bytecode_1.Opcode.RET);
            }
            const instructions = this.popScope();
            if (!instructions) {
                throw new errors_1.CompilerError('Error compiling function', node.token);
            }
            freeSymbols.forEach((sym) => {
                let opcode;
                switch (sym.type) {
                    case symbols_1.ScopeType.FREE:
                        opcode = bytecode_1.Opcode.GETC;
                        break;
                    case symbols_1.ScopeType.NATIVE:
                        opcode = bytecode_1.Opcode.GETN;
                        break;
                    case symbols_1.ScopeType.GLOBAL:
                        opcode = bytecode_1.Opcode.GETG;
                        break;
                    case symbols_1.ScopeType.SELF:
                        opcode = bytecode_1.Opcode.SELF;
                        break;
                    default:
                        opcode = bytecode_1.Opcode.GET;
                }
                this.emit(opcode, sym.index);
            });
            const repr = node.toString();
            const CallableConstructor = node instanceof ast.FunctionLiteral ? object_1.Fn : object_1.Gen;
            const fn = new CallableConstructor(instructions, repr, numSymbols, node.parameters.length);
            this.emit(bytecode_1.Opcode.CLOSURE, this.addConstant(fn), freeSymbols.length);
        }
        else if (node instanceof ast.YieldStatement) {
            if (!node.value) {
                this.emit(bytecode_1.Opcode.NULL);
            }
            else {
                this.compile(node.value);
            }
            this.emit(bytecode_1.Opcode.YIELD);
        }
        else if (node instanceof ast.NextExpression) {
            if (!node.right) {
                throw new errors_1.CompilerError('Cannot use the `next` keyword without an operand', node.token);
            }
            else {
                this.compile(node.right);
            }
            this.emit(bytecode_1.Opcode.NEXT);
        }
        else if (node instanceof ast.CallExpression) {
            if (!node.fn) {
                throw new errors_1.CompilerError('Invalid call expression', node.token);
            }
            this.compile(node.fn);
            node.args.forEach(this.compile.bind(this));
            this.emit(bytecode_1.Opcode.CALL, node.args.length);
        }
        else if (node instanceof ast.ReturnStatement) {
            if (node.value) {
                this.compile(node.value);
            }
            else {
                this.emit(bytecode_1.Opcode.NULL);
            }
            this.emit(bytecode_1.Opcode.RET);
        }
        else if (node instanceof ast.ForStatement) {
            const identifier = this.symbolTable.add(node.identifier.value);
            const setter = this.symbolTable.type === symbols_1.ScopeType.GLOBAL
                ? bytecode_1.Opcode.SETG
                : bytecode_1.Opcode.SET;
            const getter = this.symbolTable.type === symbols_1.ScopeType.GLOBAL
                ? bytecode_1.Opcode.GETG
                : bytecode_1.Opcode.GET;
            const counter = this.symbolTable.addIota();
            const collection = this.symbolTable.addIota();
            const incr = this.addConstant(object_1.Int.from(1));
            // Set counter
            this.emit(bytecode_1.Opcode.CONST, this.addConstant(object_1.Int.from(0)));
            this.emit(setter, counter);
            // Save collection
            this.compile(node.collection);
            this.emit(setter, collection);
            this.loopStarts.push(this.instructions().length);
            this.breaks.push([]);
            // Check if iterator has gone past the end of the arra
            this.emit(getter, collection);
            this.emit(bytecode_1.Opcode.LEN);
            this.emit(getter, counter);
            this.emit(bytecode_1.Opcode.GT);
            const jumpOut = this.emit(bytecode_1.Opcode.JMP_IF_NOT, 0xffff);
            // Set the current array item in the local variable
            this.emit(getter, collection);
            this.emit(getter, counter);
            this.emit(bytecode_1.Opcode.INDEX);
            this.emit(setter, identifier);
            // Increment the iterator
            this.emit(getter, counter);
            this.emit(bytecode_1.Opcode.CONST, incr);
            this.emit(bytecode_1.Opcode.ADD);
            this.emit(setter, counter);
            // Compile code block and loop
            this.compile(node.block);
            this.emit(bytecode_1.Opcode.JMP, this.loopStarts[this.loopStarts.length - 1]);
            this.replaceInstruction(jumpOut, this.instructions().length);
            while (this.breaks[this.breaks.length - 1].length) {
                const brk = this.breaks[this.breaks.length - 1].pop();
                if (brk) {
                    this.replaceInstruction(brk, this.instructions().length);
                }
            }
            this.breaks.pop();
            this.loopStarts.pop();
        }
        else if (node instanceof ast.WhileStatement) {
            this.loopStarts.push(this.instructions().length);
            this.breaks.push([]);
            this.compile(node.condition);
            const jumpToElse = this.emit(bytecode_1.Opcode.JMP_IF_NOT, 0xffff);
            this.compile(node.block);
            this.emit(bytecode_1.Opcode.JMP, this.loopStarts[this.loopStarts.length - 1]);
            this.replaceInstruction(jumpToElse, this.instructions().length);
            while (this.breaks[this.breaks.length - 1].length) {
                const brk = this.breaks[this.breaks.length - 1].pop();
                if (brk) {
                    this.replaceInstruction(brk, this.instructions().length);
                }
            }
            this.breaks.pop();
            this.loopStarts.pop();
        }
        else if (node instanceof ast.BreakStatement) {
            this.breaks[this.breaks.length - 1].push(this.emit(bytecode_1.Opcode.JMP, 0xffff));
        }
        else if (node instanceof ast.ContinueStatement) {
            if (!this.loopStarts.length) {
                throw new errors_1.CompilerError('Cannot use continue outside of a loop', node.token);
            }
            this.emit(bytecode_1.Opcode.JMP, this.loopStarts[this.loopStarts.length - 1]);
        }
        else if (node instanceof ast.NoteExpression) {
            if (!node.note) {
                throw new errors_1.CompilerError('Cannot use the `note` keyword without an operand', node.token);
            }
            this.compile(node.note);
            this.emit(bytecode_1.Opcode.NOTE);
        }
        else if (node instanceof ast.SkipExpression) {
            if (node.duration) {
                this.compile(node.duration);
            }
            else {
                this.emit(bytecode_1.Opcode.CONST, this.addConstant(object_1.Int.from(1)));
            }
            this.emit(bytecode_1.Opcode.SKIP);
        }
        else if (node instanceof ast.CCExpression) {
            if (!node.message) {
                throw new errors_1.CompilerError('Cannot use the `cc` keyword without an operand', node.token);
            }
            this.compile(node.message);
            this.emit(bytecode_1.Opcode.CC);
        }
    }
    /**
     * Add a new scope item onto the stack.
     *
     * @param symbolTable - Optional symbol table
     *
     * @internal
     */
    pushScope(symbolTable) {
        this.scopeIndex++;
        this.scopes.push({
            instructions: new Uint8Array(0),
            lastInstruction: {
                opcode: bytecode_1.Opcode.NOT_IMPLEMENTED,
                position: -1,
            },
            previousInstruction: {
                opcode: bytecode_1.Opcode.NOT_IMPLEMENTED,
                position: -1,
            },
        });
        if (symbolTable) {
            symbolTable.parent = this.symbolTable;
            this.symbolTable = symbolTable;
        }
        else if (this.symbolTable.type === symbols_1.ScopeType.NATIVE) {
            const globals = symbols_1.SymbolTable.createGlobalSymbolTable();
            globals.parent = this.symbolTable;
            this.symbolTable = globals;
        }
        else {
            this.symbolTable = new symbols_1.SymbolTable(symbols_1.ScopeType.LOCAL, this.symbolTable);
        }
    }
    /**
     * Remove the topmost scope object and return its instructions.
     *
     * @returns Instructions from popped scope
     *
     * @internal
     */
    popScope() {
        var _a;
        if (!this.scopeIndex || !this.symbolTable.parent) {
            return;
        }
        this.symbolTable = this.symbolTable.parent;
        this.scopeIndex--;
        return (_a = this.scopes.pop()) === null || _a === void 0 ? void 0 : _a.instructions;
    }
    /**
     * Keeps track of a program constant and return a reference.
     *
     * @param obj - Constant value
     * @returns Index into constant array
     *
     * @internal
     */
    addConstant(obj) {
        this.constants.push(obj);
        return this.constants.length - 1;
    }
    /**
     * Removes the last instruction from the bytecode.
     *
     * @internal
     */
    removeInstruction() {
        const position = this.scope().lastInstruction.position;
        this.scope().lastInstruction.opcode =
            this.scope().previousInstruction.opcode;
        this.scope().lastInstruction.position =
            this.scope().previousInstruction.position;
        const temp = new Uint8Array(position);
        temp.set(this.instructions().slice(0, position));
        this.scope().instructions = temp;
    }
    /**
     * Removes the last instruction from the bytecode if it matches
     * the supplied opcode.
     *
     * @param op - Opcode
     *
     * @internal
     */
    removeInstructionIf(op) {
        if (this.scope().lastInstruction.opcode === op) {
            this.removeInstruction();
        }
    }
    /**
     * Replaces an instruction in the program's bytecode.
     *
     * @param position - Bytecode index of instruction to replace
     * @param operands - Operator arguments
     *
     * @internal
     */
    replaceInstruction(position, ...operands) {
        const op = this.instructions()[position];
        this.instructions().set(bytecode_1.createInstruction(op, ...operands), position);
    }
    /**
     * Add an instruction to the program's bytecode.
     *
     * @param op - Opcode
     * @param operands - Operator arguments
     * @returns Position of new bytecode instruction
     *
     * @internal
     */
    emit(op, ...operands) {
        const instruction = bytecode_1.createInstruction(op, ...operands);
        const position = this.instructions().length;
        const temp = new Uint8Array(position + instruction.length);
        temp.set(this.instructions());
        temp.set(instruction, position);
        this.scope().instructions = temp;
        this.scope().previousInstruction.opcode =
            this.scope().lastInstruction.opcode;
        this.scope().previousInstruction.position =
            this.scope().lastInstruction.position;
        this.scope().lastInstruction.opcode = op;
        this.scope().lastInstruction.position = position;
        return position;
    }
}
exports.Compiler = Compiler;

},{"./ast":8,"./builtins":9,"./bytecode":10,"./errors":12,"./object":15,"./symbols":19}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeError = exports.CompilerError = exports.SynError = exports.MeleeError = void 0;
/**
 * Base language error class.
 */
class MeleeError extends Error {
    constructor(message, line, column, length) {
        super(message);
        this.line = line;
        this.column = column;
        this.length = length;
        this.name = 'MeleeError';
    }
}
exports.MeleeError = MeleeError;
/**
 * Error representing invalid syntax, tokens, and characters.
 */
class SynError extends MeleeError {
    constructor(message, token) {
        const { line, column, literal } = token;
        super(message, line, column, literal.length);
        this.name = 'SynError';
    }
}
exports.SynError = SynError;
/**
 * Error representing compilation issues.
 */
class CompilerError extends MeleeError {
    constructor(message, token) {
        const { line, column, literal } = token;
        super(message, line, column, literal.length);
        this.name = 'CompilerError';
    }
}
exports.CompilerError = CompilerError;
/**
 * Errors occurring during runtime VM execution.
 */
class RuntimeError extends MeleeError {
    constructor(message, line, column, length) {
        super(message, line, column, length);
        this.line = line;
        this.column = column;
        this.length = length;
        this.name = 'RuntimeError';
    }
}
exports.RuntimeError = RuntimeError;

},{}],13:[function(require,module,exports){
"use strict";
/**
 * Melee.js
 *
 * A reference implementation of the Melee programming language.
 *
 * Copyright(c) 2021 Kyle Edwards <edwards.kyle.a@gmail.com>
 * Released under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.obj = exports.errors = exports.ast = exports.KNOWN_LABELS = exports.disassemble = exports.Runtime = exports.Repl = exports.tokenIs = exports.VM = exports.Compiler = exports.Parser = exports.Lexer = void 0;
/**
 * Abstract syntax tree mechanisms and node types.
 */
const ast = require("./ast");
exports.ast = ast;
/**
 * Melee error types.
 */
const errors = require("./errors");
exports.errors = errors;
/**
 * Melee object types.
 */
const obj = require("./object");
exports.obj = obj;
var lexer_1 = require("./lexer");
Object.defineProperty(exports, "Lexer", { enumerable: true, get: function () { return lexer_1.Lexer; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "Parser", { enumerable: true, get: function () { return parser_1.Parser; } });
var compiler_1 = require("./compiler");
Object.defineProperty(exports, "Compiler", { enumerable: true, get: function () { return compiler_1.Compiler; } });
var vm_1 = require("./vm");
Object.defineProperty(exports, "VM", { enumerable: true, get: function () { return vm_1.VM; } });
var token_1 = require("./token");
Object.defineProperty(exports, "tokenIs", { enumerable: true, get: function () { return token_1.tokenIs; } });
var repl_1 = require("./repl");
Object.defineProperty(exports, "Repl", { enumerable: true, get: function () { return repl_1.Repl; } });
var runtime_1 = require("./runtime");
Object.defineProperty(exports, "Runtime", { enumerable: true, get: function () { return runtime_1.Runtime; } });
var bytecode_1 = require("./bytecode");
Object.defineProperty(exports, "disassemble", { enumerable: true, get: function () { return bytecode_1.disassemble; } });
var builtins_1 = require("./builtins");
Object.defineProperty(exports, "KNOWN_LABELS", { enumerable: true, get: function () { return builtins_1.KNOWN_LABELS; } });

},{"./ast":8,"./builtins":9,"./bytecode":10,"./compiler":11,"./errors":12,"./lexer":14,"./object":15,"./parser":16,"./repl":17,"./runtime":18,"./token":20,"./vm":22}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const token_1 = require("./token");
/**
 * Returns if the provided character is alphabetic.
 *
 * @internal
 * @param char - Character
 * @returns True if alphabetic
 */
function isAlpha(char) {
    return (('a' <= char && char <= 'z') ||
        ('A' <= char && char <= 'Z') ||
        char === '_');
}
/**
 * Returns if the provided character is numeric.
 *
 * @internal
 * @param char - Character
 * @returns True if numeric
 */
function isNumeric(char) {
    return '0' <= char && char <= '9';
}
/**
 * Returns if the provided character is alphanumeric.
 *
 * @internal
 * @param char - Character
 * @returns True if alphanumeric
 */
function isAlphaNumeric(char) {
    return isAlpha(char) || isNumeric(char) || char === '#';
}
/**
 * Lexer class to create tokens from code string.
 */
class Lexer {
    /**
     * Constructs a new lexer object.
     *
     * @param input - Code string
     */
    constructor(
    /**
     * Code snippet to be lexed.
     */
    input) {
        this.input = input;
        this.position = 0;
        this.readPosition = 0;
        this.line = 0;
        this.column = 0;
        this.lastLineLength = 0;
        this.char = '';
        this.readChar();
    }
    /**
     * Reads a character and advances the lexer's position.
     *
     * @internal
     */
    readChar() {
        if (this.readPosition >= this.input.length) {
            this.char = '';
        }
        else {
            this.char = this.input[this.readPosition];
        }
        if (this.char === '\n') {
            this.lastLineLength = this.column;
            this.line++;
            this.column = 0;
        }
        else {
            this.column++;
        }
        this.position = this.readPosition;
        this.readPosition++;
    }
    /**
     * Returns the next character if possible without advancing
     * the lexer's position.
     *
     * @internal
     */
    peekChar() {
        if (this.readPosition >= this.input.length) {
            return '';
        }
        return this.input[this.readPosition];
    }
    /**
     * Skips whitespace characters until a non-whitespace character
     * is reached.
     *
     * @internal
     */
    skipWhitespace() {
        while (this.char !== '' && ' \t\n\r'.indexOf(this.char) !== -1) {
            this.readChar();
        }
    }
    /**
     * Attempts to read a numeral from the input text.
     *
     * @internal
     * @returns Numeral string
     */
    readIdentifier() {
        const start = this.position;
        if (isAlpha(this.char)) {
            this.readChar();
        }
        else {
            return '';
        }
        while (isAlphaNumeric(this.char)) {
            this.readChar();
        }
        return this.input.slice(start, this.position);
    }
    /**
     * Attempts to read a numeral from the input text.
     *
     * @returns Numeral string
     */
    readNumber() {
        const start = this.position;
        while (isNumeric(this.char)) {
            this.readChar();
        }
        return this.input.slice(start, this.position);
    }
    /**
     * Creates a new token with the current cursor position.
     *
     * @returns New token
     */
    createToken(tokenType, literal, colOffset = 0) {
        let column = this.column - literal.length - colOffset;
        let { line } = this;
        if (column < 0) {
            column = this.lastLineLength - literal.length;
            line--;
        }
        return {
            tokenType,
            literal,
            line,
            column,
        };
    }
    /**
     * Iterates over characters until it can determine the next
     * valid token.
     *
     * @public
     * @returns Next token
     */
    nextToken() {
        let token = this.createToken('illegal', this.char);
        this.skipWhitespace();
        switch (this.char) {
            case '=':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('eq', '==');
                }
                else {
                    token = this.createToken('assign', this.char);
                }
                break;
            case ';':
                token = this.createToken('semicolon', this.char);
                break;
            case ':':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('declare', ':=');
                }
                else {
                    token = this.createToken('colon', this.char);
                }
                break;
            case '(':
                token = this.createToken('lparen', this.char);
                break;
            case ')':
                token = this.createToken('rparen', this.char);
                break;
            case '{':
                token = this.createToken('lbrace', this.char);
                break;
            case '}':
                token = this.createToken('rbrace', this.char);
                break;
            case '[':
                token = this.createToken('lbracket', this.char);
                break;
            case ']':
                token = this.createToken('rbracket', this.char);
                break;
            case ',':
                token = this.createToken('comma', this.char);
                break;
            case '+':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('pluseq', '+=');
                }
                else {
                    token = this.createToken('plus', this.char);
                }
                break;
            case '-':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('minuseq', '-=');
                }
                else {
                    token = this.createToken('minus', this.char);
                }
                break;
            case '*':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('asteriskeq', '*=');
                }
                else {
                    token = this.createToken('asterisk', this.char);
                }
                break;
            case '/':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('rslasheq', '/=');
                }
                else if (this.peekChar() == '/') {
                    this.readChar();
                    let literal = '//';
                    while (this.peekChar() != '\n' && this.peekChar() != '') {
                        this.readChar();
                        literal += this.char;
                    }
                    token = this.createToken('comment', literal);
                }
                else {
                    token = this.createToken('rslash', this.char);
                }
                break;
            case '%':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('percenteq', '%=');
                }
                else {
                    token = this.createToken('percent', this.char);
                }
                break;
            case '!':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('noteq', '!=');
                }
                else {
                    token = this.createToken('bang', this.char);
                }
                break;
            case '&':
                if (this.peekChar() == '&') {
                    this.readChar();
                    token = this.createToken('and', '&&');
                }
                break;
            case '|':
                if (this.peekChar() == '|') {
                    this.readChar();
                    token = this.createToken('or', '||');
                }
                break;
            case '>':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('gte', '>=');
                }
                else {
                    token = this.createToken('gt', this.char);
                }
                break;
            case '<':
                if (this.peekChar() == '=') {
                    this.readChar();
                    token = this.createToken('lte', '<=');
                }
                else {
                    token = this.createToken('lt', this.char);
                }
                break;
            case '':
                token = this.createToken('eof', '');
                break;
            default:
                if (isAlpha(this.char)) {
                    const literal = this.readIdentifier();
                    return this.createToken(token_1.lookupIdentifier(literal), literal, 1);
                }
                if (isNumeric(this.char)) {
                    return this.createToken('int', this.readNumber(), 1);
                }
        }
        this.readChar();
        return token;
    }
}
exports.Lexer = Lexer;

},{"./token":20}],15:[function(require,module,exports){
"use strict";
/**
 * Melee object types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionHold = exports.provisionMidiNote = exports.NOTES = exports.MIDI_VALUES = exports.isTruthy = exports.Hold = exports.MidiCC = exports.MidiNote = exports.VirtualSeq = exports.Seq = exports.Iterable = exports.Closure = exports.NativeFn = exports.Gen = exports.Fn = exports.Callable = exports.Arr = exports.Bool = exports.Int = exports.Yield = exports.Return = exports.Err = exports.Null = exports.Frame = void 0;
/**
 * Call "stack" frame (might not be in the call stack) representing
 * a function's execution context.
 *
 * @public
 */
class Frame {
    constructor(closure, base) {
        this.closure = closure;
        this.base = base;
        this.ip = -1;
    }
    /**
     * Gets the bytecode instructions of the callable function or generator.
     *
     * @returns Bytecode instructions
     */
    instructions() {
        return this.closure.fn.instructions;
    }
}
exports.Frame = Frame;
/**
 * Null type, contains no additional data.
 *
 * @public
 */
class Null {
    constructor() {
        this.type = 'null';
        if (!Null.self) {
            Null.self = this;
        }
        return Null.self;
    }
    inspectObject() {
        return 'null';
    }
}
exports.Null = Null;
/**
 * Error type. (To be implemented in the VM.)
 *
 * @public
 */
class Err {
    constructor(message) {
        this.message = message;
        this.type = 'error';
    }
    inspectObject() {
        return this.message;
    }
}
exports.Err = Err;
/**
 * Internal return type, should not be exposed to runtimes.
 *
 * @internal
 */
class Return {
    constructor(value) {
        this.value = value;
        this.type = 'return';
    }
    inspectObject() {
        return this.value.inspectObject();
    }
}
exports.Return = Return;
/**
 * Internal yield type, should not be exposed to runtimes.
 *
 * @internal
 */
class Yield {
    constructor(value) {
        this.value = value;
        this.type = 'yield';
    }
    inspectObject() {
        return this.value.inspectObject();
    }
}
exports.Yield = Yield;
/**
 * Integer type, contains a `value` property containing the implementation
 * language's value.
 *
 * @public
 */
class Int {
    constructor(value) {
        this.value = value;
        this.type = 'integer';
    }
    inspectObject() {
        return this.value.toString();
    }
    static from(value) {
        if (value < -256 || value > 255) {
            return new Int(value);
        }
        return Int.SMALL_VALUES[value + 256];
    }
}
exports.Int = Int;
Int.SMALL_VALUES = new Array(512);
for (let i = 0; i < 512; i++) {
    Int.SMALL_VALUES[i] = new Int(i - 256);
}
/**
 * Pre-generated integers
 */
/**
 * Boolean type, contains a `value` property containing the implementation
 * language's value.
 *
 * @public
 */
class Bool {
    constructor(value) {
        this.value = value;
        this.type = 'boolean';
    }
    inspectObject() {
        return this.value ? 'true' : 'false';
    }
    static from(value) {
        return value ? Bool.t : Bool.f;
    }
}
exports.Bool = Bool;
Bool.t = new Bool(true);
Bool.f = new Bool(false);
/**
 * Array type, contains an array (in the implementation language) containing
 * child BaseObjects.
 *
 * @public
 */
class Arr {
    constructor(items = []) {
        this.items = items;
        this.type = 'array';
    }
    inspectObject() {
        return `[${this.items
            .map((item) => item.inspectObject())
            .join(', ')}]`;
    }
}
exports.Arr = Arr;
/**
 * Base callable class for functions and generators.
 *
 * @public
 */
class Callable {
    constructor(instructions, repr, numLocals = 0, numParams = 0) {
        this.instructions = instructions;
        this.repr = repr;
        this.numLocals = numLocals;
        this.numParams = numParams;
        this.type = 'callable';
    }
    inspectObject() {
        return this.repr;
    }
}
exports.Callable = Callable;
/**
 * Callable function type.
 *
 * @public
 */
class Fn extends Callable {
    constructor() {
        super(...arguments);
        this.type = 'function';
    }
}
exports.Fn = Fn;
/**
 * Callable generator type. Always returns a `Seq` object.
 *
 * @public
 */
class Gen extends Callable {
    constructor() {
        super(...arguments);
        this.type = 'generator';
    }
}
exports.Gen = Gen;
/**
 * Melee object wrapping a native function definition.
 *
 * @public
 */
class NativeFn {
    constructor(label, handler) {
        this.label = label;
        this.handler = handler;
        this.type = 'native';
    }
    inspectObject() {
        return `${this.label}() { <native code> }`;
    }
}
exports.NativeFn = NativeFn;
/**
 * Closure encapsulating scoped variables with a function or generator.
 *
 * @public
 */
class Closure {
    constructor(fn, vars = []) {
        this.fn = fn;
        this.vars = vars;
        this.type = 'closure';
    }
    inspectObject() {
        return this.fn.inspectObject();
    }
}
exports.Closure = Closure;
/**
 * Base class for iterable sequences.
 *
 * @public
 */
class Iterable {
    constructor() {
        this.type = 'sequence';
        this.done = false;
    }
    inspectObject() {
        return `{seq status=${this.done ? 'done' : 'ongoing'}}`;
    }
}
exports.Iterable = Iterable;
/**
 * Sequence type, instance of a generator execution.
 *
 * @public
 */
class Seq extends Iterable {
    constructor(generator, executionState) {
        super();
        this.generator = generator;
        this.executionState = executionState;
        this.type = 'sequence';
        this.executionState.seq = this; // Self-reference
    }
}
exports.Seq = Seq;
/**
 * Virtual sequence type, instance of an array of objects with
 * internal iteration state, so it can be used as a sequence.
 * It just so happens that for this virtual implementation,
 * the state (aside from the `done` boolean) is maintained
 * within a closure.
 *
 * @public
 */
class VirtualSeq extends Iterable {
    constructor(next) {
        super();
        this.next = next;
        this.type = 'sequence';
    }
}
exports.VirtualSeq = VirtualSeq;
/**
 * MIDI note object to be used in musical runtimes.
 *
 * @public
 */
class MidiNote {
    constructor(pitch, duration, velocity) {
        this.pitch = pitch;
        this.duration = duration;
        this.velocity = velocity;
        this.type = 'note';
    }
    inspectObject() {
        if (this.pitch < 0) {
            return `{skip ${this.duration}}`;
        }
        return `{${exports.NOTES[this.pitch]} for ${this.duration} vel=${this.velocity}}`;
    }
    midiValue() {
        return {
            type: this.type,
            data: [this.pitch, this.duration, this.velocity],
        };
    }
    scientificNotation() {
        return exports.NOTES[this.pitch];
    }
}
exports.MidiNote = MidiNote;
/**
 * MIDI CC message object to be used in musical runtimes.
 *
 * @public
 */
class MidiCC {
    constructor(key, value) {
        this.key = key;
        this.value = value;
        this.type = 'cc';
    }
    inspectObject() {
        return `{cc key=${this.key} val=${this.value}}`;
    }
    midiValue() {
        return {
            type: this.type,
            data: [this.key, this.value],
        };
    }
}
exports.MidiCC = MidiCC;
/**
 * Sentinel used to notify the runtime to skip over this
 * particular value (often because they should be obeying
 * a previous note's duration).
 *
 * @public
 */
class Hold {
    constructor(pitch, duration) {
        this.pitch = pitch;
        this.duration = duration;
        this.type = 'hold';
    }
    inspectObject() {
        return `{hold ${this.duration}}`;
    }
}
exports.Hold = Hold;
/* Utilities */
const NULL = new Null();
const FALSE = Bool.from(false);
/**
 * Returns false if 0, null, or false, otherwise true.
 *
 * @param obj - Any object
 * @returns True if a truthy object
 *
 * @public
 */
function isTruthy(obj) {
    if (obj instanceof Int) {
        return obj.value !== 0;
    }
    return !(!obj || obj === NULL || obj === FALSE);
}
exports.isTruthy = isTruthy;
/**
 * Create a mapping of notes (in scientific pitch notation) to their
 * corresponding integer MIDI pitch value.
 */
const NOTE_NAMES = [
    ['C'],
    ['C#', 'Db'],
    ['D'],
    ['D#', 'Eb'],
    ['E'],
    ['F'],
    ['F#', 'Gb'],
    ['G'],
    ['G#', 'Ab'],
    ['A'],
    ['A#', 'Bb'],
    ['B'],
];
const midi = {};
const notes = [];
for (let index = 0; index < 128; index++) {
    const oct = Math.floor(index / 12) - 1;
    const octStr = `${oct < 0 ? '_1' : oct}`;
    const names = NOTE_NAMES[index % 12];
    if (!names) {
        continue;
    }
    names.forEach((n) => {
        midi[`${n}${octStr}`] = Int.from(index);
    });
    notes.push(`${names[0]}${octStr}`);
}
exports.MIDI_VALUES = midi;
exports.NOTES = notes.map((n) => n.replace(/_/g, '-'));
const MIDI_POOL_SIZE = 1000;
const MIDI_POOL = new Array(MIDI_POOL_SIZE);
for (let i = 0; i < MIDI_POOL_SIZE; i++) {
    MIDI_POOL[i] = new MidiNote(-1, 1, 0);
}
let MIDI_POOL_INDEX = 0;
function provisionMidiNote(pitch, duration, velocity) {
    const note = MIDI_POOL[MIDI_POOL_INDEX++];
    if (MIDI_POOL_INDEX >= MIDI_POOL_SIZE) {
        MIDI_POOL_INDEX = 0;
    }
    note.pitch = pitch;
    note.duration = duration;
    note.velocity = velocity;
    return note;
}
exports.provisionMidiNote = provisionMidiNote;
const HOLD_POOL_SIZE = 1000;
const HOLD_POOL = new Array(HOLD_POOL_SIZE);
for (let i = 0; i < HOLD_POOL_SIZE; i++) {
    HOLD_POOL[i] = new Hold(-1, 0);
}
let HOLD_POOL_INDEX = 0;
function provisionHold(pitch, duration) {
    const note = HOLD_POOL[HOLD_POOL_INDEX++];
    if (HOLD_POOL_INDEX >= HOLD_POOL_SIZE) {
        HOLD_POOL_INDEX = 0;
    }
    note.pitch = pitch;
    note.duration = duration;
    return note;
}
exports.provisionHold = provisionHold;

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const token_1 = require("./token");
const errors_1 = require("./errors");
const ast = require("./ast");
/**
 * AST child markers to detect unstable code.
 */
class ChildMarker {
    constructor(hasYield = false, hasBreak = false, hasContinue = false, hasReturn = false, isLoop = false) {
        this.hasYield = hasYield;
        this.hasBreak = hasBreak;
        this.hasContinue = hasContinue;
        this.hasReturn = hasReturn;
        this.isLoop = isLoop;
    }
}
/**
 * Defines a precedence order for operations
 * when evaluating an expression.
 */
var precedence;
(function (precedence) {
    precedence[precedence["NIL"] = 1] = "NIL";
    precedence[precedence["OR"] = 2] = "OR";
    precedence[precedence["AND"] = 3] = "AND";
    precedence[precedence["ASN"] = 4] = "ASN";
    precedence[precedence["EQL"] = 5] = "EQL";
    precedence[precedence["CMP"] = 6] = "CMP";
    precedence[precedence["ADD"] = 7] = "ADD";
    precedence[precedence["MUL"] = 8] = "MUL";
    precedence[precedence["PRF"] = 9] = "PRF";
    precedence[precedence["FNC"] = 10] = "FNC";
    precedence[precedence["IDX"] = 11] = "IDX";
    precedence[precedence["ERR"] = 12] = "ERR";
})(precedence || (precedence = {}));
/**
 * Assigns precedence values to tokens.
 */
const PRECEDENCE_MAP = {
    assign: precedence.ASN,
    pluseq: precedence.ASN,
    minuseq: precedence.ASN,
    asteriskeq: precedence.ASN,
    rslasheq: precedence.ASN,
    percenteq: precedence.ASN,
    or: precedence.OR,
    and: precedence.AND,
    eq: precedence.EQL,
    noteq: precedence.EQL,
    lt: precedence.CMP,
    lte: precedence.CMP,
    gt: precedence.CMP,
    gte: precedence.CMP,
    plus: precedence.ADD,
    minus: precedence.ADD,
    asterisk: precedence.MUL,
    rslash: precedence.MUL,
    percent: precedence.MUL,
    lparen: precedence.FNC,
    lbracket: precedence.IDX,
    identifier: precedence.ERR,
    number: precedence.ERR,
    note: precedence.ERR,
};
/**
 * Parses tokens to generate an AST (abstract syntax tree).
 */
class Parser {
    constructor(
    /**
     * Lexer instantiated with code to be parsed.
     */
    lexer) {
        this.lexer = lexer;
        /**
         * Current parsing branch's child markers.
         *
         * @internal
         */
        this.childMarkers = [new ChildMarker()];
        this.errors = [];
        this.prefixParseFns = {
            identifier: this.parseIdentifier.bind(this),
            true: this.parseBooleanLiteral.bind(this),
            false: this.parseBooleanLiteral.bind(this),
            int: this.parseIntegerLiteral.bind(this),
            fn: this.parseFunctionLiteral.bind(this),
            gen: this.parseGeneratorLiteral.bind(this),
            bang: this.parsePrefixExpression.bind(this),
            minus: this.parsePrefixExpression.bind(this),
            lparen: this.parseParentheticalExpression.bind(this),
            lbracket: this.parseArrayLiteral.bind(this),
            if: this.parseConditional.bind(this),
            next: this.parseNext.bind(this),
            note: this.parseNoteExpression.bind(this),
            skip: this.parseSkipExpression.bind(this),
            cc: this.parseCCExpression.bind(this),
        };
        this.infixParseFns = {
            plus: this.parseInfixExpression.bind(this),
            minus: this.parseInfixExpression.bind(this),
            asterisk: this.parseInfixExpression.bind(this),
            rslash: this.parseInfixExpression.bind(this),
            percent: this.parseInfixExpression.bind(this),
            and: this.parseInfixExpression.bind(this),
            or: this.parseInfixExpression.bind(this),
            eq: this.parseInfixExpression.bind(this),
            noteq: this.parseInfixExpression.bind(this),
            lt: this.parseInfixExpression.bind(this),
            lte: this.parseInfixExpression.bind(this),
            gt: this.parseInfixExpression.bind(this),
            gte: this.parseInfixExpression.bind(this),
            lparen: this.parseCallExpression.bind(this),
            lbracket: this.parseIndexExpression.bind(this),
            assign: this.parseAssignExpression.bind(this),
            pluseq: this.parseCompoundAssignmentExpression.bind(this),
            minuseq: this.parseCompoundAssignmentExpression.bind(this),
            asteriskeq: this.parseCompoundAssignmentExpression.bind(this),
            rslasheq: this.parseCompoundAssignmentExpression.bind(this),
            percenteq: this.parseCompoundAssignmentExpression.bind(this),
        };
        this.curr = this.lexer.nextToken();
        this.peek = this.lexer.nextToken();
    }
    /**
     * Steps through the lexer and updates the current
     * and peek token properties.
     *
     * @internal
     */
    nextToken() {
        if (this.peek.tokenType === 'illegal') {
            this.errors.push(new errors_1.SynError(`Unexpected token ${this.peek.literal}`, this.curr));
        }
        while (this.peek.tokenType === 'comment') {
            this.curr = this.peek;
            this.peek = this.lexer.nextToken();
        }
        this.curr = this.peek;
        this.peek = this.lexer.nextToken();
    }
    /**
     * Starts as the first lexer token and attempts to parse the full program.
     *
     * @returns {ast.Program} Top-level program AST node
     */
    parse() {
        const program = new ast.Program();
        while (!token_1.tokenIs(this.curr, 'eof')) {
            const stmt = this.parseStatement();
            if (stmt) {
                program.statements.push(stmt);
            }
            this.nextToken();
        }
        return program;
    }
    /** Statements **/
    parseStatement() {
        while (this.curr.tokenType === 'semicolon') {
            this.nextToken();
        }
        switch (this.curr.tokenType) {
            case 'return':
                this.childMarker().hasReturn = true;
                return this.parseReturnStatement();
            case 'yield':
                this.childMarker().hasYield = true;
                return this.parseYieldStatement();
            case 'while':
            case 'loop': {
                this.childMarkers.push(new ChildMarker());
                const token = this.curr;
                const result = this.parseWhile();
                const { hasBreak, hasReturn, hasYield } = this.childMarker();
                this.childMarkers.pop();
                if (token.tokenType === 'while') {
                    return result;
                }
                if (!hasBreak && !hasReturn && !hasYield) {
                    this.errors.push(new errors_1.SynError('Infinite loops must either `yield`, `return`, or `break`.', token));
                }
                return result;
            }
            case 'identifier': {
                if (token_1.tokenIs(this.peek, 'declare')) {
                    return this.parseDeclareStatement();
                }
                return this.parseExpressionStatement();
            }
            case 'continue': {
                this.childMarker().hasContinue = true;
                const stmt = new ast.ContinueStatement(this.curr);
                this.nextToken();
                return stmt;
            }
            case 'break': {
                this.childMarker().hasBreak = true;
                const stmt = new ast.BreakStatement(this.curr);
                this.nextToken();
                return stmt;
            }
            case 'for':
                return this.parseFor();
            case 'comment':
                return;
            default:
                return this.parseExpressionStatement();
        }
    }
    parseDeclareStatement() {
        const name = new ast.Identifier(this.curr, this.curr.literal);
        this.nextToken();
        const declare = this.curr;
        this.nextToken();
        const value = this.parseExpression(precedence.NIL);
        if (value instanceof ast.FunctionLiteral ||
            value instanceof ast.GeneratorLiteral) {
            value.name = name.value;
        }
        this.skipSemicolon();
        return new ast.DeclareStatement(declare, name, value);
    }
    parseReturnStatement() {
        const token = this.curr;
        this.nextToken();
        const value = this.parseExpression(precedence.NIL);
        this.skipSemicolon();
        return new ast.ReturnStatement(token, value);
    }
    parseYieldStatement() {
        const token = this.curr;
        this.nextToken();
        const value = this.parseExpression(precedence.NIL);
        this.skipSemicolon();
        return new ast.YieldStatement(token, value);
    }
    parseExpressionStatement() {
        const token = this.curr;
        const expr = this.parseExpression(precedence.NIL);
        this.skipSemicolon();
        return new ast.ExpressionStatement(token, expr);
    }
    parseBlockStatement() {
        const block = new ast.BlockStatement(this.curr, []);
        this.nextToken();
        while (!token_1.tokenIs(this.curr, 'rbrace') &&
            !token_1.tokenIs(this.curr, 'eof')) {
            const stmt = this.parseStatement();
            if (stmt) {
                block.statements.push(stmt);
            }
            this.nextToken();
        }
        return block;
    }
    /** Expressions **/
    parseExpression(precedence) {
        // Attempt to parse a prefix expression
        const prefixFn = this.prefixParseFns[this.curr.tokenType];
        if (!prefixFn) {
            this.errors.push(new errors_1.SynError(`Unexpected token \`${this.curr.literal}\``, this.curr));
            return;
        }
        let left = prefixFn.call(this);
        while (!token_1.tokenIs(this.peek, 'semicolon') &&
            precedence < this.peekPrecedence()) {
            const infixFn = this.infixParseFns[this.peek.tokenType];
            if (!infixFn) {
                this.errors.push(new errors_1.SynError(`Unexpected token in infix expression ${this.curr.literal}`, this.curr));
                return left;
            }
            this.nextToken();
            if (left) {
                left = infixFn.call(this, left);
            }
        }
        return left;
    }
    parsePrefixExpression() {
        const token = this.curr;
        const operator = this.curr.literal;
        this.nextToken();
        const right = this.parseExpression(precedence.PRF);
        return new ast.PrefixExpression(token, operator, right);
    }
    parseInfixExpression(left) {
        const token = this.curr;
        const operator = this.curr.literal;
        const leftPrecedence = this.currPrecedence();
        this.nextToken();
        const right = this.parseExpression(leftPrecedence);
        return new ast.InfixExpression(token, left, operator, right);
    }
    parseCompoundAssignmentExpression(left) {
        if (!left) {
            throw new Error('Error compiling compound assignment expression');
        }
        const token = this.curr;
        const operator = this.curr.literal;
        this.nextToken();
        const right = this.parseExpression(precedence.NIL);
        return new ast.CompoundAssignExpression(token, left, operator, right);
    }
    parseAssignExpression(left) {
        if (!left) {
            throw new Error('Error compiling assignment expression');
        }
        const token = this.curr;
        this.nextToken();
        const value = this.parseExpression(precedence.NIL);
        return new ast.AssignExpression(token, left, value);
    }
    parseIndexExpression(collection) {
        const token = this.curr;
        if (!collection)
            return;
        this.nextToken();
        const index = this.parseExpression(precedence.NIL);
        if (!index)
            return;
        if (!this.expectPeek('rbracket'))
            return;
        return new ast.IndexExpression(token, collection, index);
    }
    parseNoteExpression() {
        const token = this.curr;
        this.nextToken();
        const data = this.parseExpression(precedence.NIL);
        return new ast.NoteExpression(token, data);
    }
    parseSkipExpression() {
        const token = this.curr;
        this.nextToken();
        let duration;
        if (this.curr.tokenType !== 'semicolon') {
            duration = this.parseExpression(precedence.NIL);
        }
        return new ast.SkipExpression(token, duration);
    }
    parseCCExpression() {
        const token = this.curr;
        this.nextToken();
        const message = this.parseExpression(precedence.NIL);
        return new ast.CCExpression(token, message);
    }
    parseParentheticalExpression() {
        this.nextToken();
        const expr = this.parseExpression(precedence.NIL);
        if (!this.expectPeek('rparen')) {
            return;
        }
        return expr;
    }
    parseIdentifier() {
        return new ast.Identifier(this.curr, this.curr.literal);
    }
    parseBooleanLiteral() {
        return new ast.BooleanLiteral(this.curr, this.curr.literal === 'true');
    }
    parseIntegerLiteral() {
        return new ast.IntegerLiteral(this.curr, parseInt(this.curr.literal, 10));
    }
    parseArrayLiteral() {
        return new ast.ArrayLiteral(this.curr, this.parseExpressionList('rbracket'));
    }
    parseFunctionLiteral() {
        const token = this.curr;
        if (!this.expectPeek('lparen'))
            return;
        const parameters = this.parseFunctionParameters();
        if (!this.expectPeek('lbrace'))
            return;
        const body = this.parseBlockStatement();
        return new ast.FunctionLiteral(token, parameters, body);
    }
    parseGeneratorLiteral() {
        const token = this.curr;
        if (!this.expectPeek('lparen'))
            return;
        const parameters = this.parseFunctionParameters();
        if (!this.expectPeek('lbrace'))
            return;
        const body = this.parseBlockStatement();
        return new ast.GeneratorLiteral(token, parameters, body);
    }
    parseNext() {
        const token = this.curr;
        this.nextToken();
        const right = this.parseExpression(precedence.PRF);
        return new ast.NextExpression(token, right);
    }
    parseConditional() {
        const token = this.curr;
        if (!this.expectPeek('lparen'))
            return;
        this.nextToken();
        const condition = this.parseExpression(precedence.NIL);
        if (!this.expectPeek('rparen'))
            return;
        if (!this.expectPeek('lbrace'))
            return;
        if (!condition)
            return;
        const consequence = this.parseBlockStatement();
        let alternative;
        if (token_1.tokenIs(this.peek, 'else')) {
            this.nextToken();
            if (token_1.tokenIs(this.peek, 'if')) {
                this.nextToken();
                const stmt = this.parseStatement();
                if (!stmt) {
                    throw new errors_1.SynError('Invalid `else if` clause', this.peek);
                }
                alternative = new ast.BlockStatement(this.curr, [stmt]);
            }
            else {
                if (!this.expectPeek('lbrace'))
                    return;
                alternative = this.parseBlockStatement();
            }
        }
        return new ast.IfExpression(token, condition, consequence, alternative);
    }
    parseFor() {
        const token = this.curr;
        if (!this.expectPeek('identifier')) {
            return;
        }
        const identifier = this.parseIdentifier();
        if (!this.expectPeek('in'))
            return;
        this.nextToken();
        const collToken = this.curr;
        const collection = this.parseExpression(precedence.NIL);
        if (!collection) {
            this.errors.push(new errors_1.SynError('`for` expression must follow the `for var in collection {}` syntax', collToken));
            return;
        }
        if (!this.expectPeek('lbrace'))
            return;
        const block = this.parseBlockStatement();
        return new ast.ForStatement(token, identifier, collection, block);
    }
    parseWhile() {
        const token = this.curr;
        // If using the syntactic sugar `loop` keyword, just
        // create a true boolean conditional.
        let condition;
        if (token.tokenType === 'loop') {
            condition = new ast.BooleanLiteral({
                ...token,
                tokenType: 'true',
                literal: 'true',
            }, true);
        }
        else {
            if (!this.expectPeek('lparen'))
                return;
            this.nextToken();
            condition = this.parseExpression(precedence.NIL);
            if (!this.expectPeek('rparen'))
                return;
        }
        if (!this.expectPeek('lbrace'))
            return;
        if (!condition)
            return;
        const block = this.parseBlockStatement();
        return new ast.WhileStatement(token, condition, block);
    }
    parseCallExpression(left) {
        const token = this.curr;
        const args = this.parseExpressionList('rparen');
        return new ast.CallExpression(token, left, args);
    }
    /** Utilities **/
    peekPrecedence() {
        return PRECEDENCE_MAP[this.peek.tokenType]
            ? PRECEDENCE_MAP[this.peek.tokenType]
            : precedence.NIL;
    }
    currPrecedence() {
        return PRECEDENCE_MAP[this.curr.tokenType]
            ? PRECEDENCE_MAP[this.curr.tokenType]
            : precedence.NIL;
    }
    parseFunctionParameters() {
        const parameters = [];
        if (token_1.tokenIs(this.peek, 'rparen')) {
            this.nextToken();
            return parameters;
        }
        this.nextToken();
        parameters.push(this.parseIdentifier());
        while (token_1.tokenIs(this.peek, 'comma')) {
            this.nextToken();
            this.nextToken();
            parameters.push(this.parseIdentifier());
        }
        if (!token_1.tokenIs(this.peek, 'rparen')) {
            return [];
        }
        this.nextToken();
        return parameters;
    }
    parseExpressionList(endChar) {
        const args = [];
        if (token_1.tokenIs(this.peek, endChar)) {
            this.nextToken();
            return args;
        }
        this.nextToken();
        let expr = this.parseExpression(precedence.NIL);
        if (expr) {
            args.push(expr);
        }
        while (token_1.tokenIs(this.peek, 'comma')) {
            this.nextToken();
            this.nextToken();
            expr = this.parseExpression(precedence.NIL);
            if (expr) {
                args.push(expr);
            }
        }
        if (!token_1.tokenIs(this.peek, endChar)) {
            return [];
        }
        this.nextToken();
        return args;
    }
    expectPeek(t) {
        if (token_1.tokenIs(this.peek, t)) {
            this.nextToken();
            return true;
        }
        else {
            const { tokenType } = this.peek;
            const msg = `Expected next token to be ${t}, got ${tokenType} instead`;
            this.errors.push(new errors_1.SynError(msg, this.peek));
            return false;
        }
    }
    skipSemicolon() {
        if (token_1.tokenIs(this.peek, 'semicolon')) {
            this.nextToken();
        }
    }
    childMarker() {
        if (this.childMarkers.length) {
            return this.childMarkers[this.childMarkers.length - 1];
        }
        const childMarker = new ChildMarker();
        this.childMarkers.push(childMarker);
        return childMarker;
    }
}
exports.Parser = Parser;

},{"./ast":8,"./errors":12,"./token":20}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Repl = void 0;
const compiler_1 = require("./compiler");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const symbols_1 = require("./symbols");
const vm_1 = require("./vm");
const MAX_REPL_HISTORY = 100;
/**
 * Read-eval-print loop for executing code from the command line.
 */
class Repl {
    /**
     * Constructs a new REPL instance.
     */
    constructor() {
        this.constants = [];
        this.history = [];
        this.globals = vm_1.createGlobalVariables();
        this.symbolTable = symbols_1.SymbolTable.createGlobalSymbolTable();
    }
    /**
     * Execute a snippet of code passed through the REPL.
     *
     * @param input - Code snippet
     * @returns Stringified output
     */
    exec(input) {
        const lexer = new lexer_1.Lexer(input);
        const parser = new parser_1.Parser(lexer);
        const program = parser.parse();
        const compiler = new compiler_1.Compiler(this.constants, this.symbolTable);
        compiler.compile(program);
        const vm = new vm_1.VM(compiler, this.globals);
        vm.run();
        const obj = vm.lastElement();
        if (obj) {
            return obj.inspectObject();
        }
        this.history.push(input);
        while (this.history.length > MAX_REPL_HISTORY) {
            this.history.shift();
        }
        return 'undefined';
    }
    /**
     * Get a previously run code snippet.
     *
     * @param offset - Position from end of history record
     * @returns Previously run snippet
     */
    getPreviousEntry(offset = 0) {
        if (offset >= MAX_REPL_HISTORY)
            return;
        return this.history[MAX_REPL_HISTORY - offset - 1];
    }
}
exports.Repl = Repl;

},{"./compiler":11,"./lexer":14,"./parser":16,"./symbols":19,"./vm":22}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runtime = void 0;
const bytecode_1 = require("./bytecode");
const compiler_1 = require("./compiler");
const errors_1 = require("./errors");
const lexer_1 = require("./lexer");
const object_1 = require("./object");
const parser_1 = require("./parser");
const symbols_1 = require("./symbols");
const vm_1 = require("./vm");
const NULL = new object_1.Null();
function createRuntimeError(msg) {
    return new errors_1.RuntimeError(msg, 0, 0, 0);
}
/**
 * Opinionated runtime environment for generating MIDI sequences.
 */
class Runtime {
    /**
     * Constructs a new runtime instance.
     */
    constructor(active = true, callbacks) {
        this.active = active;
        this.callbacks = callbacks;
        this.queue = [];
        this.constants = [];
        /**
         * Syntax, compiler, and runtime errors found during execution.
         */
        this.errors = [];
        this.reset();
    }
    /**
     * Full reset of constants, globals, and the symbol table.
     */
    reset() {
        this.globals = vm_1.createGlobalVariables();
        this.symbolTable = symbols_1.SymbolTable.createGlobalSymbolTable();
        this.constants = [];
        this.errors = [];
        this.queue = [];
    }
    /**
     * Executes a new runtime by resetting, and then applying a
     * new snippet of code to the runtime.
     *
     * @param input - Code snippet
     */
    exec(input, args = []) {
        this.reset();
        this.apply(input, args);
    }
    /**
     * Stage changes to check for errors.
     *
     * @param input - Code snippet
     * @returns Lexer, parser, compiler, and runtime errors
     */
    stageChanges(input) {
        const lexer = new lexer_1.Lexer(input);
        const parser = new parser_1.Parser(lexer);
        const program = parser.parse();
        const errors = [...parser.errors];
        const symbolTable = symbols_1.SymbolTable.createGlobalSymbolTable();
        const compiler = new compiler_1.Compiler([], symbolTable);
        try {
            compiler.compile(program);
        }
        catch (e) {
            errors.push(e);
        }
        if (errors.length)
            return errors;
        const globals = vm_1.createGlobalVariables();
        const vm = new vm_1.VM(compiler, globals, this.callbacks);
        vm.run();
        const main = symbolTable.get('main');
        if (!main) {
            errors.push(createRuntimeError('Runtime environment requires a top-level `main` object'));
        }
        else {
            const seq = globals[main.index];
            if (!(seq instanceof object_1.Closure)) {
                errors.push(createRuntimeError('Top level `main` object must be a sequence generator'));
            }
        }
        return errors;
    }
    /**
     * Applies a new snippet of code passed through the runtime.
     *
     * @param input - Code snippet
     * @param args - Arguments to main generator
     */
    apply(input, args) {
        const lexer = new lexer_1.Lexer(input);
        const parser = new parser_1.Parser(lexer);
        const program = parser.parse();
        this.errors = [...parser.errors];
        const compiler = new compiler_1.Compiler(this.constants, this.symbolTable);
        try {
            compiler.compile(program);
        }
        catch (e) {
            this.errors.push(e);
            return;
        }
        this.instructions = compiler.instructions();
        const vm = new vm_1.VM(compiler, this.globals, this.callbacks);
        vm.run();
        const main = this.symbolTable.get('main');
        if (!main) {
            this.errors.push(createRuntimeError('Runtime environment requires a top-level `main` object'));
            return;
        }
        let seq = this.globals[main.index];
        if (seq instanceof object_1.Closure) {
            seq = vm.callAndReturn(seq, args);
        }
        else {
            this.errors.push(createRuntimeError('Top level `main` object must be a sequence generator'));
            return;
        }
        if (!(seq instanceof object_1.Seq)) {
            this.errors.push(createRuntimeError('Top level `main` object must return a sequence'));
            return;
        }
        this.seq = seq;
        this.vm = vm;
    }
    /**
     * Return a new object off of the main sequence.
     *
     * @returns Next object in the sequence
     */
    getNextValue() {
        if (!this.vm || !this.seq) {
            return NULL;
        }
        return this.vm.takeNext(this.seq);
    }
    /**
     * Clear the note queue of any notes whose
     * durations have lapsed.
     *
     * @returns Note pitches to be turned off
     */
    clearNotes() {
        const newQueue = [];
        const notesOff = [];
        // Iterate over playing notes...
        while (this.queue.length) {
            // Grab the next available note.
            const item = this.queue.shift();
            if (!(item instanceof object_1.MidiNote) && !(item instanceof object_1.Hold))
                break;
            // Decrement remaining note duration.
            item.duration--;
            if (item.duration) {
                newQueue.push(item);
            }
            else {
                // Prune if out of remaining note duration.
                notesOff.push(item.pitch);
            }
        }
        // Update the queue.
        this.queue = newQueue;
        return notesOff;
    }
    /**
     * Adds a note object to the queue.
     *
     * @returns True if note should be played
     */
    noteOn(note) {
        let playable = false;
        if (note instanceof object_1.MidiNote) {
            if (note.pitch >= 0) {
                playable = true;
            }
            this.queue.push(object_1.provisionMidiNote(note.pitch, note.duration, note.velocity));
        }
        return playable;
    }
    /**
     * Handles a new clock pulse while honoring note duration.
     *
     * @returns Note updates usable by runtime implementations
     */
    clock() {
        const notesOff = this.clearNotes();
        let notesOn = [];
        if (this.active) {
            let nextValue;
            if (!this.queue.length || notesOff.length) {
                nextValue = this.getNextValue();
            }
            if (nextValue instanceof object_1.Arr) {
                notesOn = nextValue.items.filter((item) => this.noteOn(item));
            }
            else if (nextValue instanceof object_1.MidiNote) {
                if (this.noteOn(nextValue)) {
                    notesOn.push(nextValue);
                }
            }
        }
        return {
            on: notesOn,
            off: notesOff.filter((n) => n >= 0),
            done: this.seq ? this.seq.done : true,
        };
    }
    /**
     * Debugs the bytecode for the current instructions
     * in the runtime.
     *
     * @returns Human-readable bytecode
     */
    getBytecode() {
        let bytecode = 'Constants:\n\n';
        this.constants.forEach((obj, i) => {
            bytecode += `${i}: ${obj.inspectObject()}\n`;
        });
        if (this.instructions) {
            bytecode += '\n\n';
            bytecode += bytecode_1.disassemble(this.instructions);
            this.constants.forEach((obj, i) => {
                if (obj instanceof object_1.Fn || obj instanceof object_1.Gen) {
                    bytecode += `\n\nFn[${i}]\n`;
                    bytecode += bytecode_1.disassemble(obj.instructions);
                }
            });
            return bytecode;
        }
        return 'No bytecode found.';
    }
}
exports.Runtime = Runtime;

},{"./bytecode":10,"./compiler":11,"./errors":12,"./lexer":14,"./object":15,"./parser":16,"./symbols":19,"./vm":22}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolTable = exports.ScopeType = void 0;
const builtins_1 = require("./builtins");
/**
 * Label defining level of variable scope.
 */
var ScopeType;
(function (ScopeType) {
    ScopeType[ScopeType["NATIVE"] = 0] = "NATIVE";
    ScopeType[ScopeType["GLOBAL"] = 1] = "GLOBAL";
    ScopeType[ScopeType["LOCAL"] = 2] = "LOCAL";
    ScopeType[ScopeType["FREE"] = 3] = "FREE";
    ScopeType[ScopeType["SELF"] = 4] = "SELF";
})(ScopeType = exports.ScopeType || (exports.ScopeType = {}));
/**
 * Symbol table for tracking named variables through the
 * compilation process.
 */
class SymbolTable {
    constructor(type, parent) {
        this.type = type;
        this.parent = parent;
        this.symbols = {};
        this.freeSymbols = [];
        this.numSymbols = 0;
        this.depth = parent ? parent.depth + 1 : -1;
    }
    /**
     * Adds a new iota symbol to the table and returns its unique index.
     *
     * @param label - Variable name
     * @returns Index of new symbol
     */
    addIota() {
        const iota = SymbolTable.iota++;
        const label = `$iota__${iota}`;
        return this.add(label);
    }
    /**
     * Adds a new symbol to the table and returns its unique index.
     *
     * @param label - Variable name
     * @returns Index of new symbol
     */
    add(label) {
        const sym = {
            label,
            index: this.numSymbols,
            depth: this.depth,
            type: this.type,
        };
        this.numSymbols++;
        this.symbols[label] = sym;
        return sym.index;
    }
    /**
     * Save the name of the current closure as a symbol in scope.
     *
     * @param label - Variable name of the current function
     * @returns New symbol
     */
    setSelf(label) {
        const sym = {
            label,
            index: 0,
            depth: -1,
            type: ScopeType.SELF,
        };
        this.symbols[label] = sym;
        return sym;
    }
    /**
     * Free a variable for use in an inner function or closure.
     *
     * @param sym - Existing symbol in scope
     * @returns Symbol representing a free closure variable
     */
    free(sym) {
        this.freeSymbols.push(sym);
        const freeSymbol = {
            ...sym,
            index: this.freeSymbols.length - 1,
            type: ScopeType.FREE,
        };
        this.symbols[sym.label] = freeSymbol;
        return freeSymbol;
    }
    /**
     * Look up a symbol in the table. If not found, it recurses
     * up its parent scope.
     *
     * @param label - Variable name
     * @returns Symbol
     */
    get(label) {
        if (!this.symbols[label] && this.parent) {
            const variable = this.parent.get(label);
            if (!variable ||
                variable.type === ScopeType.GLOBAL ||
                variable.type === ScopeType.NATIVE) {
                return variable;
            }
            return this.free(variable);
        }
        return this.symbols[label];
    }
    /**
     * Look up a symbol in the table and return its unique index.
     *
     * @param label - Variable name
     * @returns Index of symbol
     */
    getIndex(label) {
        var _a;
        return (_a = this.get(label)) === null || _a === void 0 ? void 0 : _a.index;
    }
    /**
     * Create a default global symbol table with native values
     * already populated.
     *
     * @param builtins - A hashmap containing any default variables
     * @returns Global symbol table
     *
     * @internal
     */
    static createGlobalSymbolTable(builtins = {}) {
        const globals = new SymbolTable(ScopeType.GLOBAL);
        if (builtins) {
            Object.keys({
                ...builtins_1.BUILTINS,
                ...builtins,
            }).forEach((label) => globals.add(label));
        }
        return globals;
    }
}
exports.SymbolTable = SymbolTable;
SymbolTable.iota = 0;

},{"./builtins":9}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenIs = exports.lookupIdentifier = void 0;
/**
 * User-defined type guard for keyword token types.
 *
 * @param str - Token literal
 * @returns True if a valid keyword
 *
 * @interal
 */
function isKeyword(str) {
    return ([
        'fn',
        'gen',
        'if',
        'else',
        'for',
        'in',
        'while',
        'loop',
        'continue',
        'break',
        'true',
        'false',
        'return',
        'yield',
        'next',
        'note',
        'skip',
        'cc',
    ].indexOf(str) !== -1);
}
/**
 * Determines if identifier token is already a valid keyword.
 *
 * @param str - Token literal
 * @returns Keyword if valid, otherwise `identifier`
 *
 * @internal
 */
function lookupIdentifier(str) {
    if (isKeyword(str)) {
        return str;
    }
    return 'identifier';
}
exports.lookupIdentifier = lookupIdentifier;
/**
 * Confirms that a token is of a particular token type.
 *
 * @param token Token tuple
 * @param tokenType Token type string
 * @returns True if token type matches
 */
function tokenIs(token, tokenType) {
    return token.tokenType === tokenType;
}
exports.tokenIs = tokenIs;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = void 0;
/**
 * Clamps a value between low and high constraints.
 *
 * @param n - Input number
 * @param lo - Lower bound
 * @param hi - Upper bound
 * @returns Clamped value
 */
function clamp(n, lo, hi) {
    return Math.min(Math.max(lo, n), hi);
}
exports.clamp = clamp;

},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VM = exports.createGlobalVariables = exports.MAX_VARIABLES = exports.MAX_STACK_SIZE = exports.MAX_FRAME_SIZE = void 0;
const assert_1 = require("assert");
const builtins_1 = require("./builtins");
const bytecode_1 = require("./bytecode");
const obj = require("./object");
const utils_1 = require("./utils");
/**
 * Constants
 */
exports.MAX_FRAME_SIZE = 1024;
exports.MAX_STACK_SIZE = 1024;
exports.MAX_VARIABLES = 65536;
/**
 * Literals
 */
const NULL = new obj.Null();
const TRUE = new obj.Bool(true);
const FALSE = new obj.Bool(false);
/**
 * Asserts stack object is defined.
 *
 * @param obj - Object to be compared
 *
 * @internal
 */
function assertStackObject(obj) {
    if (typeof obj === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        throw new assert_1.AssertionError({
            message: 'Attempting to access undeclared stack space. This is an error in the compiler.',
        });
    }
}
/**
 * Asserts variable object is defined.
 *
 * @param obj - Object to be compared
 *
 * @internal
 */
function assertVariableObject(obj) {
    if (typeof obj === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        throw new assert_1.AssertionError({
            message: 'Attempting to access undeclared variable space. This is an error in the compiler.',
        });
    }
}
/**
 * Create a new repository of global variables that have native values
 * already populated.
 *
 * @param builtins - A hashmap containing any default variables
 * @returns Array of global variables
 *
 * @internal
 */
function createGlobalVariables(builtins = {}) {
    const globals = new Array(exports.MAX_VARIABLES);
    const allBuiltins = { ...builtins_1.BUILTINS, ...builtins };
    Object.keys(allBuiltins).forEach((key, i) => {
        if (allBuiltins[key]) {
            globals[i] = allBuiltins[key];
        }
    });
    return globals;
}
exports.createGlobalVariables = createGlobalVariables;
/**
 * Virtual stack machine for executing instructions.
 */
class VM {
    /**
     * Constructs a new VM instance.
     *
     * @param compiler - Compiler instance
     */
    constructor(compiler, variables, callbacks) {
        this.constants = compiler.constants;
        this.frames = new Array(exports.MAX_FRAME_SIZE);
        this.stack = new Array(exports.MAX_STACK_SIZE);
        this.variables = variables || createGlobalVariables();
        this.callbacks = callbacks || {};
        this.fp = 1;
        this.sp = 0;
        this.frames[0] = new obj.Frame(new obj.Closure(new obj.Fn(compiler.instructions(), '<MAIN>')), 0);
    }
    /**
     * Create a new coroutine execution state for a generator sequence.
     *
     * @param closure - Closure-wrapped sequence
     * @param args - Function arguments to place in the coroutine stack
     * @returns New execution state
     */
    createCoroutine(closure, args, numLocals) {
        const parentExecutionState = {
            stack: this.stack,
            sp: this.sp,
            frames: this.frames,
            fp: this.fp,
            parent: this.coroutine && this.coroutine.parent
                ? this.coroutine.parent
                : undefined,
        };
        const frames = new Array(exports.MAX_FRAME_SIZE);
        frames[0] = new obj.Frame(closure, 0);
        const stack = new Array(exports.MAX_STACK_SIZE);
        const sp = numLocals;
        for (let i = 0; i < args.length; i++) {
            stack[i] = args[i];
        }
        return {
            stack,
            sp,
            frames,
            fp: 1,
            parent: parentExecutionState,
        };
    }
    /**
     * Enters a new coroutine by replacing the VM execution state with one saved
     * by a generator sequence.
     *
     * @param executionState - Saved execution state
     *
     * @internal
     */
    enterCoroutine(executionState) {
        const { stack, sp, frames, fp, coroutine } = this;
        if (coroutine) {
            executionState.parent = coroutine;
            executionState.parent.stack = stack;
            executionState.parent.sp = sp;
            executionState.parent.frames = frames;
            executionState.parent.fp = fp;
        }
        this.stack = executionState.stack;
        this.sp = executionState.sp;
        this.frames = executionState.frames;
        this.fp = executionState.fp;
        this.coroutine = executionState;
    }
    /**
     * Leaves the current coroutine context and restore the old
     * VM execution state.
     *
     * @internal
     */
    leaveCoroutine() {
        const executionState = this.coroutine;
        if (!executionState || !executionState.parent) {
            throw new Error('Cannot leave root execution state');
        }
        const { stack, sp, frames, fp } = this;
        executionState.stack = stack;
        executionState.sp = sp;
        executionState.frames = frames;
        executionState.fp = fp;
        this.coroutine = executionState.parent;
        this.stack = executionState.parent.stack;
        this.sp = executionState.parent.sp;
        this.frames = executionState.parent.frames;
        this.fp = executionState.parent.fp;
    }
    /**
     * Pretty-prints information about the VM state.
     *
     * @returns Stringified stack items
     *
     * @internal
     */
    printState() {
        let curr = this.sp;
        let output = `SP ${curr}\n`;
        output += `FRAME ${this.frame().closure.inspectObject()}\n`;
        output += `CVARS\n${this.frame()
            .closure.vars.map((n, i) => `  ${i}: ${n.inspectObject()}`)
            .join('\n')}\n`;
        output += `CONSTS\n${this.constants
            .map((n, i) => `  ${i}: ${n.inspectObject()}`)
            .join('\n')}\n\n`;
        while (curr > 0 && curr--) {
            const item = this.stack[curr];
            const stackAddress = `0000${curr}`.slice(-5);
            output += `${stackAddress} ${item ? item.inspectObject() : '<undef>'}\n`;
        }
        return output;
    }
    /**
     * Returns the current frame object.
     *
     * @returns Current frame
     *
     * @internal
     */
    frame() {
        return this.frames[this.fp - 1];
    }
    /**
     * Returns the last object popped off the top of the stack, or
     * undefined if the stack is empty.
     *
     * @returns Next stack object
     */
    lastElement() {
        return this.stack[this.sp];
    }
    /**
     * Pushes a new object onto the VM stack and increments
     * the stack pointer.
     *
     * @param o - New object
     *
     * @internal
     */
    push(o) {
        if (this.sp >= exports.MAX_STACK_SIZE) {
            throw new Error('Maximum stack size exceeded');
        }
        this.stack[this.sp] = o;
        this.sp++;
    }
    /**
     * Pops a new object off the VM stack and decrements
     * the stack pointer.
     *
     * @param o - New object
     *
     * @internal
     */
    pop() {
        const o = this.stack[this.sp - 1];
        this.sp--;
        return o;
    }
    /**
     * Jumps to next instruction specified by the next two instruction
     * bytes.
     *
     * @internal
     */
    jump() {
        const frame = this.frame();
        const destination = bytecode_1.unpackBigEndian(frame.instructions(), frame.ip + 1, 2);
        frame.ip = destination - 1;
    }
    /**
     * Reads operand at offset.
     *
     * @param width - Byte width of operand
     *
     * @internal
     */
    readOperand(width) {
        const frame = this.frame();
        const operand = bytecode_1.unpackBigEndian(frame.instructions(), frame.ip + 1, width);
        frame.ip += width;
        return operand;
    }
    /**
     * Iterates over the compiler instructions item-by-item, using the
     * stack to hold values and perform operations.
     *
     * @param exitFrame - Frame on which to halt execution
     */
    run(exitFrame) {
        var _a;
        let frame = this.frame();
        let inst = frame.instructions();
        while (frame.ip <= inst.length) {
            // The VM can be run recursively, but in doing so, you must
            // specify an exit frame in which to bounce out. This is
            // particularly useful because the next item on the stack
            // is the return value from the exited frame.
            if (exitFrame && frame === exitFrame) {
                return;
            }
            const ip = ++frame.ip;
            const op = inst[ip];
            switch (op) {
                case bytecode_1.Opcode.CONST: {
                    const idx = this.readOperand(2);
                    this.push(this.constants[idx]);
                    break;
                }
                case bytecode_1.Opcode.CLOSURE: {
                    const idx = this.readOperand(2);
                    const numFree = this.readOperand(1);
                    const fn = this.constants[idx];
                    if (!(fn instanceof obj.Callable)) {
                        throw new Error('Cannot enclose non-callable inside a closure');
                    }
                    const closureVars = numFree
                        ? new Array(numFree)
                        : [];
                    for (let i = 0; i < numFree; i++) {
                        const item = this.stack[this.sp - numFree + i];
                        if (!item) {
                            throw new Error('Stack out of usable objects for closure variables');
                        }
                        closureVars[i] = item;
                    }
                    this.sp -= numFree;
                    this.push(new obj.Closure(fn, closureVars));
                    break;
                }
                case bytecode_1.Opcode.SELF:
                    this.push(this.frame().closure);
                    break;
                case bytecode_1.Opcode.ARRAY: {
                    const size = this.readOperand(2);
                    const arr = new obj.Arr(new Array(size));
                    const start = this.sp - size;
                    for (let i = start; i < this.sp; i++) {
                        const element = this.stack[i];
                        assertStackObject(element);
                        arr.items[i - start] = element;
                    }
                    this.sp -= size;
                    this.push(arr);
                    break;
                }
                case bytecode_1.Opcode.LEN: {
                    const arr = this.pop();
                    if (!(arr instanceof obj.Arr)) {
                        throw new Error('Cannot iterate over non-array');
                    }
                    this.push(obj.Int.from(arr.items.length));
                    break;
                }
                case bytecode_1.Opcode.INDEX: {
                    const index = this.pop();
                    if (!(index instanceof obj.Int)) {
                        throw new Error('Array index must be an integer');
                    }
                    const collection = this.pop();
                    if (!(collection instanceof obj.Arr)) {
                        throw new Error('Cannot retrieve an element from a non-array');
                    }
                    this.push((_a = collection.items[index.value]) !== null && _a !== void 0 ? _a : NULL);
                    break;
                }
                case bytecode_1.Opcode.POP: {
                    this.pop();
                    break;
                }
                case bytecode_1.Opcode.TRUE:
                    this.push(TRUE);
                    break;
                case bytecode_1.Opcode.FALSE:
                    this.push(FALSE);
                    break;
                case bytecode_1.Opcode.NULL:
                    this.push(NULL);
                    break;
                case bytecode_1.Opcode.SETG: {
                    const index = this.readOperand(2);
                    const val = this.pop();
                    this.variables[index] = val;
                    break;
                }
                case bytecode_1.Opcode.GETG: {
                    const index = this.readOperand(2);
                    const value = this.variables[index];
                    assertVariableObject(value);
                    this.push(value);
                    break;
                }
                case bytecode_1.Opcode.SET: {
                    const index = this.readOperand(1);
                    this.stack[this.frame().base + index] = this.pop();
                    break;
                }
                case bytecode_1.Opcode.GET: {
                    const index = this.readOperand(1);
                    const value = this.stack[this.frame().base + index];
                    assertVariableObject(value);
                    this.push(value);
                    break;
                }
                case bytecode_1.Opcode.SETC: {
                    const index = this.readOperand(1);
                    const value = this.pop();
                    assertVariableObject(value);
                    this.frame().closure.vars[index] = value;
                    break;
                }
                case bytecode_1.Opcode.GETC: {
                    const index = this.readOperand(1);
                    const value = this.frame().closure.vars[index];
                    assertVariableObject(value);
                    this.push(value);
                    break;
                }
                case bytecode_1.Opcode.GETN: {
                    const index = this.readOperand(1);
                    const fn = builtins_1.NATIVE_FNS[index];
                    if (fn) {
                        this.push(fn);
                    }
                    break;
                }
                case bytecode_1.Opcode.BANG:
                    this.execUnaryLogicalNegation();
                    break;
                case bytecode_1.Opcode.MINUS:
                    this.execUnaryArithmeticNegation();
                    break;
                case bytecode_1.Opcode.ADD:
                case bytecode_1.Opcode.SUB:
                case bytecode_1.Opcode.MUL:
                case bytecode_1.Opcode.DIV:
                case bytecode_1.Opcode.MOD:
                    this.execBinaryArithmetic(op);
                    break;
                case bytecode_1.Opcode.EQ:
                case bytecode_1.Opcode.NOT_EQ:
                case bytecode_1.Opcode.GT:
                case bytecode_1.Opcode.GTE:
                    this.execComparison(op);
                    break;
                case bytecode_1.Opcode.AND: {
                    const left = this.stack[this.sp - 2];
                    const right = this.stack[this.sp - 1];
                    this.sp -= 2;
                    if (!left || !right) {
                        throw new Error('Cannot perform binary operation without two operands');
                    }
                    const res = obj.isTruthy(left) && obj.isTruthy(right);
                    this.push(res ? TRUE : FALSE);
                    break;
                }
                case bytecode_1.Opcode.OR: {
                    const left = this.stack[this.sp - 2];
                    const right = this.stack[this.sp - 1];
                    this.sp -= 2;
                    if (!left || !right) {
                        throw new Error('Cannot perform binary operation without two operands');
                    }
                    const res = obj.isTruthy(left) || obj.isTruthy(right);
                    this.push(res ? TRUE : FALSE);
                    break;
                }
                case bytecode_1.Opcode.JMP:
                    this.jump();
                    break;
                case bytecode_1.Opcode.JMP_IF_NOT:
                    if (!obj.isTruthy(this.pop())) {
                        this.jump();
                    }
                    else {
                        frame.ip += 2;
                    }
                    break;
                case bytecode_1.Opcode.CALL: {
                    const numArgs = this.readOperand(1);
                    const o = this.stack[this.sp - 1 - numArgs];
                    assertStackObject(o);
                    this.call(o, numArgs);
                    break;
                }
                case bytecode_1.Opcode.RET: {
                    const closureVars = this.frame().closure.vars;
                    const value = this.pop();
                    if (!value) {
                        throw new Error('Functions must return an explicit value or an implicit null');
                    }
                    if (this.fp <= 1 &&
                        this.coroutine &&
                        this.coroutine.parent) {
                        if (this.coroutine.seq) {
                            this.coroutine.seq.done = true;
                        }
                        this.leaveCoroutine();
                    }
                    else {
                        this.fp--;
                        this.sp = frame.base - 1;
                        frame = this.frames[this.fp - 1];
                        for (let i = 0; i < closureVars.length; i++) {
                            this.stack[frame.base + i] = closureVars[i];
                        }
                    }
                    this.push(value);
                    break;
                }
                case bytecode_1.Opcode.NEXT: {
                    const seq = this.pop();
                    if (seq instanceof obj.VirtualSeq) {
                        this.push(seq.next());
                    }
                    else {
                        this.next(seq);
                    }
                    break;
                }
                case bytecode_1.Opcode.YIELD: {
                    const value = this.pop();
                    assertStackObject(value);
                    this.leaveCoroutine();
                    this.push(value);
                    break;
                }
                case bytecode_1.Opcode.SKIP: {
                    const duration = this.pop();
                    if (!(duration instanceof obj.Int) || duration.value <= 0) {
                        throw new Error('Cannot use `skip` keyword with a non-integer duration or a duration less than 1');
                    }
                    this.push(new obj.MidiNote(-1, duration.value, 0));
                    break;
                }
                case bytecode_1.Opcode.NOTE: {
                    const value = this.pop();
                    if (!value ||
                        !(value instanceof obj.Arr) ||
                        !value.items.length ||
                        value.items.length > 3) {
                        throw new Error('Notes must be created with an array containing one to three integer arguments');
                    }
                    const pitch = value.items[0];
                    if (!(pitch instanceof obj.Int)) {
                        throw new Error('MIDI note pitch must be an integer or a pitch literal like Eb4');
                    }
                    const duration = value.items[1];
                    let durationValue = 1;
                    if (duration) {
                        if (!(duration instanceof obj.Int)) {
                            throw new Error('MIDI note duration must be an integer');
                        }
                        durationValue = Math.max(1, duration.value);
                    }
                    const velocity = value.items[2];
                    let velocityValue = 64;
                    if (velocity) {
                        if (!(velocity instanceof obj.Int)) {
                            throw new Error('MIDI note velocity must be an integer');
                        }
                        velocityValue = Math.min(127, Math.max(0, velocity.value));
                    }
                    this.push(new obj.MidiNote(pitch.value, durationValue, velocityValue));
                    break;
                }
                case bytecode_1.Opcode.CC: {
                    const args = this.pop();
                    if (!args ||
                        !(args instanceof obj.Arr) ||
                        args.items.length !== 2) {
                        throw new Error('CC messages must be created with an array containing a key integer and a value integer');
                    }
                    const key = args.items[0];
                    if (!(key instanceof obj.Int)) {
                        throw new Error('MIDI CC key must be an integer');
                    }
                    const value = args.items[1];
                    if (!(value instanceof obj.Int)) {
                        throw new Error('MIDI CC value must be an integer');
                    }
                    this.push(new obj.MidiCC(utils_1.clamp(key.value, 0, 127), utils_1.clamp(value.value, 0, 127)));
                }
            }
            frame = this.frame();
            inst = frame.instructions();
        }
    }
    /**
     * Calculate a sequence's next value and retrieve the value from the stack.
     *
     * @param seq - Sequence instance
     * @returns Return value
     */
    takeNext(seq) {
        if (seq instanceof obj.VirtualSeq) {
            return seq.next();
        }
        const exitFrame = this.next(seq);
        if (exitFrame) {
            this.run(exitFrame);
        }
        const result = this.pop();
        assertStackObject(result);
        return result;
    }
    /**
     * Calculate a sequence's next value.
     *
     * @param seq - Sequence instance
     * @returns Current stack frame before the call
     */
    next(seq) {
        if (!seq || !(seq instanceof obj.Seq)) {
            throw new Error('`next` can only be used on generated sequence instances');
        }
        if (seq.done) {
            this.push(NULL);
            return;
        }
        const frame = this.frame();
        this.enterCoroutine(seq.executionState);
        return frame;
    }
    /**
     * Call a function and obtain its return value.
     *
     * @param callee - Closure or native function
     * @param args - Arguments to apply
     * @returns Return value
     */
    callAndReturn(callee, args) {
        this.push(callee);
        args.forEach((arg) => {
            this.push(arg);
        });
        const exitFrame = this.call(callee, args.length);
        if (exitFrame) {
            this.run(exitFrame);
        }
        const result = this.pop();
        assertStackObject(result);
        return result;
    }
    /**
     * Begin a function, generator, or built-in call.
     *
     * @param callee - Closure or native function to call
     * @param numArgs - Number of arguments applied to the call
     * @returns Current stack frame before the call
     */
    call(callee, numArgs) {
        if (!(callee instanceof obj.Closure) &&
            !(callee instanceof obj.NativeFn)) {
            throw new Error('Cannot perform opcode CALL on a non-callable stack element');
        }
        if (callee instanceof obj.Closure) {
            const { fn } = callee;
            while (numArgs > fn.numParams) {
                this.pop();
                numArgs--;
            }
            while (numArgs < fn.numParams) {
                this.push(NULL);
                numArgs++;
            }
            if (fn instanceof obj.Fn) {
                const frame = new obj.Frame(callee, this.sp - numArgs);
                this.frames[this.fp] = frame;
                this.fp++;
                this.sp = frame.base + fn.numLocals;
                // Specify an exit frame.
                return this.frames[this.fp - 2];
            }
            else if (fn instanceof obj.Gen) {
                const args = this.gatherArgs(numArgs);
                this.push(new obj.Seq(callee, this.createCoroutine(callee, args, fn.numLocals)));
            }
        }
        else if (callee instanceof obj.NativeFn) {
            const args = this.gatherArgs(numArgs);
            this.push(callee.handler(this, ...args));
        }
        return undefined;
    }
    /**
     * Gather the expected arguments into an array of objects.
     *
     * @param numArgs - Number of expected arguments
     * @returns Argument objects
     *
     * @internal
     */
    gatherArgs(numArgs) {
        const args = [];
        while (numArgs--) {
            const arg = this.pop();
            assertStackObject(arg);
            args.unshift(arg);
        }
        this.pop(); // Get the closure or native function out of the way.
        return args;
    }
    /**
     * Pops the last item off of the stack, performs a unary
     * arithmetic negation, and pushes its result onto the stack.
     *
     * @internal
     */
    execUnaryArithmeticNegation() {
        const right = this.pop();
        if (!right) {
            throw new Error('Cannot perform unary operation without a valid operand');
        }
        if (right instanceof obj.Int) {
            this.push(obj.Int.from(-right.value));
            return;
        }
        throw new Error(`Cannot perform unary arithmetic negation (-) operation on a non-integer`);
    }
    /**
     * Pops the last item off of the stack, performs a unary
     * logical negation, and pushes its result onto the stack.
     *
     * @internal
     */
    execUnaryLogicalNegation() {
        const right = this.pop();
        if (!right) {
            throw new Error('Cannot perform unary operation without a valid operand');
        }
        if (right instanceof obj.Int) {
            this.push(obj.Bool.from(right.value !== 0));
        }
        else if (right === NULL || right === FALSE) {
            this.push(TRUE);
        }
        else {
            this.push(FALSE);
        }
    }
    /**
     * Pops the last two items off of the stack, performs a binary
     * operation, and pushes its result onto the stack.
     *
     * @param op - Opcode byte
     *
     * @internal
     */
    execBinaryArithmetic(op) {
        const left = this.stack[this.sp - 2];
        const right = this.stack[this.sp - 1];
        this.sp -= 2;
        if (!left || !right) {
            throw new Error('Cannot perform binary operation without two operands');
        }
        if (left instanceof obj.Int && right instanceof obj.Int) {
            this.execBinaryIntegerArithmetic(op, left, right);
            return;
        }
        throw new Error(`Cannot perform binary operation (${bytecode_1.OPCODES[op].name}) between types ${left.type} and ${right.type}`);
    }
    /**
     * Executes a binary (infix) integer operation and pushes the result
     * onto the stack.
     *
     * @param op - Opcode byte
     * @param left - Left operand
     * @param right - Right operand
     *
     * @internal
     */
    execBinaryIntegerArithmetic(op, left, right) {
        let result;
        switch (op) {
            case bytecode_1.Opcode.ADD:
                result = left.value + right.value;
                break;
            case bytecode_1.Opcode.SUB:
                result = left.value - right.value;
                break;
            case bytecode_1.Opcode.MUL: {
                result = left.value * right.value;
                break;
            }
            case bytecode_1.Opcode.DIV: {
                result = Math.floor(left.value / right.value);
                break;
            }
            case bytecode_1.Opcode.MOD: {
                result = left.value % right.value;
                break;
            }
            default:
                throw new Error(`Unhandled binary integer operator: ${op}`);
        }
        this.push(obj.Int.from(result));
    }
    /**
     * Pops the last two items off of the stack, performs a comparison
     * operation, and pushes its result onto the stack.
     *
     * @param op - Opcode byte
     *
     * @internal
     */
    execComparison(op) {
        const left = this.stack[this.sp - 2];
        const right = this.stack[this.sp - 1];
        this.sp -= 2;
        if (left instanceof obj.Int && right instanceof obj.Int) {
            this.execIntegerComparison(op, left, right);
            return;
        }
        if (left instanceof obj.Bool && right instanceof obj.Bool) {
            switch (op) {
                case bytecode_1.Opcode.EQ:
                    this.push(obj.Bool.from(left === right));
                    break;
                case bytecode_1.Opcode.NOT_EQ:
                    this.push(obj.Bool.from(left !== right));
                    break;
                default:
                    throw new Error(`Unhandled boolean comparison operator: ${op}`);
            }
            return;
        }
        if (!left || !right) {
            throw new Error('Cannot perform comparison operation without two operands');
        }
        throw new Error(`Cannot perform comparison operation between types ${left.type} and ${right.type}`);
    }
    /**
     * Executes an integer comparison operation and pushes the result
     * onto the stack.
     *
     * @param op - Opcode byte
     * @param left - Left operand
     * @param right - Right operand
     *
     * @internal
     */
    execIntegerComparison(op, left, right) {
        let result;
        switch (op) {
            case bytecode_1.Opcode.EQ:
                result = left.value === right.value;
                break;
            case bytecode_1.Opcode.NOT_EQ:
                result = left.value !== right.value;
                break;
            case bytecode_1.Opcode.GT:
                result = left.value > right.value;
                break;
            case bytecode_1.Opcode.GTE:
                result = left.value >= right.value;
                break;
            default:
                throw new Error(`Unhandled integer comparison operator: ${op}`);
        }
        this.push(obj.Bool.from(result));
    }
}
exports.VM = VM;

},{"./builtins":9,"./bytecode":10,"./object":15,"./utils":21,"assert":23}],23:[function(require,module,exports){
(function (global){(function (){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":27,"util/":26}],24:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],25:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],26:[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":25,"_process":28,"inherits":24}],27:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],28:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[3]);
