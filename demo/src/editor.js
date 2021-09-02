/**
 * Imports
 */
const { Runtime, obj, errors: meleeErrors } = require('../..');
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
