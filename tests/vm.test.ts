import { AssertionError } from 'assert';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { disassemble } from '../src/bytecode';
import { VM } from '../src/vm';
import * as obj from '../src/object';

type TestScalar = number | boolean | null;

type VMTestCase = [
  input: string,
  expected: TestScalar | TestScalar[] | obj.MidiNote | obj.MidiCC,
];

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
  o: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  constructor: Constructor<T>,
): asserts o is T {
  if (!(o instanceof constructor)) {
    const name = constructor.name as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const debug = o ? (o.toString() as string) : 'undefined';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message: `Object ${debug} is not type ${name}`,
    });
  }
}

function testScalar(
  result: obj.BaseObject,
  expected: number | boolean | null,
): void {
  if (typeof expected === 'number') {
    assertObjectType(result, obj.Int);
    expect(result.value).toEqual(expected);
  } else if (typeof expected === 'boolean') {
    assertObjectType(result, obj.Bool);
    expect(result.value).toEqual(expected);
  } else if (expected === null) {
    expect(result).toBeInstanceOf(obj.Null);
  }
}

function testInputs(inputs: VMTestCase[]): void {
  inputs.forEach(([input, expected]) => {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parse();
    const compiler = new Compiler();
    compiler.compile(program);

    try {
      const vm = new VM(compiler);
      vm.run();

      const result = vm.lastElement();

      if (expected instanceof Array) {
        assertObjectType(result, obj.Arr);
        expect(result.items.length).toEqual(expected.length);

        expected.forEach((exp, i) => {
          testScalar(result.items[i], exp);
        });
      } else if (expected instanceof obj.MidiNote) {
        assertObjectType(result, obj.MidiNote);
        expect(result.pitch).toEqual(expected.pitch);
        expect(result.duration).toEqual(expected.duration);
        expect(result.velocity).toEqual(expected.velocity);
      } else if (expected instanceof obj.MidiCC) {
        assertObjectType(result, obj.MidiCC);
        expect(result.key).toEqual(expected.key);
        expect(result.value).toEqual(expected.value);
      } else {
        testScalar(result, expected);
      }
    } catch (e) {
      console.log(disassemble(compiler.instructions()));
      compiler.constants.forEach((c) => {
        if (c instanceof obj.Fn) {
          console.log(disassemble(c.instructions));
        }
      });
      throw e;
    }
  });
}

function testError(input: string): void {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parse();
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler);
  expect(() => {
    vm.run();
    const result = vm.lastElement();
    console.log(result.inspectObject());
  }).toThrow();
}

describe('VM', () => {
  test('should run integer operations through the virtual machine', () => {
    testInputs([
      ['1', 1],
      ['2', 2],
      ['-2', -2],
      ['1 + 2', 3],
      ['1 + -2', -1],
      ['-(1 + -2)', 1],
      ['1 - 2', -1],
      ['5 - 3', 2],
      ['5 * 3', 15],
      ['6 / 3', 2],
      ['5 / 3', 1],
      ['6 % 3', 0],
      ['5 % 3', 2],
    ]);
  });

  test('should run boolean operations through the virtual machine', () => {
    testInputs([
      ['true', true],
      ['false', false],
      ['!true', false],
      ['!false', true],
      ['!(if (false) { 5; })', true],
      ['1 < 100', true],
      ['!(1 < 100)', false],
      ['1 > 100', false],
      ['1 < 1', false],
      ['1 > 1', false],
      ['1 == 1', true],
      ['1 != 1', false],
      ['1 != 100', true],
      ['1 == 100', false],
      ['true == true', true],
      ['true != true', false],
      ['true == false', false],
      ['true != false', true],
      ['(1 > 2) == false', true],
    ]);
  });

  test('should run conditional operations through the virtual machine', () => {
    testInputs([
      ['if (true) { 50 }', 50],
      ['if (false) { 50 }', null],
      ['if (true) { 50 } else { 51 }', 50],
      ['if (false) { 50 } else { 51 }', 51],
      ['if (0) { 50 } else { 51 }', 51],
      ['if (1) { 50 } else { 51 }', 50],
      ['if (true) { 50; 49 } else { 51 }', 49],
      ['if ((if (false) { 1 })) { 50 } else { 51 }', 51],
    ]);
  });

  test('should run declare and variable statements through the virtual machine', () => {
    testInputs([
      [
        `x := 5;
         y := 6;
         x;
         y;
         z := x + y;
         z;`,
        11,
      ],
    ]);
  });

  test('should support variable reassignment through the virtual machine', () => {
    testInputs([
      [
        `x := 5;
         x = x + 6;`,
        11,
      ],
      [
        `x := 5;
        fn () {
          x := 10;
        }();
        x`,
        5,
      ],
      [
        `x := 5;
        fn () {
          x = 10;
        }();
        x;`,
        10,
      ],
      [
        `x := 5;
        fn () {
          x := 10;
          fn () {
            x = 20;
          }();
          return x;
        }();`,
        20,
      ],
    ]);
  });

  test('should support compound reassignment through the virtual machine', () => {
    testInputs([
      [
        `x := 5;
         x += 6;
         x`,
        11,
      ],
      [
        `x := 5;
         x -= 6;
         x`,
        -1,
      ],
      [
        `x := 5;
         x *= 6;
         x`,
        30,
      ],
      [
        `x := 5;
         x /= 2;`,
        2,
      ],
      [
        `x := 5;
         x %= 2;`,
        1,
      ],
    ]);
  });

  test('should run array statements through the virtual machine', () => {
    testInputs([
      [`[]`, []],
      [`[][0]`, null],
      [`[2, 3, 5, 8]`, [2, 3, 5, 8]],
      [`[2, 3, 5, 8][2]`, 5],
      [`[2, 3, 5, 8][1 + 2]`, 8],
      [`[2 + 3, 5 * 8]`, [5, 40]],
    ]);
  });

  test('should support function calls through the virtual machine', () => {
    testInputs([
      [`fn () { return 1; }()`, 1],
      [`fn () { return 1 + 2; }()`, 3],
      [`fn () { 1 + 2; }()`, null],
      [`f := fn () { return 1 + 2; }; f()`, 3],
      [
        `f := fn () { return 1 + 2; }; g := fn () { return f() + 3; }; g()`,
        6,
      ],
      [`fn () { return 5; return 1; }()`, 5],
      [`fn (a, b) { return a + b + 1 }(3, 4)`, 8],
    ]);
  });

  test('should support scoped variables through function calls', () => {
    testInputs([
      [
        `a := 3;
        f := fn () {
          b := 5;
          return a + b; };
        };
        f()`,
        8,
      ],
      [
        `a := 3;
        f := fn (c) {
          b := 5;
          d := a + b + c;
          return d; };
        };
        f(2)`,
        10,
      ],
      [
        `a := 3;
        g := fn (x, y, z) {
          return x + y + z;
        }
        f := fn (c) {
          b := 5;
          d := g(a, b, c);
          return d; };
        };
        f(2)`,
        10,
      ],
      [
        `a := 3;
        f := fn (c) {
          b := 5;
          g := fn () {
            d := 1;
            h := fn () {
              return a + b + c + d;
            };
            return h();
          }
          return g();
        };
        f(2)`,
        11,
      ],
    ]);
  });

  test('should support implicit null arguments if not supplied', () => {
    testInputs([
      [
        `
        f := fn (g) {
          return g; };
        };
        f()`,
        null,
      ],
    ]);
  });

  test('should ignore additional arguments', () => {
    testInputs([
      [
        `
        f := fn (g) {
          return g; };
        };
        f(5, 6)`,
        5,
      ],
    ]);
  });

  test('should support closures', () => {
    testInputs([
      [
        `
        addX := fn (y) {
          return fn (x) { return x + y; }
        };
        add5 := addX(5);
        add5(6)`,
        11,
      ],
      [
        `
        addTriad := fn (z) {
          return fn (y) {
            return fn (x) { return x + y + z; }
          };
        };
        addTriad(5)(4)(3);`,
        12,
      ],
    ]);
  });

  test('should support recursion', () => {
    testInputs([
      [
        `fact := fn (n) {
          if (n <= 1) {
            return n;
          }
          return n * fact(n - 1);
        };
        fact(5)`,
        120,
      ],
      [
        `fib := fn (x) {
          if (x <= 1) {
            return x;
          } else {
            return fib(x - 1) + fib(x - 2);
          }
        };
        fib(10)`,
        55,
      ],
      [
        `wrapper := fn (n) {
          fib := fn (x) {
            if (x <= 1) {
              return x;
            } else {
              return fib(x - 1) + fib(x - 2);
            }
          };
          return fib(n);
        };
        wrapper(11);`,
        89,
      ],
      [
        `wrapper := fn () {
          fib := fn (x) {
            if (x <= 1) {
              return x;
            } else {
              return fib(x - 1) + fib(x - 2);
            }
          };
          return fib;
        };
        wrapper()(12);`,
        144,
      ],
    ]);
  });

  test('should support loops', () => {
    testInputs([
      [
        `a := 0;
        while (a < 4) {
          a = a + 1;
        }
        a;`,
        4,
      ],
      [
        `a := 5;
        b := 1;
        while (a -= 1) {
          b *= 2;
        }
        b;`,
        16,
      ],
      [
        `a := 0;
        b := while (a < 4) {
          a = a + 1;
          a + 3;
        }
        b;`,
        7,
      ],
      [
        `a := 0;
        b := 0;
        while (a < 4) {
          a = a + 1;
          if (a <= 2) {
            continue;
          }
          b = b + 1;
        }
        b;`,
        2,
      ],
      [
        `a := 0;
        loop {
          a = a + 1;
          if (a > 3) {
            break;
          }
        }
        a;`,
        4,
      ],
    ]);
  });

  test('should support built-in function `len`', () => {
    testInputs([
      [`len([])`, 0],
      [`len([1, 1, 2, 3, 5, 8])`, 6],
    ]);
  });

  test('should support built-in function `concat`', () => {
    testInputs([
      [`concat([], [])`, []],
      [`concat([], [1])`, [1]],
      [`concat([2], [1])`, [2, 1]],
      [
        `concat([1, 1, 2, 3, 5, 8], [3, 4])`,
        [1, 1, 2, 3, 5, 8, 3, 4],
      ],
      [
        `concat([1, 1, 2], [3, 5, 8], [3, 4])`,
        [1, 1, 2, 3, 5, 8, 3, 4],
      ],
    ]);
  });

  test('should support built-in function `sort`', () => {
    testInputs([
      [`sort([])`, []],
      [`sort([1])`, [1]],
      [`sort([true, false])`, [false, true]],
      [`sort([1, false])`, [false, 1]],
      [`sort([2, 1])`, [1, 2]],
      [`sort([1, 3, 1, 5, 2, 8])`, [1, 1, 2, 3, 5, 8]],
    ]);
  });

  test('should support built-in function `rev`', () => {
    testInputs([
      [`rev([])`, []],
      [`rev([1])`, [1]],
      [`rev([2, 1])`, [1, 2]],
      [`rev([2, false, 0])`, [0, false, 2]],
      [`rev([1, 1, 2, 3, 5, 8])`, [8, 5, 3, 2, 1, 1]],
    ]);
  });

  test('should support built-in function `min`', () => {
    testInputs([
      [`min([])`, null],
      [`min([1])`, 1],
      [`min([2, 1])`, 1],
      [`min([1, -2, 7, 5])`, -2],
    ]);
  });

  test('should support built-in function `max`', () => {
    testInputs([
      [`max([])`, null],
      [`max([1])`, 1],
      [`max([2, 1])`, 2],
      [`max([1, 2, 7, 5])`, 7],
    ]);
  });

  test('should support built-in function `range`', () => {
    testInputs([
      [`range(1)`, [0]],
      [`range(3)`, [0, 1, 2]],
      [`range(10)`, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ]);

    testError(`range(-100)`);
    testError(`range(1, 2)`);
    testError(`range(0)`);
    testError(`range([])`);
    testError(`range()`);
  });

  test('should support MIDI `note` messages', () => {
    testInputs([
      [`note [C3, 3, 127]`, new obj.MidiNote(48, 3, 127)],
      [`note [C3]`, new obj.MidiNote(48, 1, 64)],
    ]);

    testError('note []');
    testError('note [false]');
    testError('note true');
    testError('note 3');
    testError('note [3, 4, 5, 6, 7]');
    testError('note [note [60]]');
  });

  test('should support MIDI `cc` messages', () => {
    testInputs([[`cc [1, 2]`, new obj.MidiCC(1, 2)]]);

    testError('cc []');
    testError('cc [false]');
    testError('cc true');
    testError('cc 3');
    testError('cc [3, 4, 5, 6, 7]');
    testError('cc [note [60], cc [1, 2]]');
  });

  test('should support sequence generators', () => {
    testInputs([
      [
        `g := gen () { <- 1; <- 2 };
        s := g();
        next s;
        next s;`,
        2,
      ],
      [
        `g := gen (x, y) { <- x + y; };
        s := g(2, 3);
        next s`,
        5,
      ],
      [
        `g := gen (x, y) { <- x + y; };
        s := g(2, 3);
        a := next s;
        a + 2`,
        7,
      ],
      [
        `g := gen (x, y) { <- x + y; };
        s := g(2, 3);
        next s;
        next s;`,
        null,
      ],
      [
        `g := gen (x, y) { loop { <- x + y; } };
        s := g(2, 3);
        next s;
        next s;
        next s;
        next s;`,
        5,
      ],
    ]);
  });
});
