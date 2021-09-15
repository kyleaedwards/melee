/**
 * Imports
 */
const { CLOCKS_PER_MEASURE } = require('../../dist');

let TONE_FREQ = '16t';
if (CLOCKS_PER_MEASURE === 384) {
  TONE_FREQ = '256t';
} else if (CLOCKS_PER_MEASURE === 192) {
  TONE_FREQ = '128t';
} else if (CLOCKS_PER_MEASURE === 96) {
  TONE_FREQ = '64t';
} else if (CLOCKS_PER_MEASURE === 48) {
  TONE_FREQ = '32t';
}

module.exports = {
  CLOCKS_PER_MEASURE,
  TONE_FREQ,
};
