import { Bytecode, Opcode, unpackBigEndian } from './bytecode';
import { Compiler } from './compiler';
import * as obj from './object';

/**
 * Constants
 */
const MAXIMUM_STACK_SIZE = 1024;

/**
 * Virtual stack machine for executing instructions.
 */
export class VM {
  public instructions: Bytecode;
  public constants: obj.BaseObject[];
  public stack: (obj.BaseObject | undefined)[];
  public sp: number;
  public ip: number;

  /**
   * Constructs a new VM instance.
   *
   * @param compiler - Compiler instance
   */
  constructor(compiler: Compiler) {
    this.instructions = compiler.instructions;
    this.constants = compiler.constants;
    this.stack = new Array<obj.BaseObject | undefined>(
      MAXIMUM_STACK_SIZE,
    );
    this.sp = 0;
    this.ip = 0;
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
    if (this.sp >= MAXIMUM_STACK_SIZE) {
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
   * Iterates over the compiler instructions item-by-item, using the
   * stack to hold values and perform operations.
   */
  run(): void {
    for (; this.ip < this.instructions.length; this.ip++) {
      const op = this.instructions[this.ip];

      switch (op) {
        case Opcode.CONST: {
          const idx = unpackBigEndian(
            this.instructions,
            this.ip + 1,
            2,
          );
          this.ip += 2;
          this.push(this.constants[idx]);
          break;
        }
        case Opcode.POP: {
          this.pop();
          break;
        }
        case Opcode.ADD:
        case Opcode.SUB:
        case Opcode.MUL:
        case Opcode.DIV:
        case Opcode.MOD:
          this.execBinaryOperation(op);
          break;
        case Opcode.TRUE:
          this.push(obj.TRUE);
          break;
        case Opcode.FALSE:
          this.push(obj.FALSE);
          break;
      }
    }
  }

  /**
   * Pops the last two items off of the stack, performs a binary
   * operation, and pushes its result onto the stack.
   *
   * @param op - Opcode byte
   */
  execBinaryOperation(op: Opcode): void {
    const left = this.stack[this.sp - 2];
    const right = this.stack[this.sp - 1];
    this.sp -= 2;

    if (left instanceof obj.Int && right instanceof obj.Int) {
      this.execBinaryIntegerOperation(op, left, right);
      return;
    }

    if (!left || !right) {
      throw new Error(
        'Cannot perform binary operation without two operands',
      );
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
  execBinaryIntegerOperation(
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
}
