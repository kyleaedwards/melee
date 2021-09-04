/**
 * Imports
 */
const { Runtime } = require('../dist');

/**
 * Constants
 */
const melee = new Runtime();
const ITERS = 1000000;

melee.exec(`
  // Example: Random Walk
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
  };
`);

const before = Date.now();
try {
  let x;
  for (let i = 0; i < ITERS; i++) {
    x = melee.clock();
  }
  console.log(x);
} catch (e) {
  console.log(e);
}
console.log(`Done in ${Date.now() - before}ms`);