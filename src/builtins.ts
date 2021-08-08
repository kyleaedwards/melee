import { Arr, BaseObject, Int, NativeFn, NULL } from './object';

export const NATIVE_FNS: NativeFn[] = [
  new NativeFn('len', (...args: BaseObject[]): BaseObject => {
    const arr = args[0];
    if (args.length !== 1 || !(arr instanceof Arr)) {
      throw new Error('Function `len` takes a single array argument');
    }
    return new Int(arr.items.length);
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
        'Function `rand(num)` takes a single integer argument, which returns a number between 1 and the argument inclusively',
      );
    }
    return new Int(Math.ceil(Math.random() * hi.value));
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
        'Function `rrand(lo, hi)` takes a two integer arguments, the beginning and end of a range of numbers, one of which will be returned at random',
      );
    }
    return new Int(
      lo.value +
        Math.floor(Math.random() * (hi.value + 1 - lo.value)),
    );
  }),
  new NativeFn('print', (...args: BaseObject[]): BaseObject => {
    console.log(...args.map((arg) => arg.inspectObject()));
    return NULL;
  }),
];

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

function midiToSPN(): Record<string, BaseObject> {
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

const MIDI_MAP = midiToSPN();

export const BUILTINS = {
  ...MIDI_MAP,
};
