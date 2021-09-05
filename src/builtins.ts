import {
  Arr,
  BaseObject,
  Bool,
  Closure,
  Hold,
  Int,
  isTruthy,
  Iterable,
  MidiNote,
  MIDI_VALUES,
  NativeFn,
  Null,
  provisionHold,
  VirtualSeq,
} from './object';
import type { VM } from './vm';

const NULL = new Null();

/**
 * Collection of native function implementations that cannot be implemented
 * as easily with the compiled code itself.
 *
 * @internal
 */
export const NATIVE_FNS: NativeFn[] = [
  /**
   * chord(Note, Arr, Int): Arr
   * (alternatively: chord(Int, Arr, Int): Arr)
   * Creates a chord of notes or pitches either with an existing
   * root note or root pitch value.
   */
  new NativeFn(
    'chord',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const [root, chord, inversion] = args;

      let rootPitch: number;
      if (root instanceof MidiNote) {
        rootPitch = root.pitch;
      } else if (root instanceof Int) {
        rootPitch = root.value;
      } else {
        throw new Error(
          'The first argument to `chord` must be an Int pitch or a MIDI note object',
        );
      }

      if (!(chord instanceof Arr)) {
        throw new Error(
          'Chord requires second argument to be an existing chord variable or an array of note intervals',
        );
      }

      let inversionValue = 0;
      if (inversion) {
        if (!(inversion instanceof Int)) {
          throw new Error('Inversion must be a number');
        }
        inversionValue = inversion.value;
      }

      const len = chord.items.length;
      const inversionOcts = Math.floor(inversionValue / len);

      const intervals = chord.items.map((item, i) => {
        if (!(item instanceof Int)) {
          throw new Error(
            'Chord requires second argument to be an existing chord variable or an array of note intervals',
          );
        }
        return item.value + 12 * (inversionOcts + (i % len));
      });

      // while (inversionValue-- > 0) {
      //   const interval = intervals.shift();
      //   if (interval !== undefined) {
      //     intervals.push(interval + 12);
      //   }
      // }

      const items = intervals.map((interval) => {
        if (root instanceof MidiNote) {
          return new MidiNote(
            rootPitch + interval,
            root.duration,
            root.velocity,
          );
        }
        return Int.from(rootPitch + interval);
      });
      return new Arr(items);
    },
  ),

  /**
   * concat(...Arr): Arr
   * Given an arbitrary number of array arguments, returns a new
   * array containing all of the arrays' children.
   */
  new NativeFn(
    'concat',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      let items: BaseObject[] = [];
      args.forEach((arg) => {
        if (!(arg instanceof Arr)) {
          throw new Error(
            'Function `concat` only accepts array arguments',
          );
        }
        items = items.concat(arg.items);
      });
      return new Arr(items);
    },
  ),

  /**
   * conv(Arr): VirtualSeq
   * Converts an array into a one-shot sequence.
   */
  new NativeFn('conv', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (!(arr instanceof Arr)) {
      throw new Error(
        'Function `conv` takes a single array argument',
      );
    }
    const items = arr.items;
    const length = items.length;
    let index = 0;
    const seq = new VirtualSeq(() => {
      if (seq.done) {
        return NULL;
      }
      const item = items[index++];
      if (index >= length) {
        seq.done = true;
      }
      return item;
    });
    return seq;
  }),

  /**
   * cycle(Arr): VirtualSeq
   * Converts an array into a looping sequence.
   */
  new NativeFn(
    'cycle',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const arr = args[0];
      if (!(arr instanceof Arr)) {
        throw new Error(
          'Function `cycle` takes a single array argument',
        );
      }
      const items = arr.items;
      const length = items.length;
      let index = 0;
      const seq = new VirtualSeq(() => {
        const item = items[index++];
        if (index >= length) {
          index = 0;
        }
        return item;
      });
      return seq;
    },
  ),

  /**
   * dur(Note): Int
   * Given a MIDI note object, returns its duration.
   */
  new NativeFn('dur', (_: VM, ...args: BaseObject[]): BaseObject => {
    const note = args[0];
    if (args.length !== 1 || !(note instanceof MidiNote)) {
      throw new Error(
        'Function `dur` takes a single MIDI note argument',
      );
    }
    return Int.from(note.duration);
  }),

  /**
   * filter(Arr, Fn): Arr
   * Given an array and a function, returns a new array containing
   * only the elements that return truthy when provided to the function.
   */
  new NativeFn(
    'filter',
    (vm: VM, ...args: BaseObject[]): BaseObject => {
      const [arr, fn] = args;
      if (
        args.length !== 2 ||
        !(arr instanceof Arr) ||
        !(fn instanceof Closure || fn instanceof NativeFn)
      ) {
        throw new Error(
          'Function `filter` requires an array and a function',
        );
      }
      const items = arr.items.filter((item, i) => {
        const res = vm.callAndReturn(fn, [item, Int.from(i)]);
        return isTruthy(res);
      });
      return new Arr(items);
    },
  ),

  /**
   * len(Arr): Int
   * Returns the length of a Melee array object.
   */
  new NativeFn('len', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (!(arr instanceof Arr)) {
      throw new Error('Function `len` takes a single array argument');
    }
    return Int.from(arr.items.length);
  }),

  /**
   * map(Arr, Fn): Arr
   * Given an array and a function, performs the function on each
   * array element and returns an array containing the return values
   * of each.
   */
  new NativeFn('map', (vm: VM, ...args: BaseObject[]): BaseObject => {
    const [arr, fn] = args;
    if (
      args.length !== 2 ||
      !(arr instanceof Arr) ||
      !(fn instanceof Closure || fn instanceof NativeFn)
    ) {
      throw new Error(
        'Function `map` takes an array and a function to transform each element',
      );
    }
    const items = arr.items.map((item, i) =>
      vm.callAndReturn(fn, [item, Int.from(i)]),
    );
    return new Arr(items);
  }),

  /**
   * max(Arr): Int | Null
   * Given an array of integers, returns the largest integer value.
   */
  new NativeFn('max', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `max` takes a single array argument');
    }
    const items = [];
    for (let i = 0; i < arr.items.length; i++) {
      const item = arr.items[i];
      if (item instanceof Int) {
        items.push(item.value);
      }
    }
    if (!items.length) {
      return NULL;
    }
    return Int.from(Math.max.apply(null, items));
  }),

  /**
   * merge(...Seq): Seq
   * Given a variable length list of sequences, returns a new sequence
   * that returns an array of next values for each one.
   */
  new NativeFn(
    'merge',
    (vm: VM, ...args: BaseObject[]): BaseObject => {
      const seqs: Iterable[] = [];
      args.forEach((arg) => {
        if (!(arg instanceof Iterable)) {
          throw new Error(
            'Function `merge` takes a flexible number of sequence objects',
          );
        }
        seqs.push(arg);
      });
      const seq = new VirtualSeq(() => {
        const output = new Array<BaseObject>(seqs.length);
        seqs.forEach((seq, i) => {
          output[i] = vm.takeNext(seq);
        });
        return new Arr(output);
      });
      return seq;
    },
  ),

  /**
   * min(Arr): Int | Null
   * Given an array of integers, returns the smallest integer value.
   */
  new NativeFn('min', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `min` takes a single array argument');
    }
    const items = [];
    for (let i = 0; i < arr.items.length; i++) {
      const item = arr.items[i];
      if (item instanceof Int) {
        items.push(item.value);
      }
    }
    if (!items.length) {
      return NULL;
    }
    return Int.from(Math.min.apply(null, items));
  }),

  /**
   * pitch(Note): Int
   * Given a MIDI note object, returns its pitch.
   */
  new NativeFn(
    'pitch',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const note = args[0];
      if (args.length !== 1 || !(note instanceof MidiNote)) {
        throw new Error(
          'Function `pitch` takes a single MIDI note argument',
        );
      }
      return Int.from(note.pitch);
    },
  ),

  /**
   * poly(...Seq): Seq
   * Polyphony helper to process multiple sequences of notes and
   * chords at the same time.
   */
  new NativeFn(
    'poly',
    (vm: VM, ...args: BaseObject[]): BaseObject => {
      const seqs: Iterable[] = [];
      args.forEach((arg) => {
        if (!(arg instanceof Iterable)) {
          throw new Error(
            'Function `poly` takes a flexible number of sequence objects',
          );
        }
        seqs.push(arg);
      });
      const durations: number[] = [];
      for (let i = 0; i < seqs.length; i++) durations[i] = -1;
      const pitches: number[] = [];
      for (let i = 0; i < seqs.length; i++) pitches[i] = -1;
      const seq = new VirtualSeq(() => {
        const output = new Array<BaseObject>(seqs.length);
        seqs.forEach((seq, i) => {
          if (durations[i] > 0) {
            output[i] = provisionHold(pitches[i], durations[i]);
          } else {
            const note = vm.takeNext(seq);
            if (note instanceof MidiNote) {
              durations[i] = note.duration;
              pitches[i] = note.pitch;
            } else if (note instanceof Arr) {
              let minDuration = -1;
              let pitch = -1;
              for (let j = 0; j < note.items.length; j++) {
                const item = note.items[j];
                if (!(item instanceof MidiNote)) {
                  throw new Error(
                    '`poly` sequences must yield MIDI notes or chords',
                  );
                }
                if (minDuration < 0) {
                  minDuration = item.duration;
                } else {
                  minDuration = Math.min(minDuration, item.duration);
                }
                pitch = item.pitch;
              }
              durations[i] = minDuration;
              pitches[i] = pitch;
            } else {
              throw new Error(
                '`poly` sequences must yield MIDI notes or chords',
              );
            }
            output[i] = note;
          }
        });
        const min = Math.min(...durations.filter((d) => d > 0));
        for (let i = 0; i < seqs.length; i++) {
          durations[i] = Math.max(0, durations[i] - min);
          const hold = output[i];
          if (hold instanceof Hold) {
            hold.duration = min;
          }
        }
        const flattenedNotes = output.reduce(
          (acc: BaseObject[], cur: BaseObject) => {
            if (cur instanceof Arr) {
              return [...acc, ...cur.items];
            }
            return [...acc, cur];
          },
          [],
        );
        return new Arr(flattenedNotes);
      });
      return seq;
    },
  ),

  /**
   * pop(Arr): *
   * Pops an item off of the end of an array.
   */
  new NativeFn('pop', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `pop` takes a single array argument');
    }
    return arr.items.pop() || NULL;
  }),

  /**
   * print(...*): Null
   * Prints the provided arguments to the console.
   */
  new NativeFn(
    'print',
    (vm: VM, ...args: BaseObject[]): BaseObject => {
      if (vm.callbacks && vm.callbacks.print) {
        vm.callbacks.print(...args);
      }
      return NULL;
    },
  ),

  /**
   * push(Arr, *): Arr
   * Pushes an arbitrary item onto the end of an array.
   */
  new NativeFn('push', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    const next = args[1] || NULL;
    if (args.length !== 2 || !(arr instanceof Arr)) {
      throw new Error(
        'Function `push` takes an array and an item to push',
      );
    }
    arr.items.push(next);
    return arr;
  }),

  /**
   * quant(Arr, Int | Note, Int | Note): Int | Note
   * Given a scale, a root note, and an input note, calculates and
   * returns the next closest note that fits the scale.
   */
  new NativeFn(
    'quant',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const [scale, root, note] = args;
      if (
        !(scale instanceof Arr) ||
        !scale.items.every((item) => item instanceof Int)
      ) {
        throw new Error(
          'Function `quant` requires the first argument to be an array of integers',
        );
      }
      let rootPitch;
      if (root instanceof Int) {
        rootPitch = root.value;
      } else if (root instanceof MidiNote) {
        rootPitch = root.pitch;
      } else {
        throw new Error(
          'Function `quant` requires a scale array, a root note or pitch, and a note or pitch to quantize',
        );
      }

      let notePitch;
      if (note instanceof Int) {
        notePitch = note.value;
      } else if (note instanceof MidiNote) {
        notePitch = note.pitch;
      } else {
        throw new Error(
          'Function `quant` requires a scale array, a root note or pitch, and a note or pitch to quantize',
        );
      }

      let base = notePitch - rootPitch;
      const octave = Math.floor(base / 12);
      while (base < 0) {
        base += 12;
      }
      base %= 12;
      let quantized = 12;
      for (let i = 0; i < scale.items.length; i++) {
        const item = scale.items[i] as Int;
        if (item.value >= base) {
          quantized = item.value;
          break;
        }
      }
      quantized += rootPitch + octave * 12;

      if (note instanceof MidiNote) {
        return new MidiNote(quantized, note.duration, note.velocity);
      }
      return Int.from(quantized);
    },
  ),

  /**
   * rand(Int): Int
   * Given number `n`, returns a random number between `0` and `n - 1`.
   */
  new NativeFn('rand', (_: VM, ...args: BaseObject[]): BaseObject => {
    const hi = args[0];
    if (args.length !== 1 || !(hi instanceof Int)) {
      throw new Error(
        'Function `rand(num)` takes a single integer argument, which returns a number from 0 up to, but not including, num',
      );
    }
    return Int.from(Math.floor(Math.random() * hi.value));
  }),

  /**
   * range(Int): Arr
   * Given an integer `n`, returns a Melee array object containing
   * integers `0` through `n - 1`.
   */
  new NativeFn(
    'range',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const num = args[0];
      if (args.length !== 1 || !(num instanceof Int)) {
        throw new Error(
          'Function `range` takes a single integer argument',
        );
      }
      if (num.value < 1) {
        throw new Error(
          'Function `range(num)` requires num to be at least 1',
        );
      }
      const items = [];
      for (let i = 0; i < num.value; i++) {
        items.push(Int.from(i));
      }
      return new Arr(items);
    },
  ),

  /**
   * rev(Arr): Arr
   * Given an array, returns a new array with the items in reverse order.
   */
  new NativeFn('rev', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `rev` takes a single array argument');
    }
    const items = [];
    for (let i = 0; i < arr.items.length; i++) {
      items.push(arr.items[arr.items.length - 1 - i]);
    }
    return new Arr(items);
  }),

  /**
   * rrand(Int, Int): Int
   * Given numbers `lo` and `hi`, returns a random number between `lo`
   * and `hi - 1`.
   */
  new NativeFn(
    'rrand',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const lo = args[0];
      const hi = args[1];
      if (
        args.length !== 2 ||
        !(hi instanceof Int) ||
        !(lo instanceof Int)
      ) {
        throw new Error(
          'Function `rrand(lo, hi)` takes a two integer arguments, returning a random number from lo up to, but not including, hi',
        );
      }
      const x = Math.min(lo.value, hi.value);
      const y = Math.max(lo.value, hi.value);
      return Int.from(x + Math.floor(Math.random() * (y - x)));
    },
  ),

  /**
   * scale(Arr, Int | Note, Int): Int | Note
   * Given a scale, a root note, and an interval, calculates and returns
   * the pitch value at that interval.
   */
  new NativeFn(
    'scale',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const [scale, root, interval] = args;
      if (
        !(scale instanceof Arr) ||
        !scale.items.every((item) => item instanceof Int)
      ) {
        throw new Error(
          'Function `scale` requires the first argument to be an array of integers',
        );
      }
      let rootPitch;
      if (root instanceof Int) {
        rootPitch = root.value;
      } else if (root instanceof MidiNote) {
        rootPitch = root.pitch;
      } else {
        throw new Error(
          'Function `scale` requires a scale array, a root note or pitch, and an integer interval',
        );
      }
      if (!(interval instanceof Int)) {
        throw new Error(
          'Function `scale` requires a scale array, a root note or pitch, and an integer interval',
        );
      }
      let base = interval.value;
      while (base < 0) {
        base += scale.items.length;
      }
      const offset = scale.items[base % scale.items.length] as Int;
      const octave = Math.floor(interval.value / scale.items.length);
      const pitch = rootPitch + octave * 12 + offset.value;
      if (root instanceof MidiNote) {
        return new MidiNote(pitch, root.duration, root.velocity);
      }
      return Int.from(pitch);
    },
  ),

  /**
   * shift(Arr): *
   * Shifts an item off of the beginning of an array.
   */
  new NativeFn(
    'shift',
    (_: VM, ...args: BaseObject[]): BaseObject => {
      const arr = args[0];
      if (args.length !== 1 || !(arr instanceof Arr)) {
        throw new Error(
          'Function `shift` takes a single array argument',
        );
      }
      return arr.items.shift() || NULL;
    },
  ),

  /**
   * sort(Arr): Arr
   * Given an array, returns a new array with the values sorted.
   */
  new NativeFn('sort', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error(
        'Function `sort` takes a single array argument',
      );
    }
    const items = arr.items.sort((a, b) => {
      let aVal = NaN;
      let bVal = NaN;
      if (a instanceof Int) {
        aVal = a.value;
      } else if (a instanceof Bool) {
        aVal = a.value ? 1 : 0;
      }
      if (b instanceof Int) {
        bVal = b.value;
      } else if (b instanceof Bool) {
        bVal = b.value ? 1 : 0;
      }
      if (isNaN(aVal) && isNaN(bVal)) return 0;
      if (isNaN(bVal)) return -1;
      if (isNaN(aVal)) return 1;
      return aVal - bVal;
    });
    return new Arr(items);
  }),

  /**
   * take(Seq, Int): Arr
   * Given a sequence and an integer `n`, returns an array containing
   * the next `n` items from the sequence.
   */
  new NativeFn(
    'take',
    (vm: VM, ...args: BaseObject[]): BaseObject => {
      const [seq, num] = args;
      if (
        args.length !== 2 ||
        !(seq instanceof Iterable) ||
        !(num instanceof Int)
      ) {
        throw new Error(
          'Function `take` requires a sequence object and an integer',
        );
      }
      const items: BaseObject[] = [];
      for (let i = 0; i < num.value; i++) {
        items.push(vm.takeNext(seq) || NULL);
      }
      return new Arr(items);
    },
  ),

  /**
   * vel(Note): Int
   * Given a MIDI note object, returns its velocity.
   */
  new NativeFn('vel', (_: VM, ...args: BaseObject[]): BaseObject => {
    const note = args[0];
    if (args.length !== 1 || !(note instanceof MidiNote)) {
      throw new Error(
        'Function `vel` takes a single MIDI note argument',
      );
    }
    return Int.from(note.velocity);
  }),
];

/**
 * Create a mapping of chord names to arrays of pitch intervals.
 *
 * @returns Object containing map of chord arrays by name
 *
 * @internal
 */
function createChordMap(): Record<string, BaseObject> {
  const CHORD_MAP: Record<string, number[]> = {
    ROOT_4: [0, 5],
    ROOT_5: [0, 7],
    ROOT_6: [0, 9],
    SUS_2: [0, 2, 7],
    SUS_4: [0, 5, 7],
    ROOT_5_ADD_9: [0, 7, 14],
    ROOT_6_ADD_9: [0, 9, 14],
    MAJ: [0, 4, 7],
    MIN: [0, 3, 7],
    MAJ_7: [0, 4, 7, 11],
    MIN_7: [0, 3, 7, 10],
    DOM_7: [0, 4, 7, 10],
    MIN_MAJ_7: [0, 3, 7, 11],
    MAJ_9: [0, 4, 7, 11, 14],
    MAJ_ADD_9: [0, 3, 7, 14],
    MIN_9: [0, 3, 7, 10, 14],
    MIN_ADD_9: [0, 3, 7, 14],
    DOM_9: [0, 4, 7, 10, 14],
    MAJ_11: [0, 4, 7, 11, 14, 17],
    MIN_11: [0, 3, 7, 10, 14, 17],
  };

  return Object.keys(CHORD_MAP).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: new Arr(
        CHORD_MAP[cur].map((interval) => Int.from(interval)),
      ),
    }),
    {},
  );
}

/**
 * Create a mapping of scale names to arrays of intervals.
 *
 * @returns Object containing map of scale arrays by name
 *
 * @internal
 */
function createScaleMap(): Record<string, BaseObject> {
  const SCALE_MAP: Record<string, number[]> = {
    SCALE_MAJOR: [0, 2, 4, 5, 7, 9, 11],
    SCALE_IONIAN: [0, 2, 4, 5, 7, 9, 11],
    SCALE_MINOR: [0, 2, 3, 5, 7, 8, 10],
    SCALE_AEOLIAN: [0, 2, 3, 5, 7, 8, 10],
    SCALE_DORIAN: [0, 2, 3, 5, 7, 9, 10],
    SCALE_PENT_MAJOR: [0, 2, 4, 7, 9],
    SCALE_PENT_MINOR: [0, 3, 5, 7, 10],
    SCALE_BLUES: [0, 3, 5, 6, 7, 10],
    SCALE_MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
    SCALE_PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
    SCALE_LYDIAN: [0, 2, 4, 6, 7, 9, 11],
    SCALE_LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
  };

  return Object.keys(SCALE_MAP).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: new Arr(
        SCALE_MAP[cur].map((interval) => Int.from(interval)),
      ),
    }),
    {},
  );
}

/**
 * Default global variables placed in scope on startup.
 *
 * @internal
 */
export const BUILTINS = {
  ...createChordMap(),
  ...MIDI_VALUES,
  ...createScaleMap(),
};

export const BUILTIN_KEYS = Object.keys(BUILTINS);
export const NATIVE_FN_KEYS = NATIVE_FNS.map((fn) => fn.label);
export const KNOWN_LABELS = [...BUILTIN_KEYS, ...NATIVE_FN_KEYS];
