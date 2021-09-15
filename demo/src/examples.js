/**
 * Imports
 */
const fs = require('fs');
const path = require('path');

/**
 * Examples used when defining the helptext for the demo page. Each demo is an
 * object consisting of a descriptive `name`, the default `tempo` for the
 * demonstration, and the `code` itself. In this case, the code property is loaded
 * from the example files in the repo.
 */
module.exports = [
  {
    name: 'Simple Loop',
    tempo: 120,
    code: fs.readFileSync(path.join(__dirname, '../../examples/00-simple-loop.melee'), 'utf-8'),
  },
  {
    name: 'One-shot Sequence',
    tempo: 120,
    code: fs.readFileSync(path.join(__dirname, '../../examples/01-one-shot-sequence.melee'), 'utf-8'),
  },
  {
    name: 'Notes in G maj',
    tempo: 120,
    code: fs.readFileSync(path.join(__dirname, '../../examples/02-notes-in-g-maj.melee'), 'utf-8'),
  },
  {
    name: 'Probabilities',
    tempo: 88,
    code: fs.readFileSync(path.join(__dirname, '../../examples/03-probabilities.melee'), 'utf-8'),
  },
  {
    name: 'Random Walk',
    tempo: 120,
    code: fs.readFileSync(path.join(__dirname, '../../examples/04-random-walk.melee'), 'utf-8'),
  },
  {
    name: 'Generators',
    tempo: 120,
    code: fs.readFileSync(path.join(__dirname, '../../examples/05-generators.melee'), 'utf-8'),
  },
  {
    name: 'Composing Sequences',
    tempo: 112,
    code: fs.readFileSync(path.join(__dirname, '../../examples/06-composing-sequences.melee'), 'utf-8'),
  },
  {
    name: 'Polyphony',
    tempo: 101,
    code: fs.readFileSync(path.join(__dirname, '../../examples/07-polyphony.melee'), 'utf-8'),
  },
  {
    name: 'BOC',
    tempo: 94,
    code: fs.readFileSync(path.join(__dirname, '../../examples/08-boc.melee'), 'utf-8'),
  },
  {
    name: 'Channels and CC Messages',
    tempo: 133,
    code: fs.readFileSync(path.join(__dirname, '../../examples/09-channels-and-cc.melee'), 'utf-8'),
  },
];
