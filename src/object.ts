import { Bytecode } from './bytecode';

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

export interface BaseObject {
  type: Type;
  inspectObject: () => string;
}

export interface MidiValue {
  type: string;
  data: number[];
}

export interface MidiObject {
  midiValue: () => MidiValue;
}

export type NativeFnHandler = (...args: BaseObject[]) => BaseObject;

export class Null implements BaseObject {
  type: Type = 'null';

  inspectObject(): string {
    return 'null';
  }
}

export class Err implements BaseObject {
  type: Type = 'error';

  constructor(public message: string) {}

  inspectObject(): string {
    return this.message;
  }
}

export class Return implements BaseObject {
  type: Type = 'return';

  constructor(public value: BaseObject) {}

  inspectObject(): string {
    return this.value.inspectObject();
  }
}

export class Yield implements BaseObject {
  type: Type = 'yield';

  constructor(public value: BaseObject) {}

  inspectObject(): string {
    return this.value.inspectObject();
  }
}

export class Int implements BaseObject {
  type: Type = 'integer';

  constructor(public value: number) {}

  inspectObject(): string {
    return this.value.toString();
  }
}

export class Bool implements BaseObject {
  type: Type = 'boolean';

  constructor(public value: boolean) {}

  inspectObject(): string {
    return this.value ? 'true' : 'false';
  }

  static from(value: boolean): Bool {
    return value ? TRUE : FALSE;
  }
}

export class Arr implements BaseObject {
  type: Type = 'array';

  constructor(public items: BaseObject[] = []) {}

  inspectObject(): string {
    return `[${this.items
      .map((item) => item.inspectObject())
      .join(', ')}]`;
  }
}

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

export class Fn extends Callable {
  type: Type = 'function';
}

export class Gen extends Callable {
  type: Type = 'generator';
}

export class NativeFn implements BaseObject {
  type: Type = 'native';

  constructor(
    public label: string,
    public handler: NativeFnHandler,
  ) {}

  inspectObject(): string {
    return `${this.label}() { <native code> }`;
  }
}

export class Closure implements BaseObject {
  type: Type = 'closure';

  constructor(public fn: Callable, public vars: BaseObject[] = []) {}

  inspectObject(): string {
    return `closure::${this.fn.inspectObject()}`;
  }
}

export class Seq implements BaseObject {
  type: Type = 'sequence';
  public curr: number;
  public position: number[];
  public done: boolean;

  constructor(
    public generator: Gen,
    public environment: Environment,
  ) {
    this.curr = 0;
    this.position = [0];
    this.done = false;
  }

  inspectObject(): string {
    return `seq::${this.done ? 'done' : 'ongoing'}]`;
  }
}

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

export class Environment {
  store: Record<string, BaseObject>;

  constructor(
    public context: 'global' | 'function' | 'sequence',
    public parent?: Environment,
  ) {
    this.store = {};
  }

  get(label: string): BaseObject {
    if (this.store[label]) {
      return this.store[label];
    }
    if (this.parent) {
      return this.parent.get(label);
    }
    return new Err(`Identifier read before it was defined: ${label}`);
  }

  declare(label: string, value: BaseObject): BaseObject {
    this.store[label] = value;
    return value;
  }

  set(label: string, value: BaseObject): BaseObject {
    if (this.store[label]) {
      this.store[label] = value;
      return value;
    }
    if (this.parent) {
      return this.parent.set(label, value);
    }
    return new Err(`Identifier set before it was defined: ${label}`);
  }
}

/* Literals */

export const NULL = new Null();
export const TRUE = new Bool(true);
export const FALSE = new Bool(false);

/* Utilities */

/**
 * Returns false if 0, null, or false, otherwise true.
 *
 * @param obj - Any object
 * @returns True if a truthy object
 */
export function isTruthy(obj: BaseObject | undefined): boolean {
  if (obj instanceof Int) {
    return obj.value !== 0;
  }
  return !(!obj || obj === NULL || obj === FALSE);
}

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
];
