import { Arr, BaseObject, Bool, Int, NativeFn, Null } from './object';

const NULL = new Null();

/**
 * Collection of native function implementations that cannot be implemented
 * as easily with the compiled code itself.
 *
 * @internal
 */
export const NATIVE_FNS: NativeFn[] = [
  new NativeFn('len', (...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `len` takes a single array argument');
    }
    return new Int(arr.items.length);
  }),
  new NativeFn('concat', (...args: BaseObject[]): BaseObject => {
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
  }),
  new NativeFn('min', (...args: BaseObject[]): BaseObject => {
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
  new NativeFn('max', (...args: BaseObject[]): BaseObject => {
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
  new NativeFn('sort', (...args: BaseObject[]): BaseObject => {
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
  new NativeFn('rev', (...args: BaseObject[]): BaseObject => {
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
  new NativeFn('push', (...args: BaseObject[]): BaseObject => {
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
  new NativeFn('pop', (...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `pop` takes a single array argument');
    }
    return arr.items.pop() || NULL;
  }),
  new NativeFn('shift', (...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error(
        'Function `shift` takes a single array argument',
      );
    }
    return arr.items.shift() || NULL;
  }),
  new NativeFn('rand', (...args: BaseObject[]): BaseObject => {
    const hi = args[0];
    if (args.length !== 1 || !(hi instanceof Int)) {
      throw new Error(
        'Function `rand(num)` takes a single integer argument, which returns a number from 0 up to, but not including, num',
      );
    }
    return new Int(Math.floor(Math.random() * hi.value));
  }),
  new NativeFn('rrand', (...args: BaseObject[]): BaseObject => {
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
  }),
  new NativeFn('print', (...args: BaseObject[]): BaseObject => {
    console.log(...args.map((arg) => arg.inspectObject()));
    return NULL;
  }),
];

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
};
