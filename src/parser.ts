import { Lexer } from './lexer';
import { Token, TokenType, tokenIs } from './token';
import * as ast from './ast';

type prefixParseFn = () => ast.Expression | undefined;
type infixParseFn = (
  left?: ast.Expression,
) => ast.Expression | undefined;

/**
 * Defines a precedence order for operations
 * when evaluating an expression.
 */
enum precedence {
  NIL = 1,
  EQL,
  CMP,
  ADD,
  MUL,
  PRF,
  FNC,
  IDX,
}

/**
 * Assigns precedence values to tokens.
 */
const PRECEDENCE_MAP: Record<string, precedence> = {
  eq: precedence.EQL,
  noteq: precedence.EQL,
  lt: precedence.CMP,
  lte: precedence.CMP,
  gt: precedence.CMP,
  gte: precedence.CMP,
  plus: precedence.ADD,
  minus: precedence.ADD,
  asterisk: precedence.MUL,
  rslash: precedence.MUL,
  percent: precedence.MUL,
  lparen: precedence.FNC,
  lbracket: precedence.IDX,
};

class Parser {
  curr: Token;
  peek: Token;
  errors: string[];

  prefixParseFns: Record<string, prefixParseFn>;
  infixParseFns: Record<string, infixParseFn>;

  constructor(public lexer: Lexer) {
    this.errors = [];

    this.prefixParseFns = {
      identifier: this.parseIdentifier.bind(this),
      true: this.parseBooleanLiteral.bind(this),
      false: this.parseBooleanLiteral.bind(this),
      int: this.parseIntegerLiteral.bind(this),
      fn: this.parseFunctionLiteral.bind(this),
      gen: this.parseGeneratorLiteral.bind(this),
      bang: this.parsePrefixExpression.bind(this),
      minus: this.parsePrefixExpression.bind(this),
      lparen: this.parseParentheticalExpression.bind(this),
      lbracket: this.parseArrayLiteral.bind(this),
      if: this.parseConditional.bind(this),
      next: this.parseNext.bind(this),
      note: this.parseNoteExpression.bind(this),
      skip: this.parseSkipExpression.bind(this),
      cc: this.parseCCExpression.bind(this),
    };

    this.infixParseFns = {
      plus: this.parseInfixExpression.bind(this),
      minus: this.parseInfixExpression.bind(this),
      asterisk: this.parseInfixExpression.bind(this),
      rslash: this.parseInfixExpression.bind(this),
      percent: this.parseInfixExpression.bind(this),
      eq: this.parseInfixExpression.bind(this),
      noteq: this.parseInfixExpression.bind(this),
      lt: this.parseInfixExpression.bind(this),
      lte: this.parseInfixExpression.bind(this),
      gt: this.parseInfixExpression.bind(this),
      gte: this.parseInfixExpression.bind(this),
      lparen: this.parseCallExpression.bind(this),
      lbracket: this.parseIndexExpression.bind(this),
    };

    this.curr = this.lexer.nextToken();
    this.peek = this.lexer.nextToken();
  }

  /**
   * Steps through the lexer and updates the current
   * and peek token properties.
   *
   * @internal
   */
  nextToken(): void {
    this.curr = this.peek;
    this.peek = this.lexer.nextToken();
  }

  public expectPeek(t: TokenType): boolean {
    if (tokenIs(this.peek, t)) {
      this.nextToken();
      return true;
    } else {
      const msg = `Expected next token to be ${t}, got ${this.peek[0]} instead`;
      this.errors.push(msg);
      return false;
    }
  }

  /**
   * Starts as the first lexer token and attempts to parse the full program.
   *
   * @returns {ast.Program} Top-level program AST node
   */
  parse(): ast.Program {
    const program = new ast.Program();

    while (!tokenIs(this.curr, 'eof')) {
      const stmt = this.parseStatement();
      if (stmt) {
        program.statements.push(stmt);
      }
      this.nextToken();
    }

    return program;
  }

  /** Statements **/

  parseStatement(): ast.Statement | undefined {
    switch (this.curr[0]) {
      case 'return':
        return this.parseReturnStatement();
      case 'yield':
        return this.parseYieldStatement();
      case 'identifier': {
        if (tokenIs(this.peek, 'declare')) {
          return this.parseDeclareStatement();
        }
        if (tokenIs(this.peek, 'assign')) {
          return this.parseAssignStatement();
        }
        return this.parseExpressionStatement();
      }
      default: {
        return this.parseExpressionStatement();
      }
    }
  }

  parseDeclareStatement(): ast.DeclareStatement | undefined {
    const name = new ast.Identifier(this.curr, this.curr[1]);
    this.nextToken();
    const declare = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.DeclareStatement(declare, name, value);
  }

  parseAssignStatement(): ast.AssignStatement | undefined {
    const name = new ast.Identifier(this.curr, this.curr[1]);
    this.nextToken();
    const declare = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.AssignStatement(declare, name, value);
  }

  parseReturnStatement(): ast.ReturnStatement {
    const token = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.ReturnStatement(token, value);
  }

  parseYieldStatement(): ast.YieldStatement {
    const token = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.YieldStatement(token, value);
  }

  parseExpressionStatement(): ast.ExpressionStatement {
    const token = this.curr;
    const expr = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.ExpressionStatement(token, expr);
  }

  parseBlockStatement(): ast.BlockStatement {
    const block = new ast.BlockStatement(this.curr, []);
    this.nextToken();

    while (
      !tokenIs(this.curr, 'rbrace') &&
      !tokenIs(this.curr, 'eof')
    ) {
      const stmt = this.parseStatement();
      if (stmt) {
        block.statements.push(stmt);
      }
      this.nextToken();
    }

    return block;
  }

  /** Expressions **/

  parseExpression(precedence: number): ast.Expression | undefined {
    // Attempt to parse a prefix expression
    const prefixFn = this.prefixParseFns[this.curr[0]];
    if (!prefixFn) {
      this.errors.push(`No prefix parser for \`${this.curr[0]}\``);
      return;
    }

    let left: ast.Expression | undefined = prefixFn.call(this);

    while (
      !tokenIs(this.peek, 'semicolon') &&
      precedence < this.peekPrecedence()
    ) {
      const infixFn = this.infixParseFns[this.peek[0]];
      if (!infixFn) {
        return left;
      }
      this.nextToken();

      if (left) {
        left = infixFn.call(this, left);
      }
    }

    return left;
  }

  parsePrefixExpression(): ast.Expression | undefined {
    const token = this.curr;
    const operator = this.curr[1];

    this.nextToken();
    const right = this.parseExpression(precedence.PRF);

    return new ast.PrefixExpression(token, operator, right);
  }

  parseInfixExpression(
    left?: ast.Expression,
  ): ast.Expression | undefined {
    const token = this.curr;
    const operator = this.curr[1];

    const leftPrecedence = this.currPrecedence();
    this.nextToken();
    const right = this.parseExpression(leftPrecedence);

    return new ast.InfixExpression(token, left, operator, right);
  }

  parseIndexExpression(
    collection?: ast.Expression,
  ): ast.Expression | undefined {
    const token = this.curr;

    if (!collection) return;

    this.nextToken();
    const index = this.parseExpression(precedence.NIL);
    if (!index) return;

    if (!this.expectPeek('rbracket')) return;

    return new ast.IndexExpression(token, collection, index);
  }

  parseNoteExpression(): ast.NoteExpression {
    const token = this.curr;

    this.nextToken();
    const data = this.parseExpression(precedence.NIL);

    return new ast.NoteExpression(token, data);
  }

  parseSkipExpression(): ast.SkipExpression {
    const token = this.curr;

    this.nextToken();
    const duration = this.parseExpression(precedence.NIL);

    return new ast.SkipExpression(token, duration);
  }

  parseCCExpression(): ast.CCExpression {
    const token = this.curr;

    this.nextToken();
    const message = this.parseExpression(precedence.NIL);

    return new ast.CCExpression(token, message);
  }

  parseParentheticalExpression(): ast.Expression | undefined {
    this.nextToken();
    const expr = this.parseExpression(precedence.NIL);
    if (!this.expectPeek('rparen')) {
      return;
    }
    return expr;
  }

  parseIdentifier(): ast.Identifier {
    return new ast.Identifier(this.curr, this.curr[1]);
  }

  parseBooleanLiteral(): ast.BooleanLiteral {
    return new ast.BooleanLiteral(this.curr, this.curr[1] === 'true');
  }

  parseIntegerLiteral(): ast.IntegerLiteral {
    return new ast.IntegerLiteral(
      this.curr,
      parseInt(this.curr[1], 10),
    );
  }

  parseArrayLiteral(): ast.ArrayLiteral {
    return new ast.ArrayLiteral(
      this.curr,
      this.parseArgumentList('rbracket'),
    );
  }

  parseFunctionLiteral(): ast.FunctionLiteral | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const parameters = this.parseFunctionParameters();
    if (!this.expectPeek('lbrace')) return;
    const body = this.parseBlockStatement();
    return new ast.FunctionLiteral(token, parameters, body);
  }

  parseGeneratorLiteral(): ast.GeneratorLiteral | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const parameters = this.parseFunctionParameters();
    if (!this.expectPeek('lbrace')) return;
    const body = this.parseBlockStatement();
    return new ast.GeneratorLiteral(token, parameters, body);
  }

  parseNext(): ast.NextLiteral {
    const token = this.curr;

    this.nextToken();
    const right = this.parseExpression(precedence.PRF);

    return new ast.NextLiteral(token, right);
  }

  parseConditional(): ast.IfExpression | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;

    this.nextToken();

    const condition = this.parseExpression(precedence.NIL);
    if (!this.expectPeek('rparen')) return;
    if (!this.expectPeek('lbrace')) return;
    if (!condition) return;

    const consequence = this.parseBlockStatement();
    let alternative;

    if (tokenIs(this.peek, 'else')) {
      this.nextToken();
      if (!this.expectPeek('lbrace')) return;
      alternative = this.parseBlockStatement();
    }

    return new ast.IfExpression(
      token,
      condition,
      consequence,
      alternative,
    );
  }

  parseWhile(): ast.WhileExpression | undefined {
    const token = this.curr;

    // If using the syntactic sugar `loop` keyword, just
    // create a true boolean conditional.
    let condition;
    if (token[0] === 'loop') {
      condition = new ast.BooleanLiteral(['true', 'true'], true);
    } else {
      if (!this.expectPeek('lparen')) return;
      this.nextToken();
      condition = this.parseExpression(precedence.NIL);
      if (!this.expectPeek('rparen')) return;
    }

    if (!this.expectPeek('lbrace')) return;
    if (!condition) return;

    const block = this.parseBlockStatement();
    return new ast.WhileExpression(token, condition, block);
  }

  parseCallExpression(left?: ast.Expression): ast.CallExpression {
    const token = this.curr;
    const args = this.parseArgumentList('rparen');
    return new ast.CallExpression(token, left, args);
  }

  /** Utilities **/

  peekPrecedence(): precedence {
    return PRECEDENCE_MAP[this.peek[0]]
      ? PRECEDENCE_MAP[this.peek[0]]
      : precedence.NIL;
  }

  currPrecedence(): precedence {
    return PRECEDENCE_MAP[this.curr[0]]
      ? PRECEDENCE_MAP[this.curr[0]]
      : precedence.NIL;
  }

  parseFunctionParameters(): ast.Identifier[] {
    const parameters: ast.Identifier[] = [];

    if (tokenIs(this.peek, 'rparen')) {
      this.nextToken();
      return parameters;
    }

    this.nextToken();
    parameters.push(this.parseIdentifier());

    while (tokenIs(this.peek, 'comma')) {
      this.nextToken();
      this.nextToken();
      parameters.push(this.parseIdentifier());
    }

    if (!tokenIs(this.peek, 'rparen')) {
      return [];
    }

    this.nextToken();
    return parameters;
  }

  parseArgumentList(endChar: TokenType): ast.Expression[] {
    const args: ast.Expression[] = [];

    if (tokenIs(this.peek, endChar)) {
      this.nextToken();
      return args;
    }

    this.nextToken();
    let expr = this.parseExpression(precedence.NIL);
    if (expr) {
      args.push(expr);
    }

    while (tokenIs(this.peek, 'comma')) {
      this.nextToken();
      this.nextToken();
      expr = this.parseExpression(precedence.NIL);
      if (expr) {
        args.push(expr);
      }
    }

    if (!tokenIs(this.peek, endChar)) {
      return [];
    }

    this.nextToken();
    return args;
  }

  skipSemicolon(): void {
    if (tokenIs(this.peek, 'semicolon')) {
      this.nextToken();
    }
  }
}

export { Parser };
