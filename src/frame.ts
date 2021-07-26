import { Bytecode } from './bytecode';
import { Func, Gen } from './object';

/**
 * Call "stack" frame (might not be in the call stack) representing
 * a function's execution context.
 */
export class Frame {
  /**
   * Instruction pointer
   */
  public ip: number;

  constructor(public callable: Func | Gen) {
    this.ip = -1;
  }

  /**
   * Gets the bytecode instructions of the callable function or generator.
   *
   * @returns Bytecode instructions
   */
  instructions(): Bytecode {
    return this.callable.instructions;
  }
}
