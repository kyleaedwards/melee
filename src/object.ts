/**
 * Melee object types.
 */

import { Bytecode } from './bytecode';
import type { VM } from './vm';

/**
 * Call "stack" frame (might not be in the call stack) representing
 * a function's execution context.
 *
 * @public
 */
export class Frame {
  /**
   * Instruction pointer
   */
  public ip: number;

  constructor(public closure: Closure, public base: number) {
    this.ip = -1;
  }

  /**
   * Gets the bytecode instructions of the callable function or generator.
   *
   * @returns Bytecode instructions
   */
  instructions(): Bytecode {
    return this.closure.fn.instructions;
  }
}

/**
 * Collection of frame and stack information representing
 * the current state of execution.
 *
 * @public
 */
export interface ExecutionState {
  stack: (BaseObject | undefined)[];
  sp: number;
  frames: Frame[];
  fp: number;
  parent?: ExecutionState;
  seq?: Seq;
}

/**
 * Object type label.
 *
 * @public
 */
export type Type =
  | 'null'
  | 'error'
  | 'note'
  | 'hold'
  | 'cc'
  | 'return'
  | 'yield'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'callable'
  | 'function'
  | 'native'
  | 'sequence'
  | 'generator'
  | 'closure'
  | 'free';

/**
 * Base object type interface.
 *
 * @public
 */
export interface BaseObject {
  type: Type;
  inspectObject: () => string;
}

/**
 * MIDI value object interface for use in Melee runtimes.
 *
 * @public
 */
export interface MidiValue {
  type: string;
  data: number[];
}

/**
 * MIDI object interface ensuring the object can be converted
 * into a MIDI value.
 *
 * @public
 */
export interface MidiObject {
  midiValue: () => MidiValue;
}

/**
 * Null type, contains no additional data.
 *
 * @public
 */
export class Null implements BaseObject {
  static self?: Null;

  type: Type = 'null';

  constructor() {
    if (!Null.self) {
      Null.self = this;
    }
    return Null.self;
  }

  inspectObject(): string {
    return 'null';
  }
}

/**
 * Error type. (To be implemented in the VM.)
 *
 * @public
 */
export class Err implements BaseObject {
  type: Type = 'error';

  constructor(public message: string) {}

  inspectObject(): string {
    return this.message;
  }
}

/**
 * Internal return type, should not be exposed to runtimes.
 *
 * @internal
 */
export class Return implements BaseObject {
  type: Type = 'return';

  constructor(public value: BaseObject) {}

  inspectObject(): string {
    return this.value.inspectObject();
  }
}

/**
 * Internal yield type, should not be exposed to runtimes.
 *
 * @internal
 */
export class Yield implements BaseObject {
  type: Type = 'yield';

  constructor(public value: BaseObject) {}

  inspectObject(): string {
    return this.value.inspectObject();
  }
}

/**
 * Integer type, contains a `value` property containing the implementation
 * language's value.
 *
 * @public
 */
export class Int implements BaseObject {
  static SMALL_VALUES: Int[] = new Array<Int>(512);
  type: Type = 'integer';

  constructor(public value: number) {}

  inspectObject(): string {
    return this.value.toString();
  }

  static from(value: number): Int {
    if (value < -256 || value > 255) {
      return new Int(value);
    }
    return Int.SMALL_VALUES[value + 256];
  }
}

for (let i = 0; i < 512; i++) {
  Int.SMALL_VALUES[i] = new Int(i - 256);
}

/**
 * Pre-generated integers
 */

/**
 * Boolean type, contains a `value` property containing the implementation
 * language's value.
 *
 * @public
 */
export class Bool implements BaseObject {
  static t?: Bool;
  static f?: Bool;

  type: Type = 'boolean';

  constructor(public value: boolean) {}

  inspectObject(): string {
    return this.value ? 'true' : 'false';
  }

  static from(value: boolean): Bool {
    return value ? Bool.t! : Bool.f!;
  }
}

Bool.t = new Bool(true);
Bool.f = new Bool(false);

/**
 * Array type, contains an array (in the implementation language) containing
 * child BaseObjects.
 *
 * @public
 */
export class Arr implements BaseObject {
  type: Type = 'array';

  constructor(public items: BaseObject[] = []) {}

  inspectObject(): string {
    return `[${this.items
      .map((item) => item.inspectObject())
      .join(', ')}]`;
  }
}

/**
 * Base callable class for functions and generators.
 *
 * @public
 */
export class Callable implements BaseObject {
  type: Type = 'callable';

  constructor(
    public instructions: Bytecode,
    public repr: string,
    public numLocals: number = 0,
    public numParams: number = 0,
  ) {}

  inspectObject(): string {
    return this.repr;
  }
}

/**
 * Callable function type.
 *
 * @public
 */
export class Fn extends Callable {
  type: Type = 'function';
}

/**
 * Callable generator type. Always returns a `Seq` object.
 *
 * @public
 */
export class Gen extends Callable {
  type: Type = 'generator';
}

/**
 * Melee object wrapping a native function definition.
 *
 * @public
 */
export class NativeFn implements BaseObject {
  type: Type = 'native';

  constructor(
    public label: string,
    public handler: (vm: VM, ...args: BaseObject[]) => BaseObject,
  ) {}

  inspectObject(): string {
    return `${this.label}() { <native code> }`;
  }
}

/**
 * Closure encapsulating scoped variables with a function or generator.
 *
 * @public
 */
export class Closure implements BaseObject {
  type: Type = 'closure';

  constructor(public fn: Callable, public vars: BaseObject[] = []) {}

  inspectObject(): string {
    return this.fn.inspectObject();
  }
}

/**
 * Base class for iterable sequences.
 *
 * @public
 */
export class Iterable implements BaseObject {
  type: Type = 'sequence';
  public done = false;

  inspectObject(): string {
    return `{seq status=${this.done ? 'done' : 'ongoing'}}`;
  }
}

/**
 * Sequence type, instance of a generator execution.
 *
 * @public
 */
export class Seq extends Iterable {
  type: Type = 'sequence';

  constructor(
    public generator: Closure,
    public executionState: ExecutionState,
  ) {
    super();
    this.executionState.seq = this; // Self-reference
  }
}

/**
 * Virtual sequence type, instance of an array of objects with
 * internal iteration state, so it can be used as a sequence.
 * It just so happens that for this virtual implementation,
 * the state (aside from the `done` boolean) is maintained
 * within a closure.
 *
 * @public
 */
export class VirtualSeq extends Iterable {
  type: Type = 'sequence';

  constructor(public next: () => BaseObject) {
    super();
  }
}

/**
 * MIDI note object to be used in musical runtimes.
 *
 * @public
 */
export class MidiNote implements BaseObject, MidiObject {
  type: Type = 'note';

  constructor(
    public pitch: number,
    public duration: number,
    public velocity: number,
  ) {}

  inspectObject(): string {
    if (this.pitch < 0) {
      return `{skip ${this.duration}}`;
    }
    return `{${NOTES[this.pitch]} for ${this.duration} vel=${
      this.velocity
    }}`;
  }

  midiValue(): MidiValue {
    return {
      type: this.type,
      data: [this.pitch, this.duration, this.velocity],
    };
  }

  scientificNotation(): string {
    return NOTES[this.pitch];
  }
}

/**
 * MIDI CC message object to be used in musical runtimes.
 *
 * @public
 */
export class MidiCC implements BaseObject, MidiObject {
  type: Type = 'cc';

  constructor(public key: number, public value: number) {}

  inspectObject(): string {
    return `{cc key=${this.key} val=${this.value}}`;
  }

  midiValue(): MidiValue {
    return {
      type: this.type,
      data: [this.key, this.value],
    };
  }
}

/**
 * Sentinel used to notify the runtime to skip over this
 * particular value (often because they should be obeying
 * a previous note's duration).
 *
 * @public
 */
export class Hold implements BaseObject {
  type: Type = 'hold';

  constructor(public pitch: number, public duration: number) {}

  inspectObject(): string {
    return `{hold ${this.duration}}`;
  }
}

/* Utilities */

const NULL = new Null();
const FALSE = Bool.from(false);

/**
 * Returns false if 0, null, or false, otherwise true.
 *
 * @param obj - Any object
 * @returns True if a truthy object
 *
 * @public
 */
export function isTruthy(obj: BaseObject | undefined): boolean {
  if (obj instanceof Int) {
    return obj.value !== 0;
  }
  return !(!obj || obj === NULL || obj === FALSE);
}

/**
 * Create a mapping of notes (in scientific pitch notation) to their
 * corresponding integer MIDI pitch value.
 */
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
const midi: Record<string, BaseObject> = {};
const notes: string[] = [];
for (let index = 0; index < 128; index++) {
  const oct = Math.floor(index / 12) - 1;
  const octStr = `${oct < 0 ? '_1' : oct}`;
  const names = NOTE_NAMES[index % 12];
  if (!names) {
    continue;
  }
  names.forEach((n) => {
    midi[`${n}${octStr}`] = Int.from(index);
  });
  notes.push(`${names[0]}${octStr}`);
}

export const MIDI_VALUES = midi;
export const NOTES = notes.map(n => n.replace(/_/g, '-'));

const MIDI_POOL_SIZE = 1000;
const MIDI_POOL: MidiNote[] = new Array<MidiNote>(MIDI_POOL_SIZE);

for (let i = 0; i < MIDI_POOL_SIZE; i++) {
  MIDI_POOL[i] = new MidiNote(-1, 1, 0);
}

let MIDI_POOL_INDEX = 0;
export function provisionMidiNote(pitch: number, duration: number, velocity: number) {
  const note = MIDI_POOL[MIDI_POOL_INDEX++];
  if (MIDI_POOL_INDEX >= MIDI_POOL_SIZE) {
    MIDI_POOL_INDEX = 0;
  }
  note.pitch = pitch;
  note.duration = duration;
  note.velocity = velocity;
  return note;
}

const HOLD_POOL_SIZE = 1000;
const HOLD_POOL: Hold[] = new Array<Hold>(HOLD_POOL_SIZE);

for (let i = 0; i < HOLD_POOL_SIZE; i++) {
  HOLD_POOL[i] = new Hold(-1, 0);
}

let HOLD_POOL_INDEX = 0;
export function provisionHold(pitch: number, duration: number) {
  const note = HOLD_POOL[HOLD_POOL_INDEX++];
  if (HOLD_POOL_INDEX >= HOLD_POOL_SIZE) {
    HOLD_POOL_INDEX = 0;
  }
  note.pitch = pitch;
  note.duration = duration;
  return note;
}
