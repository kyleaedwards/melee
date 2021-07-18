import { Token } from './token';

/**
 * Interfaces
 */

interface Node {
  toString: () => string;
}

interface Statement extends Node {
  token: Token;
  nodeType: 'statement';
}

interface Expression extends Node {
  token: Token;
  nodeType: 'expression';
}

/**
 * Program
 */

class Program implements Node {
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

class DeclareStatement implements Statement {
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

class AssignStatement implements Statement {
  nodeType: 'statement';

  constructor(
    public token: Token,
    public name: Identifier,
    public value?: Expression,
  ) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return `${this.name.toString()} = ${
      this.value ? this.value.toString() : ''
    };`;
  }
}

class ReturnStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public value?: Expression) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return this.value
      ? `${this.token[1]} ${this.value.toString()};`
      : `${this.token[1]};`;
  }
}

class YieldStatement implements Statement {
  nodeType: 'statement';

  constructor(public token: Token, public value?: Expression) {
    this.nodeType = 'statement';
  }

  toString(): string {
    return this.value
      ? `${this.token[1]} ${this.value.toString()};`
      : `${this.token[1]};`;
  }
}

class ExpressionStatement implements Statement {
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

class BlockStatement implements Statement {
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
 * Expressions
 */

class Identifier implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: string) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value;
  }
}

class IntegerLiteral implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: number) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value.toString();
  }
}

class BooleanLiteral implements Expression {
  nodeType: 'expression';

  constructor(public token: Token, public value: boolean) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return this.value.toString();
  }
}

class ArrayLiteral implements Expression {
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

class PrefixExpression implements Expression {
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

class InfixExpression implements Expression {
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

class IfExpression implements Expression {
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

class WhileExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public condition: Expression,
    public block: BlockStatement,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    if (this.token[0] === 'loop') {
      return `loop ${this.block.toString()}`;
    }
    return `while (${this.condition.toString()}) ${this.block.toString()}`;
  }
}

class FunctionLiteral implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public parameters: Identifier[],
    public body: BlockStatement,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const params = this.parameters
      .map((p) => p.toString())
      .join(', ');
    return `fn (${params}) ${this.body.toString()}`;
  }
}

class GeneratorLiteral implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public parameters: Identifier[],
    public body: BlockStatement,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const params = this.parameters
      .map((p) => p.toString())
      .join(', ');
    return `seq (${params}) ${this.body.toString()}`;
  }
}

class NextLiteral implements Expression {
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

class CallExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public func: Expression | undefined,
    public args: Expression[],
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    const args = this.args.map((p) => p.toString()).join(', ');
    return `${this.func ? this.func.toString() : ''}(${args})`;
  }
}

class NoteExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public note: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token[1]} ${
      this.note ? this.note.toString() : ''
    }`;
  }
}

class SkipExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public duration: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token[1]} ${
      this.duration ? this.duration.toString() : ''
    }`;
  }
}

class CCExpression implements Expression {
  nodeType: 'expression';

  constructor(
    public token: Token,
    public message: Expression | undefined,
  ) {
    this.nodeType = 'expression';
  }

  toString(): string {
    return `${this.token[1]} ${
      this.message ? this.message.toString() : ''
    }`;
  }
}

export {
  Node,
  Statement,
  Expression,
  Program,
  DeclareStatement,
  AssignStatement,
  ReturnStatement,
  YieldStatement,
  ExpressionStatement,
  BlockStatement,
  Identifier,
  IntegerLiteral,
  BooleanLiteral,
  ArrayLiteral,
  PrefixExpression,
  InfixExpression,
  IfExpression,
  WhileExpression,
  FunctionLiteral,
  GeneratorLiteral,
  NextLiteral,
  CallExpression,
  NoteExpression,
  SkipExpression,
  CCExpression,
};
