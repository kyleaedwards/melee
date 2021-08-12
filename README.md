# Melee

**Melee** is a domain-specific language for defining complex musical sequences using *generators*. This specific repository is a reference implementation written in TypeScript to faciliate an Ableton Max4Live device.

## What is a "generator?"

In some programming languages, a [generator](https://en.wikipedia.org/wiki/Generator_(computer_programming)) is a self-contained piece of code like a function or a coroutine that can be paused and resumed as it "yields" values out to the caller while maintaining its internal state. In practice, they're often used for lazily evaluating extremely large (sometimes infinite) loops.

## But what does this mean if I'm not a total nerd?

It's a weird code thing that we're gonna use to make music loopies.

## Show Me The Goods

```
main := gen() {
  <- note [C3]
  <- note [D3]
  <- note [C3]
  <- note [G3]
}
```

Here we have a generator function that will create a simple four-note sequence C-D-C-G. The `gen() { ... }` means that everything enclosed within the brackets is the code that gets run step by step to build up the sequence. Those little `<-` arrow symbols mean to yield the value (in this case they're MIDI `note`s), out to whoever is using the sequence.

> **Note:** You can also use the keyword `yield` but the arrow syntax is a bit more terse for smaller text views.

In this first example, the sequence reaches the G3 note and ends, but this doesn't have to be the case with a `loop`!

```
main := gen() {
  loop {
    <- note [C3]
    <- note [D3]
    <- note [C3]
    <- note [G3]
  }
}
```

Now that it loops forever, we can start making the sequence a bit more chaotic. Say we maybe don't want to stick to the 4/4 pattern, and we'd like it to drift randomly.

```
main := gen() {
  loop {
    <- note [C3]
    <- note [D3]
    if (random(2) == 1) {
      <- note [C3]
    }
    <- note [G3]
  }
}
```

Now every time we go through the loop, it'll first yield a C, then a D, and then it'll generate a `rand`om positive integer equal to or less than the number that immediately follows it (`rand(2)` generates `1` or `2`, `rand(3)` generates `1`, `2`, or `3`, etc...).

If that number matches (`==`) 1, then it yields an extra C, otherwise it skips it. Each loop has a 50% chance of being 3 notes instead of 4.

You don't have to yield `note`s or `cc` messages from generators, they can be any value, which could come in handy as you compose different sequences together in interesting ways. Below we use a second sequence generator to spit out a cycle of `int`s that we'll use in the note duration field.

```
subseq := gen() {
  loop {
    <- 1
    <- 2
    <- 3
  }
}

main := gen() {
  duration = subseq()
  loop {
    <- note [C3, next duration]
    <- note [D3, next duration]
    <- note [C3, next duration]
    <- note [G3, next duration]
  }
}
```

What we start getting here is a loop of MIDI notes, but the durations drift with each loop: C3 for 1 beat, D3 for 2, C3 for 3, G3 for 1, C3 for 2, etc...

Hopefully you're starting to see how with a little bit of code you can build complex sequences that you may have not have been able to dream up otherwise.

## Data Types

| Type | Example | Description |
| --- | --- | --- |
| **null** | `null` | Nothing at all; if you got this, something probably went wrong |
| **bool** | `true` | True or false; mostly used for branching your code |
| **int** | `5` | An integer value; used for math or converting into `note` or `cc` data |
| **note** | `note [D4, 1, 127]` | MIDI note, must contain the pitch (`note [D4]`), but you can also provide a duration and a velocity |
| **skip** | `skip 2` | Special message telling the runtime to skip output for provided steps |
| **cc** | `cc [3, 64]` | MIDI CC message |
| **array** | `[1, 2, 3]` | A list of any of the above data types
| **fn** | `fn(...args) { ... }` | A function
| **gen** | `gen(...args) { ... }` | A generator function capable of creating a generator instance
| **seq** | `N/A` | A sequence object you get by calling a `gen` function. Iterate over it with `next`.

## Built-in Functions

| Type | Example | Description |
| --- | --- | --- |
| **print** | `print(...)` | Prints arguments to the console |
| **len** | `len(arr)` | Returns the length of the array |
| **range** | `range(n)` | Returns an array of length `n` containing the numbers `0` up to *and not including* `n` |
| **rand** | `rand(n)` | Generates a random `int` from 0 up to *and not including* `n` |
| **rrand** | `rrand(lo, hi)` | Generates a random `int` in the provided range from `lo` up to *and not including* `hi` |
| **min** | `min(arr)` | Returns the minimum value of an array of `int`s |
| **max** | `max(arr)` | Returns the maximum value of an array of `int`s |
| **push** | `push(arr)` | Pushes a new element onto an array |
| **pop** | `pop(arr)` | Pops an element off the end of an array and returns it |
| **concat** | `concat(arr1, arr2, ..., arrN)` | Pops an element off the end of an array and returns it |
| **sort** | `sort(arr)` | Returns a sorted array |
| **rev** | `rev(arr)` | Returns a reversed array |
| **map** | `map(arr, fn)` | Creates a new array by performing `fn` on each array item |
| **filter** | `filter(arr, fn)` | Creates a new array of items where `fn(item)` returns *truthy* |
| **scale** | `scale(base, interval, scaleNum)` | Work with intervals of a scale rather than chromatic MIDI pitches (see [Scales](#scales) below for more information)

### Scales

The `scale()` function converts a base note, an interval, and a scale constant to a MIDI pitch number. The current scales supported are:

```
MAJOR
MINOR
PENTA_MAJOR
PENTA_MINOR
BLUES
PHRYGIAN
DORIAN
```

### Advanced Concepts

- Merging
- Chords
- For/loops
- All keyword
- Merge keyword
- Range keyword

## Acknowledgements

Melee is *heavily* inspired by the [Monome Teletype](https://monome.org/docs/teletype/) eurorack module, the [ORCΛ](https://github.com/hundredrabbits/Orca) esoteric programming language, as well as Thorsten Ball's Monkey programming language. Thorsten's books [Writing an Interpreter in Go](https://interpreterbook.com/) and [Writing a Compiler in Go](https://compilerbook.com/) were an indispensible resource in learning the ins and outs of language design and implementation. If you're at all interested in writing your own language, I cannot recommend these books enough!
