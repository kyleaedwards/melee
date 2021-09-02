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
