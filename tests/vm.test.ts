import { AssertionError } from 'assert';
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Compiler } from '../src/compiler';
import { disassemble } from '../src/bytecode';
import { VM } from '../src/vm';
import * as obj from '../src/object';
import { DEFAULT_NOTE_DURATION } from '../src/constants';

type TestScalar = number | boolean | null | obj.MidiNote | obj.Hold | obj.Rest;

type VMTestCase = [
  input: string,
  expected: TestScalar | TestScalar[] | obj.MidiCC,
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
  expected: number | boolean | null | obj.BaseObject,
): void {
  if (typeof expected === 'number') {
    assertObjectType(result, obj.Int);
    expect(result.value).toEqual(expected);
  } else if (typeof expected === 'boolean') {
    assertObjectType(result, obj.Bool);
    expect(result.value).toEqual(expected);
  } else if (expected === null) {
    expect(result).toBeInstanceOf(obj.Null);
  } else if (expected instanceof obj.MidiNote) {
    assertObjectType(result, obj.MidiNote);
    expect(result.pitch).toEqual(expected.pitch);
    expect(result.duration).toEqual(expected.duration);
    expect(result.velocity).toEqual(expected.velocity);
  } else if (expected instanceof obj.Hold) {
    assertObjectType(result, obj.Hold);
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
      console.log(input);
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
      ['true && true', true],
      ['true || false', true],
      ['true && false', false],
      ['false || false', false],
      ['1 > 2 || 2 > 1', true],
      ['1 > 2 && 2 > 1', false],
      ['(1 > 2) == false', true],
    ]);
  });

  test('should run conditional operations through the virtual machine', () => {
    testInputs([
      ['res := 0; if (true) { res = 50; } res', 50],
      ['res := 0; if (false) { res = 50; } res', 0],
      ['res := 0; if (true) { res = 50; } else { res = 51; } res', 50],
      ['res := 0; if (false) { res = 50; } else { res = 51; } res', 51],
      ['res := 0; if (0) { res = 50; } else { res = 51; } res', 51],
      ['res := 0; if (1) { res = 50; } else { res = 51; } res', 50],
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
    testError(`range(true)`);
    testError(`range()`);
  });

  test('should support built-in function `map`', () => {
    testInputs([
      [`map([1, 2, 3], fn (x) { return x * 2 })`, [2, 4, 6]],
      [`map([1, 2, 3], fn (x) { x * 2 })`, [null, null, null]],
      [`map([range(1), range(3)], len)`, [1, 3]],
    ]);

    testError(`map(-100, len)`);
    testError(`map(1, 2)`);
    testError(`map(0, fn () {}, 3)`);
    testError(`map([])`);
    testError(`map(true)`);
    testError(`map()`);
  });

  test('should support built-in function `filter`', () => {
    testInputs([
      [`filter([1, 2, 3], fn (x) { return x == 2 })`, [2]],
      [`filter([1, 2, 3], fn (x) { x * 2 })`, []],
      [`filter([1, 2, 3], fn (x) { return x % 2 == 1 })`, [1, 3]],
    ]);

    testError(`filter(-100, len)`);
    testError(`filter(1, 2)`);
    testError(`filter(0, fn () {}, 3)`);
    testError(`filter([])`);
    testError(`filter(true)`);
    testError(`filter()`);
  });

  test('should support built-in function `take`', () => {
    testInputs([
      [
        `g := gen(x) {
          yield 1;
          yield 2;
          yield x;
        };
        seq := g(4);
        take(seq, 4)`,
        [1, 2, 4, null],
      ],
      [
        `g := gen(x) {
          yield 3;
          loop {
            yield 1;
            yield 2;
            yield x;
          }
        };
        seq := g(4);
        take(seq, 5)`,
        [3, 1, 2, 4, 1],
      ],
    ]);
  });

  test('should support MIDI `note` messages', () => {
    testInputs([
      [`note(1, C3, 3, 127)`, new obj.MidiNote(1, 48, 3, 127)],
      [`note(0, C3)`, new obj.MidiNote(0, 48, DEFAULT_NOTE_DURATION, 64)],
    ]);

    testError('note()');
    testError('note(false)');
    testError('note(true)');
    testError('note(3)');
    testError('note(0, note(0, 60))');
  });

  test('should support MIDI `cc` messages', () => {
    testInputs([[`cc(0, 1, 2)`, new obj.MidiCC(0, 1, 2)]]);

    testError('cc()');
    testError('cc(false)');
    testError('cc(true)');
    testError('cc(3)');
    testError('cc(note(0, 60), cc(1, 2))');
  });

  test('should support sequence generators', () => {
    testInputs([
      [
        `g := gen () { yield 1; yield 2 };
        s := g();
        next s;
        next s;`,
        2,
      ],
      [
        `g := gen (x, y) { yield x + y; };
        s := g(2, 3);
        next s`,
        5,
      ],
      [
        `g := gen (x, y) { yield x + y; };
        s := g(2, 3);
        a := next s;
        a + 2`,
        7,
      ],
      [
        `g := gen (x, y) { yield x + y; };
        s := g(2, 3);
        next s;
        next s;`,
        null,
      ],
      [
        `g := gen (x, y) { loop { yield x + y; } };
        s := g(2, 3);
        next s;
        next s;
        next s;
        next s;`,
        5,
      ],
    ]);
  });

  test('should support `for` expressions', () => {
    testInputs([
      [
        `acc := 0;
        for x in [1, 2, 3] {
          acc += x;
        };
        acc;`,
        6,
      ],
      [
        `x := 1;
        f := fn () {
          acc := 0;
          for x in [1, 2, 3] {
            acc += x;
          }
          return acc;
        }
        f()`,
        6,
      ],
      [
        `g := gen() { yield 1; yield 4; yield 7; }
        out := 0;
        for x in take(g(), 3) {
          out = x;
        };
        out;`,
        7,
      ],
    ]);
  });

  test('should support `conv` built-in', () => {
    testInputs([
      [
        `seq := conv([1, 2, 3]);
        take(seq, 5)`,
        [1, 2, 3, null, null],
      ],
    ]);
  });

  test('should support `cycle` built-in', () => {
    testInputs([
      [
        `seq := cycle([1, 2, 3]);
        take(seq, 5)`,
        [1, 2, 3, 1, 2],
      ],
    ]);
  });

  test('should support `poly` built-in', () => {
    testInputs([
      [
        `g1 := cycle([note(0, C3), note(0, D3), note(0, G3)]);
        g2 := cycle([note(0, C3), note(0, D3), note(0, G3)]);
        p := poly(g1, g2);
        next p;
        next p;`,
        [
          new obj.MidiNote(0, 50, DEFAULT_NOTE_DURATION, 64),
          new obj.MidiNote(0, 50, DEFAULT_NOTE_DURATION, 64),
        ],
      ],
      [
        `g1 := cycle([note(0, C3, 1), note(0, D3, 1), note(0, G3, 1)]);
        g2 := cycle([note(0, C3, 2), note(0, D3, 2), note(0, G3, 2)]);
        p := poly(g1, g2);
        next p;
        next p;`,
        [
          new obj.MidiNote(0, 50, 1, 64),
          new obj.Hold(0, 48, 1),
        ],
      ],
    ]);
  });

  test('should support `quant` built-in', () => {
    testInputs([
      [
        `quant(SCALE_MAJOR, C3, C#4) == D4`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, C#2) == D2`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, F#3) == G3`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, Bb3) == B3`,
        true,
      ],
    ]);
  });

  test('should support `quant` built-in', () => {
    testInputs([
      [
        `quant(SCALE_MAJOR, C3, C#4) == D4`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, C#2) == D2`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, F#3) == G3`,
        true,
      ],
      [
        `quant(SCALE_MAJOR, C3, Bb3) == B3`,
        true,
      ],
    ]);
  });

  test('should support `pitch`, `dur`, and `vel` built-ins', () => {
    testInputs([
      [
        `pitch(note(0, C4, 3, 50))`,
        60,
      ],
      [
        `dur(note(0, C4, 3, 50))`,
        3,
      ],
      [
        `vel(note(0, C4, 3, 50))`,
        50,
      ],
    ]);
  });

  test('should support `rest` keyword', () => {
    testInputs([
      [`rest()`, new obj.Rest(DEFAULT_NOTE_DURATION)],
      [`rest(10)`, new obj.Rest(10)],
    ]);

    testError(`rest(0, 0)`);
    testError(`rest(0, -1)`);
    testError(`rest(0, fn(){})`);
  });

  test('should support nested sequence generators', () => {
    testInputs([
      [
        `g := gen () {
          loop {
            yield 1;
            yield 2;
            loop {
              yield 3;
            }
          }
        };
        s := g();
        next s;
        next s;
        next s;
        next s;`,
        3,
      ],
      [
        `g := gen () {
          loop {
            yield 1;
            yield 2;
            for i in range(3) {
              yield 3;
            }
          }
        };
        s := g();
        next s;
        next s;
        next s;
        next s;`,
        3,
      ],
    ]);
  });

  test('should support nested sequence generators', () => {
    testInputs([
      [
        `g := gen () {
          yield 1;
          yield 2;
        };
        main := gen (x) {
          s := g();
          yield (next s) * x;
          a := next s;
          yield a * x;
        }
        m := main(2);
        b := next m;
        c := next m;
        b + c`,
        6,
      ],
      [
        `g := gen () {
          yield 1;
          yield 2;
        };
        s := g();
        main := gen (x) {
          yield (next s) * x;
          a := next s;
          yield a * x;
        }
        m := main(2);
        b := next m;
        c := next m;
        b + c`,
        6,
      ],
      [
        `g := gen () {
          // First comment.
          yield 1;
          yield 2;
        };
        s := g();
        // Another comment...
        main := gen (x) {
          // What is this?
          yield (next s) * x;
          a := next s;
          yield a * x;
        }
        m := main(2);
        b := next m;
        c := next m;
        b + c`,
        6,
      ],
      [
        `main := gen (x) {
          loop {
            // What is this?
            yield x;
          }
        }
        m := main(2);
        b := next m;
        c := next m;
        d := next m;
        b + c + d`,
        6,
      ],
    ]);
  });
});
