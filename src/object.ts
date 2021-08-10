/**
 * Melee object types.
 */

import { Bytecode } from './bytecode';

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
  type: Type = 'integer';

  constructor(public value: number) {}

  inspectObject(): string {
    return this.value.toString();
  }
}

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

  constructor(public value: boolean) {
    if (value) {
      if (!Bool.t) Bool.t = this;
      return Bool.t;
    }
    if (!Bool.f) Bool.f = this;
    return Bool.f;
  }

  inspectObject(): string {
    return this.value ? 'true' : 'false';
  }
}

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
    public handler: (...args: BaseObject[]) => BaseObject,
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
 * Sequence type, instance of a generator execution.
 *
 * @public
 */
export class Seq implements BaseObject {
  type: Type = 'sequence';
  public done: boolean;

  constructor(
    public generator: Closure,
    public executionState: ExecutionState,
  ) {
    this.done = false;
    this.executionState.seq = this; // Self-reference
  }

  inspectObject(): string {
    return `seq::[${this.done ? 'done' : 'ongoing'}]`;
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
      return `skip::${this.duration}`;
    }
    return `note::[${this.pitch}, ${this.duration}, ${this.velocity}]`;
  }

  midiValue(): MidiValue {
    return {
      type: this.type,
      data: [this.pitch, this.duration, this.velocity],
    };
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
    return `cc::[${this.key}, ${this.value}]`;
  }

  midiValue(): MidiValue {
    return {
      type: this.type,
      data: [this.key, this.value],
    };
  }
}

/* Utilities */

const NULL = new Null();
const FALSE = new Bool(false);

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
