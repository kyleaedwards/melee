# Melee

**Melee** is a domain-specific language for defining complex musical sequences using *generators*. This specific repository is a reference implementation written in TypeScript to faciliate an Ableton Max4Live device.

## What is a "generator?"

In some programming languages, a [generator](https://en.wikipedia.org/wiki/Generator_(computer_programming)) is a self-contained piece of code like a function or a coroutine that can be paused and resumed as it "yields" values out to the caller while maintaining its internal state. In practice, they're often used for lazily evaluating extremely large (sometimes infinite) loops.

## But what does this mean if I'm not a total computer nerd?

It's a weird code thing that we're gonna use to make music loopies.

## Show Me The Goods

While Melee is not the most fully featured language, you can still do things like basic arithmetic, assign variables, and bundle code into functions.

```js
a := 1 + 2; // 3
isThree := fn (x) {
  return x == 3;
};
if (isThree(a)) {
  print(5 * 10);
} // 50
```

Unlike other general purpose languages, Melee is intended to be used in a runtime environment that can send MIDI messages to a hardware instrument or some other software. Because of that, `note`s are a first-class data type.

```js
note [C3]
note [Fb2, 2]
note [G#7, 4, 64]
```

The `note` keyword can receive up to three pieces of data: `[pitch, duration, velocity]`. Velocity is a special value that is commonly used to  determine how hard a key is pressed, or how strongly a note should be played. It ranges from 0 to 127 (that's just a MIDI thing), and if left out, it defaults to the smack-dab in the middle (64). Duration is determined by whoever is using Melee, and is a multiple of the main clock. For example, if the program is grabbing a new value every eighth note, then a duration of 2 would be a quarter note, 4 would be a half note, etc...

Functions and notes aside, the real sweet spot for Melee happens when we start incorporating generator functions to create new sequences.

```js
seq := gen () {
  yield note [C3];
  yield note [D3];
  yield note [C3];
  yield note [G3];
}
```

Here we have a generator function that will create a simple four-note sequence C-D-C-G. The `gen() { ... }` means that everything enclosed within the brackets is the code that gets run step by step to build up the sequence. Each line in this example `yield`s the value (in this case they're MIDI `note`s), out to whoever is using the sequence.

In this first example, the sequence reaches the G3 note and ends, but this doesn't have to be the case with a `loop`!

```js
main := gen () {
  loop {
    yield note [C3];
    yield note [D3];
    yield note [C3];
    yield note [G3];
  }
}
```

Now that it loops forever, we can start making the sequence a bit more complex. Perhaps we ditch the 4/4 pattern and have it drift around randomly.

```js
main := gen() {
  loop {
    yield note [C3];
    yield note [D3];
    if (rand(3) != 1) {
      yield note [C3];
    }
    yield note [G3];
  }
}
```

Now every time we go through the loop, it'll first yield a C, then a D, and then it'll generate a `rand`om positive integer equal to or less than the number that immediately follows it (`rand(3)` generates `0`, `1` or `2`, `rand(4)` generates `0`, `1`, `2`, or `3`, etc...).

If that number doesn't match (`!=`) 1, then it yields an extra C, otherwise it skips it and moves on to the G. Each loop has a one-third chance of being 3 notes instead of 4.

You don't have to yield `note`s or `cc` messages from generators, they can be any value, which could come in handy as you compose different sequences together in interesting ways. Below we use a second sequence generator to spit out a cycle of `int`s (integer numbers) that we'll use in the note's duration field.

```js
subseq := gen() {
  loop {
    yield n16;
    yield n8;
    yield d8;
  }
}
duration := subseq();

// You can also do the above with the cycle() built-in function
// to turn an array of values into a sequence.
//
// duration := cycle([1, 2, 3]);

main := gen() {
  loop {
    yield note [C3, next duration];
    yield note [D3, next duration];
    yield note [C3, next duration];
    yield note [G3, next duration];
  }
}
```

What we start getting here is a loop of MIDI notes, but the durations drift with each loop: C3 for 1 beat, D3 for 2, C3 for 3, G3 for 1, C3 for 2, etc...

Hopefully you're starting to see how with a little bit of code you can build complex sequences that you may have not have been able to dream up otherwise.

This barely cracks the surface of what's capable with Melee, so check out the [examples](/examples) for more in-depth demonstrations.

## Note Lengths

By default, any note or skip without an explicit duration lasts for a sixteenth note. When supplying a duration, you may provide an integer value or use a built-in variable. Variables like `n1`, `n2`, `n4`, `n8`, and so on represent whole notes, half notes, quarter notes and eighth notes respectively. There are also the aliases `WHOLE`, `HALF`, `QUARTER`, `EIGHTH` and `SIXTEENTH` for common note lengths. Triplets can be specified by swapping the `n` for a `t` like `t4` for a triple quarter note, and dotted notes can be specified with a `d`, like `d4`.

Under the hood, all these values are integers that are multiples of the number of clock ticks per measure. By default this is set to 48, meaning that the smallest note you make is a 32nd note triplet at one tick. Two ticks is a 16th note triplet, and three ticks is a 16th note. If you were to use a Melee runtime that doubled the amount of ticks per measure, it would support 32nd notes.

Because these are all just numbers, you can do math operations on them, such as `n4 + n8 + 16` or `n4 * 3 - n8t`.

## Scales

The `scale()` and `quant()` functions convert an interval or note to a MIDI pitch number relative to the provided scale and root note. You can provide any scale by setting an array like `fibonacci := [0, 1, 2, 3, 5, 8]`, however some scales are pre-loaded into the language and can be accessed with the variable names below:

```js
SCALE_MAJOR // or
SCALE_IONIAN
SCALE_MINOR // or
SCALE_AEOLIAN
SCALE_PENTA_MAJOR
SCALE_PENTA_MINOR
SCALE_BLUES
SCALE_DORIAN
SCALE_PHRYGIAN
SCALE_LYDIAN
SCALE_MIXOLYDIAN
SCALE_LOCRIAN
```

## Chords and Polyphony

In the current design of Melee, polyphony is a bit of a tricky thing. In real human compositions, notes of a chord don't always play for the same length for the same length. To allow users the flexibility of flowing seamlessly between harmony and melody, it's easier for chords to simply be arrays of `note` objects rather than a standalone data type.

That being said, there are a number of helpers to work with groups of notes.

### Chords

The `chord` function can take either a `note` object or a `int` pitch value, an array of chord intervals, and an optional inversion number. This means you can call `chord` a couple of different ways.

```js
chord(A2, MAJ)    // A2 Maj triad
> [A2, C#2, E2]

chord(A2, MAJ, 1) // A2 Maj triad, first inversion
> [C#2, E2, A3]

chord(note[A2, 4, 127], MAJ) // A2 Maj triad, for 4 clock cycles, with full velocity
> [note [A2, 4, 127], note [C#2, 4, 127], note [E2, 4, 127]]

chord(note[A2, 4, 127], MAJ, 2) // A2 Maj triad, second inversion, for 4 clock cycles, with full velocity
> [note [E2, 4, 127], note [A3, 4, 127], note [C#3, 4, 127]]
```

The full list of built-in chords are shown below, but because these chords are just arrays, you can define your own in the Melee code, use scales as chords, chords as scales... whatever you want!

```js
ROOT_4 // Root + perfect 4th
ROOT_5 // Root + perfect 5th
ROOT_6 // Root + sixth
SUS_2 // Root + 2nd + 5th
SUS_4 // Root + 4th + 5th
ROOT_5_ADD_9 // Root + 5th + 9th
ROOT_6_ADD_9 // Root + 6th + 9th
MAJ // Root + 3rd + 5th
MIN // Root + flat 3rd + 5th
MAJ_7 // Root + 3rd + 5th + 7th
MIN_7 // Root + flat 3rd + 5th + flat 7th
DOM_7 // Root + 3rd + 5th + flat 7th
MIN_MAJ_7 // Root + flat 3rd + 5th + 7th
MAJ_9 // Root + 3rd + 5th + 7th + 9th
MAJ_ADD_9 // Root + 3rd + 5th + 9th
MIN_9 // Root + flat 3rd + 5th + flat 7th + 9th
MIN_ADD_9 // Root + flat 3rd + 5th + 9th
DOM_9 // Root + 3rd + 5th + flat 7th + 9th
MAJ_11 // Root + 3rd + 5th + 7th + 9th + 11th
MIN_11 // Root + flat 3rd + 5th + flat 7th + 9th + 11th
```

### Polyphony

Because Melee notes have durations baked into the data type, it can be tough for the runtime to know how long a group of notes should play. More importantly, it can be difficult to know when to pull the next item from the main sequence.

For example, let's say you want to play two sequences in a sort of two-voice sequence, where a melody plays while another note plays every 4 beats to reinforce a bass note.

```
// Melody  | C5 | A5 | G5 | F#5 | F5 | D5 | G5 | B4 |
// Bass    | C2                 | F2                |

melody := gen() {
  yield note [C5]
  yield note [A5]
  yield note [G5]
  yield note [F#5]
  yield note [D5]
  yield note [D5]
  yield note [G5]
  yield note [B4]
}

bass := gen() {
  yield note [C2, 4]
  yield note [F2, 4]
}

main := merge(melody(), bass())
```

If we were to do a plain old `merge` to join these two generators into a single `main` sequence, then on the first beat, the runtime receives the two notes `[note [C5], note [C2, 4]`. The runtime would need to make a choice on whether to the next items after one beat or four. If the runtime pulled another note on the second beat, then the sequence would return `[note [A5], note [F2, 4]]`. That's not what we want.

Hence, the `poly` function is available to provide a way to merge sequences that is aware of note duration. If you were to create a `main` sequence using `poly(melody(), bass())`, rather than the second beat returning both a new melody and bass note, we would recieve the array `[note [A5], HOLD]`.

`HOLD` is a special value useful to runtimes to know not to worry about that particular note, and that whatever its currently doing should be fine.

> As a user, you shouldn't have to worry too much about passing `HOLD` values around, but if you're daring enough to create your own program that uses Melee, you'll want to look out for it.

## Reference

### Data Types

| Type | Example | Description |
| --- | --- | --- |
| **array** | `[1, 2, 3]` | A list of any of the above data types
| **bool** | `true` | True or false; mostly used for branching your code |
| **cc** | `cc [3, 64]` | MIDI CC message |
| **fn** | `fn(...args) { ... }` | A function
| **gen** | `gen(...args) { ... }` | A generator function capable of creating a generator instance
| **int** | `5` | An integer value; used for math or converting into `note` or `cc` data |
| **note** | `note [D4, 1, 127]` | MIDI note, must contain the pitch (`note [D4]`), but you can also provide a duration and a velocity; a note with pitch -1 is a rest |
| **null** | `null` | Nothing at all; if you got this, something probably went wrong |
| **seq** | `N/A` | A sequence object you get by calling a `gen` function. Iterate over it with `next`.
| **skip** | `skip 2` | Shorthand for a note with a pitch of -1 |

### Built-in Functions

| Type | Example | Description |
| --- | --- | --- |
| **chord** | `chord(...)` | See [Chords and Polyphony](#chords-and-polyphony) for a full explanation |
| **concat** | `concat(arr1, arr2, ..., arrN)` | Merge multiple arrays into one |
| **conv** | `conv(arr)` | Converts an array into a sequence |
| **cycle** | `cycle(arr)` | Converts an array into an infinitely looping sequence |
| **dur** | `dur(note)` | Returns a note's duration |
| **filter** | `filter(arr, fn)` | Creates a new array of items where `fn(item)` returns *truthy* |
| **len** | `len(arr)` | Returns the length of the array |
| **map** | `map(arr, fn)` | Creates a new array by performing `fn` on each array item |
| **max** | `max(arr)` | Returns the maximum value of an array of `int`s |
| **merge** | `merge(seq1, seq2, ..., seqN)` | Merges multiple sequences together so that `next` returns an array of each next value of the given sequences |
| **min** | `min(arr)` | Returns the minimum value of an array of `int`s |
| **pitch** | `pitch(note)` | Returns a note's pitch |
| **poly** | `poly(seq1, seq2, ..., seqN)` | Polyphony helper; almost identical to `merge`, honors note duration |
| **pop** | `pop(arr)` | Pulls an element off the end of an array and returns it |
| **print** | `print(...)` | Prints arguments to the console |
| **push** | `push(arr)` | Pushes a new element onto an array |
| **quant** | `scale(scaleArr, root, note)` | Quantizes a note by snapping it to the next highest pitch in the scale |
| **rand** | `rand(n)` | Generates a random `int` from 0 up to *and not including* `n` |
| **range** | `range(n)` | Returns an array of length `n` containing the numbers `0` up to *and not including* `n` |
| **rev** | `rev(arr)` | Returns a reversed array |
| **rrand** | `rrand(lo, hi)` | Generates a random `int` in the provided range from `lo` up to *and not including* `hi` |
| **scale** | `scale(scaleArr, root, interval)` | Work with intervals of a scale rather than chromatic MIDI pitches (see [Scales](#scales) below for more information)
| **shift** | `shift(arr)` | Pulls an element off the front of an array and returns it |
| **sort** | `sort(arr)` | Returns a sorted array |
| **take** | `take(seq, n)` | Pulls the next `n` elements out of a sequence and puts them in an array |
| **vel** | `vel(note)` | Returns a note's velocity |

## Acknowledgements

Melee is *heavily* inspired by the [Monome Teletype](https://monome.org/docs/teletype/) eurorack module, the [ORCΛ](https://github.com/hundredrabbits/Orca) esoteric programming language, and the [Nestup](https://nestup.cutelab.nyc/) markup language for writing complex rhythms. Melee is also inspired greatly by Thorsten Ball's Monkey programming language. Thorsten's books [Writing an Interpreter in Go](https://interpreterbook.com/) and [Writing a Compiler in Go](https://compilerbook.com/) were an indispensible resource in learning the ins and outs of language design and implementation. If you're at all interested in writing your own language, I cannot recommend these books enough!
