import { AssertionError } from 'assert';
import {
  Opcode,
  createInstruction,
  Instruction,
} from '../src/bytecode';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { VM } from '../src/vm';
import * as obj from '../src/object';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

/**
 * Type assertion for objects.
 *
 * @param obj - Object to be compared
 * @param constructor - Constructor to confirm type
 *
 * @internal
 */
function assertObjectType<T extends obj.BaseObject>(
  obj: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  constructor: Constructor<T>,
): asserts obj is T {
  if (!(obj instanceof constructor)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message: 'Object is not correct type',
    });
  }
}

describe('VM', () => {
  test('should run integer operations through the virtual machine', () => {
    const inputs: [input: string, expected: number][] = [
      ['1', 1],
      ['2', 2],
      ['1 + 2', 3],
      ['1 - 2', -1],
      ['5 - 3', 2],
      ['5 * 3', 15],
      ['6 / 3', 2],
      ['5 / 3', 1],
      ['6 % 3', 0],
      ['5 % 3', 2],
    ];

    inputs.forEach(([input, expected]) => {
      const lexer = new Lexer(input);
      const parser = new Parser(lexer);
      const program = parser.parse();
      const compiler = new Compiler();
      compiler.compile(program);
      const vm = new VM(compiler);
      vm.run();

      const result = vm.lastElement();
      assertObjectType(result, obj.Int);
      expect(result.value).toEqual(expected);
    });
  });

  test('should run boolean operations through the virtual machine', () => {
    const inputs: [input: string, expected: boolean][] = [
      ['true', true],
      ['false', false],
    ];

    inputs.forEach(([input, expected]) => {
      const lexer = new Lexer(input);
      const parser = new Parser(lexer);
      const program = parser.parse();
      const compiler = new Compiler();
      compiler.compile(program);
      const vm = new VM(compiler);
      vm.run();

      const result = vm.lastElement();
      assertObjectType(result, obj.Bool);
      expect(result.value).toEqual(expected);
    });
  });
});
