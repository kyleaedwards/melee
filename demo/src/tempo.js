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
    const t = clampWithDefault(tempo, 20, 240, Tone.Transport.bpm.value);
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
