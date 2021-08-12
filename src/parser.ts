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
  ASN,
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
  assign: precedence.ASN,
  pluseq: precedence.ASN,
  minuseq: precedence.ASN,
  asteriskeq: precedence.ASN,
  rslasheq: precedence.ASN,
  percenteq: precedence.ASN,
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

/**
 * Parses tokens to generate an AST (abstract syntax tree).
 */
export class Parser {
  /**
   * Current token being parsed.
   */
  private curr: Token;

  /**
   * Next token to be parsed.
   */
  private peek: Token;

  /**
   * Collection of errors incurred during the parsing process.
   */
  public errors: string[];

  /**
   * Mapping of tokens to prefix parser methods.
   *
   * @internal
   */
  private prefixParseFns: Record<string, prefixParseFn>;

  /**
   * Mapping of tokens to infix parser methods.
   *
   * @internal
   */
  private infixParseFns: Record<string, infixParseFn>;

  constructor(
    /**
     * Lexer instantiated with code to be parsed.
     */
    public lexer: Lexer,
  ) {
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
      for: this.parseFor.bind(this),
      while: this.parseWhile.bind(this),
      loop: this.parseWhile.bind(this),
      next: this.parseNext.bind(this),
      note: this.parseNoteExpression.bind(this),
      skip: this.parseSkipExpression.bind(this),
      cc: this.parseCCExpression.bind(this),
      comment: this.parseComment.bind(this),
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
      assign: this.parseAssignExpression.bind(this),
      pluseq: this.parseCompoundAssignmentExpression.bind(this),
      minuseq: this.parseCompoundAssignmentExpression.bind(this),
      asteriskeq: this.parseCompoundAssignmentExpression.bind(this),
      rslasheq: this.parseCompoundAssignmentExpression.bind(this),
      percenteq: this.parseCompoundAssignmentExpression.bind(this),
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

  private parseStatement(): ast.Statement | undefined {
    switch (this.curr[0]) {
      case 'return':
        return this.parseReturnStatement();
      case 'yield':
        return this.parseYieldStatement();
      case 'identifier': {
        if (tokenIs(this.peek, 'declare')) {
          return this.parseDeclareStatement();
        }
        return this.parseExpressionStatement();
      }
      case 'continue': {
        const stmt = new ast.ContinueStatement(this.curr);
        this.nextToken();
        return stmt;
      }
      case 'break': {
        const stmt = new ast.BreakStatement(this.curr);
        this.nextToken();
        return stmt;
      }
      default: {
        return this.parseExpressionStatement();
      }
    }
  }

  private parseDeclareStatement(): ast.DeclareStatement | undefined {
    const name = new ast.Identifier(this.curr, this.curr[1]);
    this.nextToken();
    const declare = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    if (
      value instanceof ast.FunctionLiteral ||
      value instanceof ast.GeneratorLiteral
    ) {
      value.name = name.value;
    }

    this.skipSemicolon();

    return new ast.DeclareStatement(declare, name, value);
  }

  private parseReturnStatement(): ast.ReturnStatement {
    const token = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.ReturnStatement(token, value);
  }

  private parseYieldStatement(): ast.YieldStatement {
    const token = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.YieldStatement(token, value);
  }

  private parseExpressionStatement(): ast.ExpressionStatement {
    const token = this.curr;
    const expr = this.parseExpression(precedence.NIL);

    this.skipSemicolon();

    return new ast.ExpressionStatement(token, expr);
  }

  private parseBlockStatement(): ast.BlockStatement {
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

  private parseExpression(
    precedence: number,
  ): ast.Expression | undefined {
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

  private parsePrefixExpression(): ast.Expression | undefined {
    const token = this.curr;
    const operator = this.curr[1];

    this.nextToken();
    const right = this.parseExpression(precedence.PRF);

    return new ast.PrefixExpression(token, operator, right);
  }

  private parseInfixExpression(
    left?: ast.Expression,
  ): ast.Expression | undefined {
    const token = this.curr;
    const operator = this.curr[1];

    const leftPrecedence = this.currPrecedence();
    this.nextToken();
    const right = this.parseExpression(leftPrecedence);

    return new ast.InfixExpression(token, left, operator, right);
  }

  private parseCompoundAssignmentExpression(
    left?: ast.Expression,
  ): ast.Expression | undefined {
    if (!left) {
      throw new Error(
        'Error compiling compound assignment expression',
      );
    }

    const token = this.curr;
    const operator = this.curr[1];

    this.nextToken();
    const right = this.parseExpression(precedence.NIL);

    return new ast.CompoundAssignExpression(
      token,
      left,
      operator,
      right,
    );
  }

  private parseAssignExpression(
    left?: ast.Expression,
  ): ast.AssignExpression | undefined {
    if (!left) {
      throw new Error('Error compiling assignment expression');
    }

    const token = this.curr;
    this.nextToken();
    const value = this.parseExpression(precedence.NIL);

    return new ast.AssignExpression(token, left, value);
  }

  private parseIndexExpression(
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

  private parseNoteExpression(): ast.NoteExpression {
    const token = this.curr;

    this.nextToken();
    const data = this.parseExpression(precedence.NIL);

    return new ast.NoteExpression(token, data);
  }

  private parseSkipExpression(): ast.SkipExpression {
    const token = this.curr;

    this.nextToken();
    const duration = this.parseExpression(precedence.NIL);

    return new ast.SkipExpression(token, duration);
  }

  private parseCCExpression(): ast.CCExpression {
    const token = this.curr;

    this.nextToken();
    const message = this.parseExpression(precedence.NIL);

    return new ast.CCExpression(token, message);
  }

  private parseParentheticalExpression(): ast.Expression | undefined {
    this.nextToken();
    const expr = this.parseExpression(precedence.NIL);
    if (!this.expectPeek('rparen')) {
      return;
    }
    return expr;
  }

  private parseIdentifier(): ast.Identifier {
    return new ast.Identifier(this.curr, this.curr[1]);
  }

  private parseBooleanLiteral(): ast.BooleanLiteral {
    return new ast.BooleanLiteral(this.curr, this.curr[1] === 'true');
  }

  private parseIntegerLiteral(): ast.IntegerLiteral {
    return new ast.IntegerLiteral(
      this.curr,
      parseInt(this.curr[1], 10),
    );
  }

  private parseArrayLiteral(): ast.ArrayLiteral {
    return new ast.ArrayLiteral(
      this.curr,
      this.parseExpressionList('rbracket'),
    );
  }

  private parseFunctionLiteral(): ast.FunctionLiteral | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const parameters = this.parseFunctionParameters();
    if (!this.expectPeek('lbrace')) return;
    const body = this.parseBlockStatement();
    return new ast.FunctionLiteral(token, parameters, body);
  }

  private parseGeneratorLiteral(): ast.GeneratorLiteral | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const parameters = this.parseFunctionParameters();
    if (!this.expectPeek('lbrace')) return;
    const body = this.parseBlockStatement();
    return new ast.GeneratorLiteral(token, parameters, body);
  }

  private parseNext(): ast.NextExpression {
    const token = this.curr;

    this.nextToken();
    const right = this.parseExpression(precedence.PRF);

    return new ast.NextExpression(token, right);
  }

  private parseConditional(): ast.IfExpression | undefined {
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

  private parseFor(): ast.ForExpression | undefined {
    const token = this.curr;

    if (!this.expectPeek('identifier')) {
      return;
    }

    const identifier = this.parseIdentifier();

    if (!this.expectPeek('in')) return;
    this.nextToken();

    const collection = this.parseExpression(precedence.NIL);
    if (!collection) {
      this.errors.push(
        '`for` expression must follow the `for var in collection {}` syntax',
      );
      return;
    }

    if (!this.expectPeek('lbrace')) return;
    const block = this.parseBlockStatement();

    return new ast.ForExpression(
      token,
      identifier,
      collection,
      block,
    );
  }

  private parseWhile(): ast.WhileExpression | undefined {
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

  private parseCallExpression(
    left?: ast.Expression,
  ): ast.CallExpression {
    const token = this.curr;
    const args = this.parseExpressionList('rparen');
    return new ast.CallExpression(token, left, args);
  }

  private parseComment(): ast.CommentLiteral {
    return new ast.CommentLiteral(this.curr);
  }

  /** Utilities **/

  private peekPrecedence(): precedence {
    return PRECEDENCE_MAP[this.peek[0]]
      ? PRECEDENCE_MAP[this.peek[0]]
      : precedence.NIL;
  }

  private currPrecedence(): precedence {
    return PRECEDENCE_MAP[this.curr[0]]
      ? PRECEDENCE_MAP[this.curr[0]]
      : precedence.NIL;
  }

  private parseFunctionParameters(): ast.Identifier[] {
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

  private parseExpressionList(endChar: TokenType): ast.Expression[] {
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

  private expectPeek(t: TokenType): boolean {
    if (tokenIs(this.peek, t)) {
      this.nextToken();
      return true;
    } else {
      const msg = `Expected next token to be ${t}, got ${this.peek[0]} instead`;
      this.errors.push(msg);
      return false;
    }
  }

  private skipSemicolon(): void {
    if (tokenIs(this.peek, 'semicolon')) {
      this.nextToken();
    }
  }
}
