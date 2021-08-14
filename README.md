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
    yield 1
    yield 2
    yield 3
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

## Data Types

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

## Built-in Functions

| Type | Example | Description |
| --- | --- | --- |
| **concat** | `concat(arr1, arr2, ..., arrN)` | Merge multiple arrays into one |
| **conv** | `conv(arr)` | Converts an array into a sequence |
| **cycle** | `cycle(arr)` | Converts an array into an infinitely looping sequence |
| **filter** | `filter(arr, fn)` | Creates a new array of items where `fn(item)` returns *truthy* |
| **len** | `len(arr)` | Returns the length of the array |
| **map** | `map(arr, fn)` | Creates a new array by performing `fn` on each array item |
| **max** | `max(arr)` | Returns the maximum value of an array of `int`s |
| **min** | `min(arr)` | Returns the minimum value of an array of `int`s |
| **poly** | `poly(seq1, seq2, ..., seqN)` | Polyphony helper; merges multiple sequences together but honors note length |
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

### Scales

The `scale()` and `quant()` functions convert an interval or note to a MIDI pitch number relative to the provided scale and root note. You can provide any scale by setting an array like `fibonacci := [0, 1, 2, 3, 5, 8]`, however some scales are pre-loaded into the language and can be accessed with the variable names below:

```
MAJOR or IONIAN
MINOR or AEOLIAN
PENTA_MAJOR
PENTA_MINOR
BLUES
DORIAN
PHRYGIAN
LYDIAN
MIXOLYDIAN
LOCRIAN
```

### Chords

**In progress...**

## Acknowledgements

Melee is *heavily* inspired by the [Monome Teletype](https://monome.org/docs/teletype/) eurorack module, the [ORCΛ](https://github.com/hundredrabbits/Orca) esoteric programming language, and the [Nestup](https://nestup.cutelab.nyc/) markup language for writing complex rhythms. Melee is also inspired greatly by Thorsten Ball's Monkey programming language. Thorsten's books [Writing an Interpreter in Go](https://interpreterbook.com/) and [Writing a Compiler in Go](https://compilerbook.com/) were an indispensible resource in learning the ins and outs of language design and implementation. If you're at all interested in writing your own language, I cannot recommend these books enough!
