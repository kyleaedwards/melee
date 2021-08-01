import { AssertionError } from 'assert';
import { Opcode, unpackBigEndian } from './bytecode';
import { Compiler } from './compiler';
import { Frame } from './frame';
import * as obj from './object';

/**
 * Constants
 */
const MAX_FRAME_SIZE = 1024;
const MAX_STACK_SIZE = 1024;
const MAX_VARIABLES = 65536;

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
  constructor(compiler: Compiler) {
    this.constants = compiler.constants;
    this.frames = new Array<Frame>(MAX_FRAME_SIZE);
    this.stack = new Array<obj.BaseObject | undefined>(
      MAX_STACK_SIZE,
    );
    this.variables = new Array<obj.BaseObject | undefined>(
      MAX_VARIABLES,
    );
    this.fp = 1;
    this.sp = 0;

    this.frames[0] = new Frame(
      new obj.Func(compiler.instructions(), '<MAIN>'),
      0,
    );
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
   * @param offset - Number of bytes into instruction
   * @param width - Byte width of operand
   * @internal
   */
  readOperand(offset: number, width: number): number {
    const frame = this.frame();
    const operand = unpackBigEndian(
      frame.instructions(),
      frame.ip + offset,
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
          const idx = this.readOperand(1, 2);
          this.push(this.constants[idx]);
          break;
        }
        case Opcode.ARRAY: {
          const size = this.readOperand(1, 2);
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
          const index = this.readOperand(1, 2);
          this.variables[index] = this.pop();
          break;
        }
        case Opcode.GETG: {
          const index = this.readOperand(1, 2);
          const value = this.variables[index];
          assertVariableObject(value);
          this.push(value);
          break;
        }
        case Opcode.SET: {
          const index = this.readOperand(1, 1);
          this.stack[this.frame().base + index] = this.pop();
          break;
        }
        case Opcode.GET: {
          const index = this.readOperand(1, 1);
          const value = this.stack[this.frame().base + index];
          assertVariableObject(value);
          this.push(value);
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
          const numArgs = this.readOperand(1, 1);
          const fn = this.stack[this.sp - 1 - numArgs];
          assertStackObject(fn);
          if (!(fn instanceof obj.Callable)) {
            throw new Error(
              'Cannot perform opcode CALL on a non-callable stack element',
            );
          }
          frame = new Frame(fn, this.sp - numArgs);
          this.sp += fn.numLocals;
          inst = frame.instructions();
          this.frames[this.fp] = frame;
          this.fp++;
          break;
        }
        case Opcode.RET: {
          const value = this.pop();
          if (!value) {
            throw new Error('Functions must return an explicit value or an implicit null');
          }
          this.fp--;
          frame = this.frame();
          inst = frame.instructions();
          this.sp = frame.base - 1;
          this.push(value);
          break;
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
