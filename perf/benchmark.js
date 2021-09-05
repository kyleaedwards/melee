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
  v1 := gen () {
    loop {
	    yield chord(note [A2, 2, 127], MAJ, 2);
    }
  };
  v2 := cycle([note [A1], note [C1], note [E1]]);
  main := gen () {
    p := poly(v1(), v2);
    loop { yield next p }
  };
`);

const before = Date.now();
let iterations = 0;
try {
  let x;
  for (let i = 0; i < ITERS; i++) {
    x = melee.clock();
    iterations++;
  }
  console.log(x);
} catch (e) {
  console.log(e);
}
console.log(`Done ${iterations} iters in ${Date.now() - before}ms`);