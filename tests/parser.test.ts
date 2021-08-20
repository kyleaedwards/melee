import { AssertionError } from 'assert';
import { Parser } from '../src/parser';
import * as ast from '../src/ast';
import { Lexer } from '../src/lexer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

/**
 * Parse program statements and confirm no errors occurred.
 *
 * @param input - Program text body
 * @returns - Top-level program statements
 *
 * @internal
 */
function parseProgramStatements(input: string): ast.Statement[] {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program: ast.Program = parser.parse();
  expect(parser.errors).toHaveLength(0);
  return program.statements;
}

/**
 * Type assertion for AST nodes.
 *
 * @param node - Node to be compared
 * @param constructor - Constructor to confirm type
 *
 * @internal
 */
function assertNodeType<T extends ast.Node>(
  node: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  constructor: Constructor<T>,
): asserts node is T {
  if (!(node instanceof constructor)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    throw new AssertionError({
      message: 'Node is not correct type',
    });
  }
}

/**
 * Confirms type and value for an identfier, a boolean, or an
 * integer literal.
 *
 * @param input - Input expression
 * @param value - Expected literal value
 *
 * @internal
 */
function testLiteral(
  input: ast.Expression,
  value: string | number | boolean,
) {
  if (typeof value === 'string') {
    assertNodeType(input, ast.Identifier);
  } else if (typeof value === 'number') {
    assertNodeType(input, ast.IntegerLiteral);
  } else {
    assertNodeType(input, ast.BooleanLiteral);
  }
  expect(input.value).toEqual(value);
}

/**
 * Confirms type and values for both sides of an infix expression.
 *
 * @param input - Input expression
 * @param left - Expected literal value for left-hand side
 * @param operator - Expected operator string
 * @param right - Expected literal value for right-hand side
 *
 * @internal
 */
function testInfixExpression(
  input: ast.Expression,
  left: string | number | boolean,
  operator: string,
  right: string | number | boolean,
) {
  assertNodeType(input, ast.InfixExpression);
  testLiteral(input.left, left);
  expect(input.operator).toEqual(operator);
  testLiteral(input.right, right);
}

describe('Parser', () => {
  test('should parse valid declare statements', () => {
    const cases: {
      input: string;
      name: string;
      value: number | string;
    }[] = [
      {
        input: 'a := 3;',
        name: 'a',
        value: 3,
      },
      {
        input: 'big_number := 100000000;',
        name: 'big_number',
        value: 100000000,
      },
      {
        input: 'a := b;',
        name: 'a',
        value: 'b',
      },
      {
        input: 'pitch := C#4;',
        name: 'pitch',
        value: 'C#4',
      },
    ];

    cases.forEach(({ input, name, value }) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const dec = stmts[0];
      assertNodeType(dec, ast.DeclareStatement);
      expect(dec.token.tokenType).toEqual('declare');

      const left = dec.name;
      assertNodeType(left, ast.Identifier);
      expect(left.value).toEqual(name);

      const right = dec.value;
      if (typeof value === 'string') {
        assertNodeType(right, ast.Identifier);
      } else {
        assertNodeType(right, ast.IntegerLiteral);
      }
      expect(right.value).toEqual(value);
    });
  });

  test('should parse valid assign statements', () => {
    const cases: {
      input: string;
      name: string;
      value: number | string;
    }[] = [
      {
        input: 'a = 3;',
        name: 'a',
        value: 3,
      },
      {
        input: 'big_number = 100000000;',
        name: 'big_number',
        value: 100000000,
      },
      {
        input: 'a = b;',
        name: 'a',
        value: 'b',
      },
      {
        input: 'pitch = C#4;',
        name: 'pitch',
        value: 'C#4',
      },
    ];

    cases.forEach(({ input, name, value }) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const dec = stmt.value;
      assertNodeType(dec, ast.AssignExpression);
      expect(dec.token.tokenType).toEqual('assign');

      const left = dec.name;
      assertNodeType(left, ast.Identifier);
      expect(left.value).toEqual(name);

      const right = dec.value;
      if (typeof value === 'string') {
        assertNodeType(right, ast.Identifier);
      } else {
        assertNodeType(right, ast.IntegerLiteral);
      }
      expect(right.value).toEqual(value);
    });
  });

  test('should parse valid compound assign statements', () => {
    const cases: {
      input: string;
      name: string;
      operator: string;
      value: number | string;
    }[] = [
      {
        input: 'a += 3;',
        name: 'a',
        operator: '+=',
        value: 3,
      },
      {
        input: 'big_number -= 100000000;',
        name: 'big_number',
        operator: '-=',
        value: 100000000,
      },
      {
        input: 'a *= b;',
        name: 'a',
        operator: '*=',
        value: 'b',
      },
    ];

    cases.forEach(({ input, name, value, operator }) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const dec = stmt.value;
      assertNodeType(dec, ast.CompoundAssignExpression);
      expect(dec.token.literal).toEqual(operator);

      const left = dec.name;
      assertNodeType(left, ast.Identifier);
      expect(left.value).toEqual(name);

      const right = dec.value;
      if (typeof value === 'string') {
        assertNodeType(right, ast.Identifier);
      } else {
        assertNodeType(right, ast.IntegerLiteral);
      }
      expect(right.value).toEqual(value);
    });
  });

  test('should parse valid return statements', () => {
    const cases: [input: string, value: number | string][] = [
      ['return 3;', 3],
      ['return 100000000;', 100000000],
      ['return b;', 'b'],
      ['return C#4;', 'C#4'],
    ];

    cases.forEach(([input, value]) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ReturnStatement);
      expect(stmt.token.tokenType).toEqual('return');
      testLiteral(stmt.value, value);
    });
  });

  test('should parse valid yield statements', () => {
    const cases: [input: string, value: number | string][] = [
      ['yield 3;', 3],
      ['yield 1000000000;', 1000000000],
      ['yield b;', 'b'],
      ['yield C#4;', 'C#4'],
    ];

    cases.forEach(([input, value]) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.YieldStatement);
      expect(stmt.token.tokenType).toEqual('yield');
      testLiteral(stmt.value, value);
    });
  });

  test('should parse valid identifier expression', () => {
    const input = 'variable;';
    const stmts = parseProgramStatements(input);
    expect(stmts).toHaveLength(1);

    const stmt = stmts[0];
    assertNodeType(stmt, ast.ExpressionStatement);

    const expr = stmt.value;
    assertNodeType(expr, ast.Identifier);
    expect(expr.value).toEqual('variable');
  });

  test('should parse valid identifier expression', () => {
    const input = '5;';
    const stmts = parseProgramStatements(input);
    expect(stmts).toHaveLength(1);

    const stmt = stmts[0];
    assertNodeType(stmt, ast.ExpressionStatement);

    const expr = stmt.value;
    assertNodeType(expr, ast.IntegerLiteral);
    expect(expr.value).toEqual(5);
  });

  test('should parse valid identifier expression', () => {
    const input = 'true;';
    const stmts = parseProgramStatements(input);
    expect(stmts).toHaveLength(1);

    const stmt = stmts[0];
    assertNodeType(stmt, ast.ExpressionStatement);

    const expr = stmt.value;
    assertNodeType(expr, ast.BooleanLiteral);
    expect(expr.value).toEqual(true);
  });

  test('should parse valid prefix expressions', () => {
    const cases: [
      input: string,
      operator: '-' | '!',
      value: number | boolean,
    ][] = [
      ['-3', '-', 3],
      ['!1', '!', 1],
      ['!true', '!', true],
      ['!false', '!', false],
    ];

    cases.forEach(([input, operator, value]) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.PrefixExpression);

      expect(expr.operator).toEqual(operator);
      testLiteral(expr.right, value);
    });
  });

  describe('parseInfixExpressions', () => {
    test('should parse valid infix expressions', () => {
      const cases: [
        input: string,
        left: number | string | boolean,
        operator: string,
        right: number | string | boolean,
      ][] = [
        ['1 + 2', 1, '+', 2],
        ['1 + a', 1, '+', 'a'],
        ['5 - 3', 5, '-', 3],
        ['x * y', 'x', '*', 'y'],
        ['24 / 6', 24, '/', 6],
        ['24 % 6', 24, '%', 6],
        ['100 > 50', 100, '>', 50],
        ['100 >= 50', 100, '>=', 50],
        ['100 < 50', 100, '<', 50],
        ['100 <= 50', 100, '<=', 50],
        ['1 == false', 1, '==', false],
        ['1 != false', 1, '!=', false],
      ];

      cases.forEach(([input, left, operator, right]) => {
        const stmts = parseProgramStatements(input);
        expect(stmts).toHaveLength(1);

        const stmt = stmts[0];
        assertNodeType(stmt, ast.ExpressionStatement);
        testInfixExpression(stmt.value, left, operator, right);
      });
    });
  });

  test('should honor operator precedence', () => {
    const cases: [input: string, expected: string][] = [
      ['1 + 2 + 3', '((1 + 2) + 3)'],
      ['1 + (2 + 3)', '(1 + (2 + 3))'],
      ['1 * 2 + 3', '((1 * 2) + 3)'],
      ['1 + 2 * 3', '(1 + (2 * 3))'],
      ['(1 + 2) * 3', '((1 + 2) * 3)'],
      ['-a * b', '((-a) * b)'],
      ['-(a * b)', '(-(a * b))'],
      ['a > b != b <= a', '((a > b) != (b <= a))'],
      [
        'x + y * z - 1 / 2 == 3 / 4 + a * b',
        '(((x + (y * z)) - (1 / 2)) == ((3 / 4) + (a * b)))',
      ],
      ['true', 'true'],
      ['!true == false', '((!true) == false)'],
      ['-fncall(x + y)', '(-fncall((x + y)))'],
    ];

    cases.forEach(([input, expected]) => {
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      expect(expr).toBeDefined();
      expect(expr.toString()).toEqual(expected);
    });
  });

  describe('parseIfExpression', () => {
    test('should parse valid if expression', () => {
      const input = `if (y == z) {
        x
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.IfExpression);

      testInfixExpression(expr.condition, 'y', '==', 'z');

      assertNodeType(expr.consequence, ast.BlockStatement);

      expect(expr.consequence.statements).toHaveLength(1);
      const subStmt = expr.consequence.statements[0];

      assertNodeType(subStmt, ast.ExpressionStatement);
      testLiteral(subStmt.value, 'x');

      expect(expr.alternative).toBeUndefined();
    });
  });

  describe('parseIfElseExpression', () => {
    test('should parse valid if-else expression', () => {
      const input = `if (y == z) {
        x
      } else {
        0
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.IfExpression);

      testInfixExpression(expr.condition, 'y', '==', 'z');

      assertNodeType(expr.consequence, ast.BlockStatement);

      expect(expr.consequence.statements).toHaveLength(1);
      const subStmt = expr.consequence.statements[0];

      assertNodeType(subStmt, ast.ExpressionStatement);
      testLiteral(subStmt.value, 'x');

      assertNodeType(expr.alternative, ast.BlockStatement);
      expect(expr.alternative.statements).toHaveLength(1);
      const altStmt = expr.alternative.statements[0];

      assertNodeType(altStmt, ast.ExpressionStatement);
      testLiteral(altStmt.value, 0);
    });
  });

  describe('parseWhile', () => {
    test('should parse valid while expression', () => {
      const input = `while (y == z) {
        x
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.WhileStatement);

      testInfixExpression(stmt.condition, 'y', '==', 'z');

      assertNodeType(stmt.block, ast.BlockStatement);

      expect(stmt.block.statements).toHaveLength(1);
      const subStmt = stmt.block.statements[0];

      assertNodeType(subStmt, ast.ExpressionStatement);
      testLiteral(subStmt.value, 'x');
    });

    test('should parse valid loop expression', () => {
      const input = `loop {
        x
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.WhileStatement);

      testLiteral(stmt.condition, true);

      assertNodeType(stmt.block, ast.BlockStatement);

      expect(stmt.block.statements).toHaveLength(1);
      const subStmt = stmt.block.statements[0];

      assertNodeType(subStmt, ast.ExpressionStatement);
      testLiteral(subStmt.value, 'x');
    });
  });

  describe('parseFunctionLiteral', () => {
    test('should parse valid function literal', () => {
      const input = `fn (x, y) {
        return x + y;
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.FunctionLiteral);

      expect(expr.parameters).toHaveLength(2);
      ['x', 'y'].forEach((expected, i) => {
        testLiteral(expr.parameters[i], expected);
      });

      assertNodeType(expr.body, ast.BlockStatement);

      expect(expr.body.statements).toHaveLength(1);
      const subStmt = expr.body.statements[0];

      assertNodeType(subStmt, ast.ReturnStatement);
      assertNodeType(subStmt.value, ast.InfixExpression);

      testLiteral(subStmt.value.left, 'x');
      expect(subStmt.value.operator).toEqual('+');
      testLiteral(subStmt.value.right, 'y');
    });
  });

  describe('parseGeneratorLiteral', () => {
    test('should parse valid sequence literal', () => {
      const input = `gen (x, y) {
        yield x + y;
      }`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.GeneratorLiteral);

      expect(expr.parameters).toHaveLength(2);
      ['x', 'y'].forEach((expected, i) => {
        testLiteral(expr.parameters[i], expected);
      });

      assertNodeType(expr.body, ast.BlockStatement);

      expect(expr.body.statements).toHaveLength(1);
      const subStmt = expr.body.statements[0];

      assertNodeType(subStmt, ast.YieldStatement);
      assertNodeType(subStmt.value, ast.InfixExpression);

      testInfixExpression(subStmt.value, 'x', '+', 'y');
    });
  });

  describe('parseCallExpression', () => {
    test('should parse function calls from variables', () => {
      const inputs: [
        string,
        string,
        (string | boolean | number)[],
      ][] = [
        ['abc()', 'abc', []],
        ['fn1(x, y)', 'fn1', ['x', 'y']],
        ['fn2(a, 1, false)', 'fn2', ['a', 1, false]],
      ];

      inputs.forEach(([input, name, args]) => {
        const stmts = parseProgramStatements(input);
        expect(stmts).toHaveLength(1);

        const stmt = stmts[0];
        assertNodeType(stmt, ast.ExpressionStatement);

        const expr = stmt.value;
        assertNodeType(expr, ast.CallExpression);

        testLiteral(expr.fn, name);

        expect(expr.args).toHaveLength(args.length);
        args.forEach((expected, i) => {
          testLiteral(expr.args[i], expected);
        });
      });
    });
  });

  describe('parseNextExpression', () => {
    test('should parse yielded next expression', () => {
      const input = `yield next item`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.YieldStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.NextExpression);

      testLiteral(expr.right, 'item');
    });

    test('should parse returned next expression', () => {
      const input = `return next item`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ReturnStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.NextExpression);

      testLiteral(expr.right, 'item');
    });

    test('should parse next keyword in expression', () => {
      const input = `x + next item`;
      const stmts = parseProgramStatements(input);
      expect(stmts).toHaveLength(1);

      const stmt = stmts[0];
      assertNodeType(stmt, ast.ExpressionStatement);

      const expr = stmt.value;
      assertNodeType(expr, ast.InfixExpression);

      testLiteral(expr.left, 'x');
      expect(expr.operator).toEqual('+');

      const next = expr.right;
      assertNodeType(next, ast.NextExpression);

      testLiteral(next.right, 'item');
    });
  });

  describe('parseArrayLiteral', () => {
    test('should parse valid array literals', () => {
      const inputs: [string, (string | boolean | number)[]][] = [
        ['[]', []],
        ['[x, y]', ['x', 'y']],
        ['[a, 1, false]', ['a', 1, false]],
      ];

      inputs.forEach(([input, values]) => {
        const stmts = parseProgramStatements(input);
        expect(stmts).toHaveLength(1);

        const stmt = stmts[0];
        assertNodeType(stmt, ast.ExpressionStatement);

        const expr = stmt.value;
        assertNodeType(expr, ast.ArrayLiteral);

        expect(expr.values).toHaveLength(values.length);
        values.forEach((expected, i) => {
          testLiteral(expr.values[i], expected);
        });
      });
    });
  });

  describe('parseNoteExpression', () => {
    test('should parse valid note expression', () => {
      const inputs: [string, (string | boolean | number)[]][] = [
        ['note []', []],
        ['note [x, y]', ['x', 'y']],
        ['note [a, 1, false]', ['a', 1, false]],
      ];

      inputs.forEach(([input, values]) => {
        const stmts = parseProgramStatements(input);
        expect(stmts).toHaveLength(1);

        const stmt = stmts[0];
        assertNodeType(stmt, ast.ExpressionStatement);

        const expr = stmt.value;
        assertNodeType(expr, ast.NoteExpression);

        const arr = expr.note;
        assertNodeType(arr, ast.ArrayLiteral);

        expect(arr.values).toHaveLength(values.length);
        values.forEach((expected, i) => {
          testLiteral(arr.values[i], expected);
        });
      });
    });
  });

  describe('parseCCExpression', () => {
    test('should parse valid CC expression', () => {
      const inputs: [string, (string | boolean | number)[]][] = [
        ['cc []', []],
        ['cc [x, y]', ['x', 'y']],
        ['cc [a, 1, false]', ['a', 1, false]],
      ];

      inputs.forEach(([input, values]) => {
        const stmts = parseProgramStatements(input);
        expect(stmts).toHaveLength(1);

        const stmt = stmts[0];
        assertNodeType(stmt, ast.ExpressionStatement);

        const expr = stmt.value;
        assertNodeType(expr, ast.CCExpression);

        const arr = expr.message;
        assertNodeType(arr, ast.ArrayLiteral);

        expect(arr.values).toHaveLength(values.length);
        values.forEach((expected, i) => {
          testLiteral(arr.values[i], expected);
        });
      });
    });
  });
});
