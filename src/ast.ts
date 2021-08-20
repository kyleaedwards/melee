/**
 * Abstract syntax tree mechanisms and node types.
 */

import { Token } from './token';

/**
 * Interfaces
 */

/**
 * Base AST node interface.
 *
 * @public
 */
export interface Node {
  toString: () => string;
}

/**
 * Base AST statement interface.
 *
 * @public
 */
export interface Statement extends Node {
  token: Token;
  nodeType: 'statement';
}

/**
 * Base AST expression interface.
 *
 * @public
 */
export interface Expression extends Node {
  token: Token;
  nodeType: 'expression';
}

/**
 * Root-level program node encapsulating the full abstract syntax tree.
 *
 * @public
 */
export class Program implements Node {
  statements: Statement[];

  constructor() {
    this.statements = [];
  }

  toString(): string {
    return this.statements.map((stmt) => stmt.toString()).join('\n');
  }
}

/**
 * Statements
 */

/**
 * AST node type representing a variable definition statement like `var := 1;`.
 *
 * @public
 */
export class DeclareStatement implements Statement {
  nodeType: 'statement';

  constructor(
    public token: Token,
    public name: Identifier,
    public value?: Expression,
  ) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `${this.name.toString()} := ${
      this.value ? this.value.toString() : ''
    };`;
  }
}

/**
 * AST node type representing a return statement like `return var;`.
 *
 * @public
 */
export class ReturnStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public value?: Expression) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return this.value
      ? `${this.token.literal} ${this.value.toString()};`
      : `${this.token.literal};`;
  }
}

/**
 * AST node type representing a yield statement like `yield var;`. Must
 * be used within a generator function.
 *
 * @public
 */
export class YieldStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public value?: Expression) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return this.value
      ? `${this.token.literal} ${this.value.toString()};`
      : `${this.token.literal};`;
  }
}

/**
 * AST statement encapsulating an expression like `1 + 2;`.
 *
 * @public
 */
export class ExpressionStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public value?: Expression) {
    this.nodeType = 'statement';
  }

  toString(): string {
    if (this.value) {
      return `${this.value.toString()};`;
    }
    return '';
  }
}

/**
 * AST statement encapsulating a group of statements for a function body,
 * conditional, while loop, etc.
 *
 * @public
 */
export class BlockStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public statements: Statement[]) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `{ ${this.statements
      .map((s) => s.toString())
      .join('\n')} }`;
  }
}

/**
 * AST node type representing a `continue` statement for flow control within
 * a loop.
 *
 * @public
 */
export class ContinueStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `continue;`;
  }
}

/**
 * AST node type representing a `break` statement for flow control within
 * a loop.
 *
 * @public
 */
export class BreakStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `break;`;
  }
}

/**
 * AST node type representing a `for x in arr {}` expression.
 *
 * @public
 */
export class ForStatement implements Statement {
  nodeType: 'statement';

  constructor(
    public token: Token,
    public identifier: Identifier,
    public collection: Expression,
    public block: BlockStatement,
  ) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `for ${this.identifier.toString()} in ${this.collection.toString()} ${this.block.toString()}`;
  }
}

/**
 * AST node type representing a `while` or `loop` expression.
 *
 * @public
 */
export class WhileStatement implements Statement {
  nodeType: 'statement';

  constructor(
    public token: Token,
    public condition: Expression,
    public block: BlockStatement,
  ) {
    this.nodeType = 'statement';
  }

  toString(): string {
    if (this.token.tokenType === 'loop') {
      return `loop ${this.block.toString()}`;
    }
    return `while (${this.condition.toString()}) ${this.block.toString()}`;
  }
}

/**
 * Expressions
 */

/**
 * AST node type a variable identifier.
 *
 * @public
 */
export class Identifier implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: string) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value;
  }
}

/**
 * AST node type representing a variable assignment expression like `var = 1;`
 * or `arr[0] = 2`.
 *
 * @public
 */
export class AssignExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public name: Expression,
    public value?: Expression,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.name.toString()} = ${
      this.value ? this.value.toString() : ''
    };`;
  }
}

/**
 * AST node type representing a compound assignment expression like `var += 1;`
 * or `arr[0] *= 2`.
 *
 * @public
 */
export class CompoundAssignExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public name: Expression,
    public operator: string,
    public value?: Expression,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.name.toString()} ${this.operator} ${
      this.value ? this.value.toString() : ''
    };`;
  }
}

/**
 * AST node type representing an integer literal.
 *
 * @public
 */
export class IntegerLiteral implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: number) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value.toString();
  }
}

/**
 * AST node type representing a boolean literal.
 *
 * @public
 */
export class BooleanLiteral implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: boolean) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value.toString();
  }
}

/**
 * AST node type representing an array literal.
 *
 * @public
 */
export class ArrayLiteral implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public values: Expression[]) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `[${this.values
      .map((value) => value.toString())
      .join(', ')}]`;
  }
}

/**
 * AST node type representing a unary operator expression like `!true` or `-2`.
 *
 * @public
 */
export class PrefixExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public operator: string,
    public right?: Expression,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `(${this.operator}${
      this.right ? this.right.toString() : ''
    })`;
  }
}

/**
 * AST node type representing a binary operator expression like `1 + 2`.
 *
 * @public
 */
export class InfixExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public left: Expression | undefined,
    public operator: string,
    public right: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `(${this.left ? this.left.toString() : ''} ${
      this.operator
    } ${this.right ? this.right.toString() : ''})`;
  }
}

/**
 * AST node type representing an `if` or (`if`/`else`) conditional expression.
 *
 * @public
 */
export class IfExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public condition: Expression,
    public consequence: BlockStatement,
    public alternative?: BlockStatement,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    let str = `if (${this.condition.toString()}) ${this.consequence.toString()}`;
    if (this.alternative) {
      str += ` else ${this.alternative.toString()}`;
    }
    return str;
  }
}

/**
 * AST node type representing a function literal (`fn(...params) { ... }`).
 *
 * @public
 */
export class FunctionLiteral implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public parameters: Identifier[],
    public body: BlockStatement,
    public name?: string,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const params = this.parameters
      .map((p) => p.toString())
      .join(', ');
    return `${
      this.name || '<anonymous fn>'
    }(${params}) ${this.body.toString()}`;
  }
}

/**
 * AST node type representing a generator literal (`gen(...params) { ... }`).
 *
 * @public
 */
export class GeneratorLiteral implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public parameters: Identifier[],
    public body: BlockStatement,
    public name?: string,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const params = this.parameters
      .map((p) => p.toString())
      .join(', ');
    return `${
      this.name || '<anonymous gen>'
    }(${params}) ${this.body.toString()}`;
  }
}

/**
 * AST node type representing a comment (`// comment goes here`).
 *
 * @public
 */
export class CommentLiteral implements Expression {
  nodeType: 'expression';

  public body: string;

  constructor(public token: Token) {
    this.body = token.literal;
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.body;
  }
}

/**
 * AST node type representing a `next` expression.
 *
 * @public
 */
export class NextExpression implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public right?: Expression) {
    this.nodeType = 'expression';
  }

  toString(): string {
    if (!this.right) {
      return 'next';
    }
    return `next ${this.right.toString()}`;
  }
}

/**
 * AST node type representing an array index expression like `arr[1]`.
 *
 * @public
 */
export class IndexExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public collection: Expression,
    public index: Expression,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.collection.toString()}[${this.index.toString()}]`;
  }
}

/**
 * AST node type representing a function or generator call expression
 * like `f(...args)`.
 *
 * @public
 */
export class CallExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public fn: Expression | undefined,
    public args: Expression[],
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const args = this.args.map((p) => p.toString()).join(', ');
    return `${this.fn ? this.fn.toString() : ''}(${args})`;
  }
}

/**
 * AST node type representing a MIDI note expression.
 *
 * @public
 */
export class NoteExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public note: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token.literal} ${
      this.note ? this.note.toString() : ''
    }`;
  }
}

/**
 * AST node type representing a MIDI skip expression.
 *
 * @public
 */
export class SkipExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public duration: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token.literal} ${
      this.duration ? this.duration.toString() : ''
    }`;
  }
}

/**
 * AST node type representing a MIDI CC message expression.
 *
 * @public
 */
export class CCExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public message: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token.literal} ${
      this.message ? this.message.toString() : ''
    }`;
  }
}
