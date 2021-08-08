import { AssertionError } from 'assert';
import { BUILTINS, NATIVE_FNS } from './builtins';
import { Opcode, unpackBigEndian } from './bytecode';
import { Compiler } from './compiler';
import { Frame } from './frame';
import * as obj from './object';

/**
 * Constants
 */
export const MAX_FRAME_SIZE = 1024;
export const MAX_STACK_SIZE = 1024;
export const MAX_VARIABLES = 65536;

/**
 * Asserts stack object is defined.
 *
 * @param obj - Object to be compared
 *
 * @internal
 */
function assertStackObject(
  obj: obj.BaseObject | undefined,
): asserts obj is obj.BaseObject {
  if (typeof obj === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message:
        'Attempting to access undeclared stack space. This is an error in the compiler.',
    });
  }
}

/**
 * Asserts variable object is defined.
 *
 * @param obj - Object to be compared
 *
 * @internal
 */
function assertVariableObject(
  obj: obj.BaseObject | undefined,
): asserts obj is obj.BaseObject {
  if (typeof obj === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message:
        'Attempting to access undeclared variable space. This is an error in the compiler.',
    });
  }
}

/**
 * Create a new repository of global variables that have native values
 * already populated.
 *
 * @param builtins - A hashmap containing any default variables
 * @returns Array of global variables
 *
 * @internal
 */
export function createGlobalVariables(
  builtins: Record<string, obj.BaseObject> = {},
): (obj.BaseObject | undefined)[] {
  const globals = new Array<obj.BaseObject | undefined>(
    MAX_VARIABLES,
  );
  const allBuiltins = { ...BUILTINS, ...builtins };
  Object.keys(allBuiltins).forEach((key, i) => {
    if (allBuiltins[key]) {
      globals[i] = allBuiltins[key];
    }
  });
  return globals;
}

/**
 * Virtual stack machine for executing instructions.
 */
export class VM {
  public constants: obj.BaseObject[];
  public variables: (obj.BaseObject | undefined)[];

  public stack: (obj.BaseObject | undefined)[];
  public sp: number;

  public frames: Frame[];
  public fp: number;

  /**
   * Constructs a new VM instance.
   *
   * @param compiler - Compiler instance
   */
  constructor(
    compiler: Compiler,
    variables?: (obj.BaseObject | undefined)[],
  ) {
    this.constants = compiler.constants;
    this.frames = new Array<Frame>(MAX_FRAME_SIZE);
    this.stack = new Array<obj.BaseObject | undefined>(
      MAX_STACK_SIZE,
    );
    this.variables = variables || createGlobalVariables();
    this.fp = 1;
    this.sp = 0;

    this.frames[0] = new Frame(
      new obj.Closure(new obj.Fn(compiler.instructions(), '<MAIN>')),
      0,
    );
  }

  /**
   * Pretty-prints information about the VM state.
   *
   * @returns Stringified stack items
   */
  printState(): string {
    let curr = this.sp;
    let output = `SP ${curr}\n`;
    output += `FRAME ${this.frame().closure.inspectObject()}\n`;
    output += `CVARS\n${this.frame()
      .closure.vars.map((n, i) => `  ${i}: ${n.inspectObject()}`)
      .join('\n')}\n`;
    output += `CONSTS\n${this.constants
      .map((n, i) => `  ${i}: ${n.inspectObject()}`)
      .join('\n')}\n\n`;
    while (curr > 0 && curr--) {
      const item = this.stack[curr];
      const stackAddress = `0000${curr}`.slice(-5);
      output += `${stackAddress} ${
        item ? item.inspectObject() : '<undef>'
      }\n`;
    }
    return output;
  }

  /**
   * Returns the current frame object.
   *
   * @returns Current frame
   *
   * @internal
   */
  frame(): Frame {
    return this.frames[this.fp - 1];
  }

  /**
   * Returns the next object on the stack, or undefined if the
   * stack is empty.
   *
   * @returns Next stack object
   */
  peek(): obj.BaseObject | undefined {
    if (this.sp === 0) {
      return undefined;
    }
    return this.stack[this.sp - 1];
  }

  /**
   * Returns the last object popped off the top of the stack, or
   * undefined if the stack is empty.
   *
   * @returns Next stack object
   */
  lastElement(): obj.BaseObject | undefined {
    return this.stack[this.sp];
  }

  /**
   * Pushes a new object onto the VM stack and increments
   * the stack pointer.
   *
   * @param o - New object
   */
  push(o: obj.BaseObject): void {
    if (this.sp >= MAX_STACK_SIZE) {
      throw new Error('Maximum stack size exceeded');
    }
    this.stack[this.sp] = o;
    this.sp++;
  }

  /**
   * Pops a new object off the VM stack and decrements
   * the stack pointer.
   *
   * @param o - New object
   */
  pop(): obj.BaseObject | undefined {
    const o = this.stack[this.sp - 1];
    this.sp--;
    return o;
  }

  /**
   * Jumps to next instruction specified by the next two instruction
   * bytes.
   *
   * @internal
   */
  jump(): void {
    const frame = this.frame();
    const destination = unpackBigEndian(
      frame.instructions(),
      frame.ip + 1,
      2,
    );
    frame.ip = destination - 1;
  }

  /**
   * Reads operand at offset.
   *
   * @param width - Byte width of operand
   * @internal
   */
  readOperand(width: number): number {
    const frame = this.frame();
    const operand = unpackBigEndian(
      frame.instructions(),
      frame.ip + 1,
      width,
    );
    frame.ip += width;
    return operand;
  }

  /**
   * Iterates over the compiler instructions item-by-item, using the
   * stack to hold values and perform operations.
   */
  run(): void {
    let frame = this.frame();
    let inst = frame.instructions();
    while (frame.ip <= inst.length) {
      frame.ip++;
      const ip = frame.ip;
      const op = inst[ip];

      switch (op) {
        case Opcode.CONST: {
          const idx = this.readOperand(2);
          this.push(this.constants[idx]);
          break;
        }
        case Opcode.CLOSURE: {
          const idx = this.readOperand(2);
          const numFree = this.readOperand(1);
          const fn = this.constants[idx];
          if (!(fn instanceof obj.Callable)) {
            throw new Error(
              'Cannot enclose non-callable inside a closure',
            );
          }
          const closureVars = numFree
            ? new Array<obj.BaseObject>(numFree)
            : [];
          for (let i = 0; i < numFree; i++) {
            const item = this.stack[this.sp - numFree + i];
            if (!item) {
              throw new Error(
                'Stack out of usable objects for closure variables',
              );
            }
            closureVars[i] = item;
          }
          this.sp -= numFree;
          this.push(new obj.Closure(fn, closureVars));
          break;
        }
        case Opcode.SELF:
          this.push(this.frame().closure);
          break;
        case Opcode.ARRAY: {
          const size = this.readOperand(2);
          const arr = new obj.Arr(new Array(size));
          const start = this.sp - size;
          for (let i = start; i < this.sp; i++) {
            const element = this.stack[i];
            assertStackObject(element);
            arr.items[i - start] = element;
          }
          this.sp -= size;
          this.push(arr);
          break;
        }
        case Opcode.INDEX: {
          const index = this.pop();
          if (!(index instanceof obj.Int)) {
            throw new Error('Array index must be an integer');
          }
          const collection = this.pop();
          if (!(collection instanceof obj.Arr)) {
            throw new Error(
              'Cannot retrieve an element from a non-array',
            );
          }
          this.push(collection.items[index.value] ?? obj.NULL);
          break;
        }
        case Opcode.POP: {
          this.pop();
          break;
        }
        case Opcode.TRUE:
          this.push(obj.TRUE);
          break;
        case Opcode.FALSE:
          this.push(obj.FALSE);
          break;
        case Opcode.NULL:
          this.push(obj.NULL);
          break;
        case Opcode.SETG: {
          const index = this.readOperand(2);
          this.variables[index] = this.pop();
          break;
        }
        case Opcode.GETG: {
          const index = this.readOperand(2);
          const value = this.variables[index];
          assertVariableObject(value);
          this.push(value);
          break;
        }
        case Opcode.SET: {
          const index = this.readOperand(1);
          this.stack[this.frame().base + index] = this.pop();
          break;
        }
        case Opcode.GET: {
          const index = this.readOperand(1);
          const value = this.stack[this.frame().base + index];
          assertVariableObject(value);
          this.push(value);
          break;
        }
        case Opcode.SETC: {
          const index = this.readOperand(1);
          const value = this.pop();
          assertVariableObject(value);
          this.frame().closure.vars[index] = value;
          break;
        }
        case Opcode.GETC: {
          const index = this.readOperand(1);
          const value = this.frame().closure.vars[index];
          assertVariableObject(value);
          this.push(value);
          break;
        }
        case Opcode.GETN: {
          const index = this.readOperand(1);
          const fn = NATIVE_FNS[index];
          if (fn) {
            this.push(fn);
          }
          break;
        }
        case Opcode.BANG:
          this.execUnaryLogicalNegation();
          break;
        case Opcode.MINUS:
          this.execUnaryArithmeticNegation();
          break;
        case Opcode.ADD:
        case Opcode.SUB:
        case Opcode.MUL:
        case Opcode.DIV:
        case Opcode.MOD:
          this.execBinaryArithmetic(op);
          break;
        case Opcode.EQ:
        case Opcode.NOT_EQ:
        case Opcode.GT:
        case Opcode.GTE:
          this.execComparison(op);
          break;
        case Opcode.JMP:
          this.jump();
          break;
        case Opcode.JMP_IF_NOT:
          if (!obj.isTruthy(this.pop())) {
            this.jump();
          } else {
            frame.ip += 2;
          }
          break;
        case Opcode.CALL: {
          let numArgs = this.readOperand(1);
          const o = this.stack[this.sp - 1 - numArgs];
          assertStackObject(o);
          if (
            !(o instanceof obj.Closure) &&
            !(o instanceof obj.NativeFn)
          ) {
            throw new Error(
              'Cannot perform opcode CALL on a non-callable stack element',
            );
          }
          if (o instanceof obj.Closure) {
            while (numArgs > o.fn.numParams) {
              this.pop();
              numArgs--;
            }
            while (numArgs < o.fn.numParams) {
              this.push(obj.NULL);
              numArgs++;
            }
            frame = new Frame(o, this.sp - numArgs);
            inst = frame.instructions();
            this.frames[this.fp] = frame;
            this.fp++;
            this.sp = frame.base + o.fn.numLocals;
          } else if (o instanceof obj.NativeFn) {
            const args: obj.BaseObject[] = [];
            while (numArgs--) {
              const arg = this.pop();
              assertStackObject(arg);
              args.unshift(arg);
            }
            this.sp -= numArgs + 1;
            this.push(o.handler(...args));
          }
          break;
        }
        case Opcode.RET: {
          const closureVars = this.frame().closure.vars;
          const value = this.pop();
          if (!value) {
            throw new Error(
              'Functions must return an explicit value or an implicit null',
            );
          }
          this.fp--;
          this.sp = frame.base - 1;
          frame = this.frames[this.fp - 1];
          inst = frame.instructions();
          for (let i = 0; i < closureVars.length; i++) {
            this.stack[frame.base + i] = closureVars[i];
          }
          this.push(value);
          break;
        }
        case Opcode.NOTE: {
          const value = this.pop();
          if (
            !value ||
            !(value instanceof obj.Arr) ||
            !value.items.length
          ) {
            throw new Error(
              'Notes must be created with an array containing at least one argument',
            );
          }
          const pitch = value.items[0];
          if (!(pitch instanceof obj.Int)) {
            throw new Error(
              'MIDI note pitch must be an integer or a pitch literal like Eb4',
            );
          }
          const duration = value.items[1];
          let durationValue = 1;
          if (duration) {
            if (!(duration instanceof obj.Int)) {
              throw new Error(
                'MIDI note duration must be an integer',
              );
            }
            durationValue = Math.max(1, duration.value);
          }
          const velocity = value.items[2];
          let velocityValue = 64;
          if (velocity) {
            if (!(velocity instanceof obj.Int)) {
              throw new Error(
                'MIDI note velocity must be an integer',
              );
            }
            velocityValue = Math.min(
              127,
              Math.max(0, velocity.value),
            );
          }
          this.push(
            new obj.MidiNote(
              pitch.value,
              durationValue,
              velocityValue,
            ),
          );
        }
      }
    }
  }

  /**
   * Pops the last item off of the stack, performs a unary
   * arithmetic negation, and pushes its result onto the stack.
   */
  execUnaryArithmeticNegation(): void {
    const right = this.pop();

    if (!right) {
      throw new Error(
        'Cannot perform unary operation without a valid operand',
      );
    }

    if (right instanceof obj.Int) {
      this.push(new obj.Int(-right.value));
      return;
    }

    throw new Error(
      `Cannot perform unary arithmetic negation (-) operation on a non-integer`,
    );
  }

  /**
   * Pops the last item off of the stack, performs a unary
   * logical negation, and pushes its result onto the stack.
   */
  execUnaryLogicalNegation(): void {
    const right = this.pop();

    if (!right) {
      throw new Error(
        'Cannot perform unary operation without a valid operand',
      );
    }

    if (right instanceof obj.Int) {
      this.push(obj.Bool.from(right.value !== 0));
    } else if (right === obj.NULL || right === obj.FALSE) {
      this.push(obj.TRUE);
    } else {
      this.push(obj.FALSE);
    }
  }

  /**
   * Pops the last two items off of the stack, performs a binary
   * operation, and pushes its result onto the stack.
   *
   * @param op - Opcode byte
   */
  execBinaryArithmetic(op: Opcode): void {
    const left = this.stack[this.sp - 2];
    const right = this.stack[this.sp - 1];
    this.sp -= 2;

    if (!left || !right) {
      throw new Error(
        'Cannot perform binary operation without two operands',
      );
    }

    if (left instanceof obj.Int && right instanceof obj.Int) {
      this.execBinaryIntegerArithmetic(op, left, right);
      return;
    }

    throw new Error(
      `Cannot perform binary operation between types ${left.type} and ${right.type}`,
    );
  }

  /**
   * Executes a binary (infix) integer operation and pushes the result
   * onto the stack.
   *
   * @param op - Opcode byte
   * @param left - Left operand
   * @param right - Right operand
   */
  execBinaryIntegerArithmetic(
    op: Opcode,
    left: obj.Int,
    right: obj.Int,
  ): void {
    let result: number;

    switch (op) {
      case Opcode.ADD:
        result = left.value + right.value;
        break;
      case Opcode.SUB:
        result = left.value - right.value;
        break;
      case Opcode.MUL: {
        result = left.value * right.value;
        break;
      }
      case Opcode.DIV: {
        result = Math.floor(left.value / right.value);
        break;
      }
      case Opcode.MOD: {
        result = left.value % right.value;
        break;
      }
      default:
        throw new Error(`Unhandled binary integer operator: ${op}`);
    }

    this.push(new obj.Int(result));
  }

  /**
   * Pops the last two items off of the stack, performs a comparison
   * operation, and pushes its result onto the stack.
   *
   * @param op - Opcode byte
   */
  execComparison(op: Opcode): void {
    const left = this.stack[this.sp - 2];
    const right = this.stack[this.sp - 1];
    this.sp -= 2;

    if (left instanceof obj.Int && right instanceof obj.Int) {
      this.execIntegerComparison(op, left, right);
      return;
    }

    if (left instanceof obj.Bool && right instanceof obj.Bool) {
      switch (op) {
        case Opcode.EQ:
          this.push(obj.Bool.from(left === right));
          break;
        case Opcode.NOT_EQ:
          this.push(obj.Bool.from(left !== right));
          break;
        default:
          throw new Error(
            `Unhandled boolean comparison operator: ${op}`,
          );
      }
      return;
    }

    if (!left || !right) {
      throw new Error(
        'Cannot perform comparison operation without two operands',
      );
    }

    throw new Error(
      `Cannot perform comparison operation between types ${left.type} and ${right.type}`,
    );
  }

  /**
   * Executes an integer comparison operation and pushes the result
   * onto the stack.
   *
   * @param op - Opcode byte
   * @param left - Left operand
   * @param right - Right operand
   */
  execIntegerComparison(
    op: Opcode,
    left: obj.Int,
    right: obj.Int,
  ): void {
    let result: boolean;

    switch (op) {
      case Opcode.EQ:
        result = left.value === right.value;
        break;
      case Opcode.NOT_EQ:
        result = left.value !== right.value;
        break;
      case Opcode.GT:
        result = left.value > right.value;
        break;
      case Opcode.GTE:
        result = left.value >= right.value;
        break;
      default:
        throw new Error(
          `Unhandled integer comparison operator: ${op}`,
        );
    }

    this.push(obj.Bool.from(result));
  }
}
