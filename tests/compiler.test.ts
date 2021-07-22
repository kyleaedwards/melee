import { AssertionError } from 'assert';
import {
  Opcode,
  createInstruction,
  Instruction,
  disassemble,
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

type CompilerTestCase = [
  input: string,
  constants: (number | string)[],
  instructions: Instruction[],
];

/**
 * Runs a set of test cases and asserts the expected results.
 *
 * @param inputs - Expected test cases
 *
 * @internal
 */
function testCompilerResult(inputs: CompilerTestCase[]): void {
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
}

describe('Compiler.compile', () => {
  test('should compile integer expressions', () => {
    const inputs: CompilerTestCase[] = [
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
        '-1; -99',
        [1, 99],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.MINUS),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.MINUS),
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

    testCompilerResult(inputs);
  });

  test('should compile boolean expressions', () => {
    const inputs: CompilerTestCase[] = [
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
        '!true; !false',
        [],
        [
          createInstruction(Opcode.TRUE),
          createInstruction(Opcode.BANG),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.FALSE),
          createInstruction(Opcode.BANG),
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

    testCompilerResult(inputs);
  });

  test('should compile conditional expressions', () => {
    const inputs: CompilerTestCase[] = [
      [
        'if (true) { 100; } 1;',
        [100, 1],
        [
          createInstruction(Opcode.TRUE),
          createInstruction(Opcode.JMP_IF_NOT, 10),
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.JMP, 11),
          createInstruction(Opcode.NULL),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.POP),
        ],
      ],
      [
        'if (true) { 100; } else { 200; } 1;',
        [100, 200, 1],
        [
          createInstruction(Opcode.TRUE), // 0000
          createInstruction(Opcode.JMP_IF_NOT, 10), // 0001
          createInstruction(Opcode.CONST, 0), // 0004
          createInstruction(Opcode.JMP, 13), // 0007
          createInstruction(Opcode.CONST, 1), // 0010
          createInstruction(Opcode.POP), // 0013
          createInstruction(Opcode.CONST, 2), // 0014
          createInstruction(Opcode.POP), // 0017
        ],
      ],
    ];

    testCompilerResult(inputs);
  });

  test('should compile expressions declaring and using variables', () => {
    const inputs: CompilerTestCase[] = [
      [
        `x := 5;
         y := 6;
         x;
         y;
         z := x + y;
         z;`,
        [5, 6],
        [
          createInstruction(Opcode.CONST, 0),
          createInstruction(Opcode.SET, 0),
          createInstruction(Opcode.CONST, 1),
          createInstruction(Opcode.SET, 1),
          createInstruction(Opcode.GET, 0),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.GET, 1),
          createInstruction(Opcode.POP),
          createInstruction(Opcode.GET, 0),
          createInstruction(Opcode.GET, 1),
          createInstruction(Opcode.ADD),
          createInstruction(Opcode.SET, 2),
          createInstruction(Opcode.GET, 2),
          createInstruction(Opcode.POP),
        ],
      ],
    ];

    testCompilerResult(inputs);
  });
});
