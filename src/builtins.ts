import {
  Arr,
  BaseObject,
  Bool,
  Closure,
  Int,
  isTruthy,
  Iterable,
  NativeFn,
  Null,
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
   * conv(Arr): Seq
   * Converts an array into a one-shot sequence.
   */
  new NativeFn('conv', (_: VM, ...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (!(arr instanceof Arr)) {
      throw new Error(
        'Function `conv` takes a single array argument',
      );
    }
    return new VirtualSeq(arr, false);
  }),

  /**
   * cycle(Arr): Seq
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
      return new VirtualSeq(arr, true);
    },
  ),

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
        const res = vm.callAndReturn(fn, [item, new Int(i)]);
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
    return new Int(arr.items.length);
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
      vm.callAndReturn(fn, [item, new Int(i)]),
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
    return new Int(Math.max.apply(null, items));
  }),

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
    return new Int(Math.min.apply(null, items));
  }),

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
    (_: VM, ...args: BaseObject[]): BaseObject => {
      console.log(...args.map((arg) => arg.inspectObject()));
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
   * quant(Arr, Int, Int): Int
   * Given a scale, a root note, and an input note, calculates and
   * returns the next closest note that fits the scale.
   */
  new NativeFn('quant', (_: VM, ...args: BaseObject[]): BaseObject => {
    const [scale, root, note] = args;
    if (!(scale instanceof Arr) ||
        !scale.items.every((item) => item instanceof Int)) {
      throw new Error('Function `quant` requires the first argument to be an array of integers');
    }
    if (!(root instanceof Int) || !(note instanceof Int)) {
      throw new Error('Function `quant` requires a scale array, an integer root note, and a note to quantize');
    }
    let base = note.value - root.value;
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
    return new Int(root.value + octave * 12 + quantized);
  }),

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
    return new Int(Math.floor(Math.random() * hi.value));
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
        items.push(new Int(i));
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
      return new Int(x + Math.floor(Math.random() * (y - x)));
    },
  ),

  /**
   * scale(Arr, Int, Int): Int
   * Given a scale, a root note, and an interval, calculates and returns
   * the pitch value at that interval.
   */
  new NativeFn('scale', (_: VM, ...args: BaseObject[]): BaseObject => {
    const [scale, root, interval] = args;
    if (!(scale instanceof Arr) ||
        !scale.items.every((item) => item instanceof Int)) {
      throw new Error('Function `scale` requires the first argument to be an array of integers');
    }
    if (!(root instanceof Int) || !(interval instanceof Int)) {
      throw new Error('Function `scale` requires a scale array, an integer root note, and an integer interval');
    }
    let base = interval.value;
    while (base < 0) {
      base += scale.items.length;
    }
    const offset = scale.items[base % scale.items.length] as Int;
    const octave = Math.floor(interval.value / scale.items.length);
    return new Int(root.value + octave * 12 + offset.value);
  }),

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
];

/**
 * Create a mapping of scale names to arrays of intervals.
 *
 * @returns Object containing map of scale arrays by name
 *
 * @internal
 */
function createScaleMap(): Record<string, BaseObject> {
  const SCALE_MAP: Record<string, number[]> = {
    MAJOR: [0, 2, 4, 5, 7, 9, 11],
    IONIAN: [0, 2, 4, 5, 7, 9, 11],
    MINOR: [0, 2, 3, 5, 7, 8, 10],
    AEOLIAN: [0, 2, 3, 5, 7, 8, 10],
    DORIAN: [0, 2, 3, 5, 7, 9, 10],
    PENTA_MAJOR: [0, 2, 4, 7, 9],
    PENTA_MINOR: [0, 3, 5, 7, 10],
    BLUES: [0, 3, 5, 6, 7, 10],
    MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
    PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
    LYDIAN: [0, 2, 4, 6, 7, 9, 11],
    LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
  };

  return Object.keys(SCALE_MAP).reduce((acc, cur) => ({
    ...acc,
    [cur]: new Arr(SCALE_MAP[cur].map(interval => new Int(interval))),
  }), {});
}

/**
 * Create a mapping of notes (in scientific pitch notation) to their
 * corresponding integer MIDI pitch value.
 *
 * @returns Object containing integer MIDI value by note name
 *
 * @internal
 */
function createMidiMap(): Record<string, BaseObject> {
  const NOTE_NAMES: string[][] = [
    ['C'],
    ['C#', 'Db'],
    ['D'],
    ['D#', 'Eb'],
    ['E'],
    ['F'],
    ['F#', 'Gb'],
    ['G'],
    ['G#', 'Ab'],
    ['A'],
    ['A#', 'Bb'],
    ['B'],
  ];
  const midiMap: Record<string, BaseObject> = {};
  for (let midi = 0; midi < 128; midi++) {
    const oct = Math.floor(midi / 12) - 1;
    const names = NOTE_NAMES[midi % 12];
    if (!names) {
      continue;
    }
    names.forEach((n) => {
      midiMap[`${n}${oct < 0 ? '_1' : oct}`] = new Int(midi);
    });
  }
  return midiMap;
}

/**
 * Default global variables placed in scope on startup.
 *
 * @internal
 */
export const BUILTINS = {
  ...createMidiMap(),
  ...createScaleMap(),
};
