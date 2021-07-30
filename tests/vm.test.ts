import { AssertionError } from 'assert';
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
  o: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  constructor: Constructor<T>,
): asserts o is T {
  if (!(o instanceof constructor)) {
    const name = constructor.name as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const debug = o ? o.toString() as string : 'undefined';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message: `Object ${debug} is not type ${name}`,
    });
  }
}

describe('VM', () => {
  test('should run integer operations through the virtual machine', () => {
    const inputs: [input: string, expected: number][] = [
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

  test('should run conditional operations through the virtual machine', () => {
    const inputs: [input: string, expected: number | null][] = [
      ['if (true) { 50 }', 50],
      ['if (false) { 50 }', null],
      ['if (true) { 50 } else { 51 }', 50],
      ['if (false) { 50 } else { 51 }', 51],
      ['if (0) { 50 } else { 51 }', 51],
      ['if (1) { 50 } else { 51 }', 50],
      ['if (true) { 50; 49 } else { 51 }', 49],
      ['if ((if (false) { 1 })) { 50 } else { 51 }', 51],
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

      if (typeof expected === 'number') {
        assertObjectType(result, obj.Int);
        expect(result.value).toEqual(expected);
      } else {
        assertObjectType(result, obj.Null);
        expect(result).toEqual(obj.NULL);
      }
    });
  });

  test('should run declare and variable statements through the virtual machine', () => {
    const inputs: [input: string, expected: number | null][] = [
      [
        `x := 5;
         y := 6;
         x;
         y;
         z := x + y;
         z;`,
        11,
      ],
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

      if (typeof expected === 'number') {
        assertObjectType(result, obj.Int);
        expect(result.value).toEqual(expected);
      } else {
        assertObjectType(result, obj.Null);
        expect(result).toEqual(obj.NULL);
      }
    });
  });

  test('should run array statements through the virtual machine', () => {
    const inputs: [
      input: string,
      expected: number[] | number | null,
    ][] = [
      [`[]`, []],
      [`[][0]`, null],
      [`[2, 3, 5, 8]`, [2, 3, 5, 8]],
      [`[2, 3, 5, 8][2]`, 5],
      [`[2, 3, 5, 8][1 + 2]`, 8],
      [`[2 + 3, 5 * 8]`, [5, 40]],
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

      if (expected instanceof Array) {
        assertObjectType(result, obj.Arr);
        expect(result.items.length).toEqual(expected.length);

        expected.forEach((exp, i) => {
          const res = result.items[i];
          assertObjectType(res, obj.Int);
          expect(res.value).toEqual(exp);
        });
      } else if (typeof expected === 'number') {
        assertObjectType(result, obj.Int);
        expect(result.value).toEqual(expected);
      } else if (expected === null) {
        expect(result).toEqual(obj.NULL);
      }
    });
  });

  test('should support function calls through the virtual machine', () => {
    const inputs: [
      input: string,
      expected: number[] | number | null,
    ][] = [
      [`fn () { return 1; }()`, 1],
      [`fn () { return 1 + 2; }()`, 3],
      [`fn () { 1 + 2; }()`, null],
      [`f := fn () { return 1 + 2; }; f()`, 3],
      [
        `f := fn () { return 1 + 2; }; g := fn () { return f() + 3; }; g()`,
        6,
      ],
      [`fn () { return 5; return 1; }()`, 5],
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

      if (expected instanceof Array) {
        assertObjectType(result, obj.Arr);
        expect(result.items.length).toEqual(expected.length);

        expected.forEach((exp, i) => {
          const res = result.items[i];
          assertObjectType(res, obj.Int);
          expect(res.value).toEqual(exp);
        });
      } else if (typeof expected === 'number') {
        assertObjectType(result, obj.Int);
        expect(result.value).toEqual(expected);
      } else if (expected === null) {
        expect(result).toEqual(obj.NULL);
      }
    });
  });

  test('should support scoped variables through function calls', () => {
    const inputs: [
      input: string,
      expected: number[] | number | null,
    ][] = [
      [
        `a := 3;
        f := fn () {
          b := 5;
          return a + b; };
        };
        f()`,
        8,
      ],
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

      if (expected instanceof Array) {
        assertObjectType(result, obj.Arr);
        expect(result.items.length).toEqual(expected.length);

        expected.forEach((exp, i) => {
          const res = result.items[i];
          assertObjectType(res, obj.Int);
          expect(res.value).toEqual(exp);
        });
      } else if (typeof expected === 'number') {
        assertObjectType(result, obj.Int);
        expect(result.value).toEqual(expected);
      } else if (expected === null) {
        expect(result).toEqual(obj.NULL);
      }
    });
  });
});
