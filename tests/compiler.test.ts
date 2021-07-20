import { AssertionError } from 'assert';
import {
  Opcode,
  createInstruction,
  Instruction,
} from '../src/bytecode';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
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

describe('Compiler.compile', () => {
  test('should compile integer expressions', () => {
    const inputs: [
      input: string,
      constants: (number | string)[],
      instructions: Instruction[],
    ][] = [
      [
        '1; 99',
        [1, 99],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '3 + 4',
        [3, 4],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.ADD),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '4 > 3',
        [4, 3],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.GT),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '4 < 3',
        [3, 4],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.GT),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '4 >= 3',
        [4, 3],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.GTE),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '4 <= 3',
        [3, 4],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.GTE),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        '3 != 4',
        [3, 4],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.NOT_EQ),
          createInstruction(Opcode.POP),
        ],
      ],
    ];

    inputs.forEach(([input, constants, instructions]) => {
      const lexer = new Lexer(input);
      const parser = new Parser(lexer);
      const program = parser.parse();
      const compiler = new Compiler();
      compiler.compile(program);

      expect(compiler.constants.length).toEqual(constants.length);
      for (let i = 0; i < constants.length; i++) {
        const expected = constants[i];
        const actual = compiler.constants[i];
        if (typeof expected === 'number') {
          assertObjectType(actual, obj.Int);
          expect(actual.value).toEqual(expected);
        }
      }

      const actualBytecode = compiler.instructions;
      const bytecodeLength = instructions.reduce(
        (acc, cur) => acc + cur.length,
        0,
      );
      const expectedBytecode = new Uint8Array(bytecodeLength);
      let offset = 0;
      instructions.forEach((inst) => {
        expectedBytecode.set(inst, offset);
        offset += inst.length;
      });

      expect(actualBytecode.length).toEqual(bytecodeLength);
      for (let i = 0; i < bytecodeLength; i++) {
        expect(actualBytecode[i]).toEqual(expectedBytecode[i]);
      }
    });
  });

  test('should compile boolean expressions', () => {
    const inputs: [
      input: string,
      constants: (number | string)[],
      instructions: Instruction[],
    ][] = [
      [
        'true; false',
        [],
        [
          createInstruction(Opcode.TRUE),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.FALSE),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        'true != false',
        [],
        [
          createInstruction(Opcode.TRUE),
          createInstruction(Opcode.FALSE),
          createInstruction(Opcode.NOT_EQ),
          createInstruction(Opcode.POP),
        ],
      ],
    ];

    inputs.forEach(([input, constants, instructions]) => {
      const lexer = new Lexer(input);
      const parser = new Parser(lexer);
      const program = parser.parse();
      const compiler = new Compiler();
      compiler.compile(program);

      expect(compiler.constants.length).toEqual(constants.length);
      for (let i = 0; i < constants.length; i++) {
        const expected = constants[i];
        const actual = compiler.constants[i];
        if (typeof expected === 'number') {
          assertObjectType(actual, obj.Int);
          expect(actual.value).toEqual(expected);
        }
      }

      const actualBytecode = compiler.instructions;
      const bytecodeLength = instructions.reduce(
        (acc, cur) => acc + cur.length,
        0,
      );
      const expectedBytecode = new Uint8Array(bytecodeLength);
      let offset = 0;
      instructions.forEach((inst) => {
        expectedBytecode.set(inst, offset);
        offset += inst.length;
      });

      expect(actualBytecode.length).toEqual(bytecodeLength);
      for (let i = 0; i < bytecodeLength; i++) {
        expect(actualBytecode[i]).toEqual(expectedBytecode[i]);
      }
    });
  });
});
