import { Lexer } from './lexer';
import { Token, TokenType, tokenIs } from './token';
import { SynError } from './errors';
import * as ast from './ast';

type prefixParseFn = () => ast.Expression | undefined;
type infixParseFn = (
  left?: ast.Expression,
) => ast.Expression | undefined;

/**
 * AST child markers to detect unstable code.
 */
class ChildMarker {
  constructor(
    public hasYield = false,
    public hasBreak = false,
    public hasContinue = false,
    public hasReturn = false,
    public isLoop = false,
  ) {}
}

/**
 * Defines a precedence order for operations
 * when evaluating an expression.
 */
enum precedence {
  NIL = 1,
  OR,
  AND,
  ASN,
  EQL,
  CMP,
  ADD,
  MUL,
  PRF,
  FNC,
  IDX,
  ERR,
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
  or: precedence.OR,
  and: precedence.AND,
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
  identifier: precedence.ERR,
  number: precedence.ERR,
  note: precedence.ERR,
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
  public errors: SynError[];

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

  /**
   * Current parsing branch's child markers.
   *
   * @internal
   */
  private childMarkers: ChildMarker[] = [new ChildMarker()];

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
      next: this.parseNext.bind(this),
      note: this.parseNoteExpression.bind(this),
      rest: this.parseRestExpression.bind(this),
      cc: this.parseCCExpression.bind(this),
    };

    this.infixParseFns = {
      plus: this.parseInfixExpression.bind(this),
      minus: this.parseInfixExpression.bind(this),
      asterisk: this.parseInfixExpression.bind(this),
      rslash: this.parseInfixExpression.bind(this),
      percent: this.parseInfixExpression.bind(this),
      and: this.parseInfixExpression.bind(this),
      or: this.parseInfixExpression.bind(this),
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
    if (this.peek.tokenType === 'illegal') {
      this.errors.push(
        new SynError(
          `Unexpected token ${this.peek.literal}`,
          this.curr,
        ),
      );
    }
    while (this.peek.tokenType === 'comment') {
      this.curr = this.peek;
      this.peek = this.lexer.nextToken();
    }
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
    while (this.curr.tokenType === 'semicolon') {
      this.nextToken();
    }
    switch (this.curr.tokenType) {
      case 'return':
        this.childMarker().hasReturn = true;
        return this.parseReturnStatement();
      case 'yield':
        this.childMarker().hasYield = true;
        return this.parseYieldStatement();
      case 'while':
      case 'loop': {
        this.childMarkers.push(new ChildMarker());
        const token = this.curr;
        const result = this.parseWhile();
        const { hasBreak, hasReturn, hasYield } = this.childMarker();
        this.childMarkers.pop();
        if (token.tokenType === 'while') {
          return result;
        }
        if (!hasBreak && !hasReturn && !hasYield) {
          this.errors.push(
            new SynError(
              'Infinite loops must either `yield`, `return`, or `break`.',
              token,
            ),
          );
        }
        return result;
      }
      case 'if':
        return this.parseConditional();
      case 'identifier': {
        if (tokenIs(this.peek, 'declare')) {
          return this.parseDeclareStatement();
        }
        return this.parseExpressionStatement();
      }
      case 'continue': {
        this.childMarker().hasContinue = true;
        const stmt = new ast.ContinueStatement(this.curr);
        this.nextToken();
        return stmt;
      }
      case 'break': {
        this.childMarker().hasBreak = true;
        const stmt = new ast.BreakStatement(this.curr);
        this.nextToken();
        return stmt;
      }
      case 'for':
        return this.parseFor();
      case 'comment':
        return;
      default:
        return this.parseExpressionStatement();
    }
  }

  private parseDeclareStatement(): ast.DeclareStatement | undefined {
    const name = new ast.Identifier(this.curr, this.curr.literal);
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
    const prefixFn = this.prefixParseFns[this.curr.tokenType];
    if (!prefixFn) {
      this.errors.push(
        new SynError(
          `Unexpected token \`${this.curr.literal}\``,
          this.curr,
        ),
      );
      return;
    }

    let left: ast.Expression | undefined = prefixFn.call(this);

    while (
      !tokenIs(this.peek, 'semicolon') &&
      precedence < this.peekPrecedence()
    ) {
      const infixFn = this.infixParseFns[this.peek.tokenType];
      if (!infixFn) {
        this.errors.push(
          new SynError(
            `Unexpected token in infix expression ${this.curr.literal}`,
            this.curr,
          ),
        );
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
    const operator = this.curr.literal;

    this.nextToken();
    const right = this.parseExpression(precedence.PRF);

    return new ast.PrefixExpression(token, operator, right);
  }

  private parseInfixExpression(
    left?: ast.Expression,
  ): ast.Expression | undefined {
    const token = this.curr;
    const operator = this.curr.literal;

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
    const operator = this.curr.literal;

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

  private parseNoteExpression(): ast.NoteExpression | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const args = this.parseExpressionList('rparen');
    return new ast.NoteExpression(token, args);
  }

  private parseRestExpression(): ast.RestExpression | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const args = this.parseExpressionList('rparen');
    return new ast.RestExpression(token, args);
  }

  private parseCCExpression(): ast.CCExpression | undefined {
    const token = this.curr;
    if (!this.expectPeek('lparen')) return;
    const args = this.parseExpressionList('rparen');
    return new ast.CCExpression(token, args);
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
    return new ast.Identifier(this.curr, this.curr.literal);
  }

  private parseBooleanLiteral(): ast.BooleanLiteral {
    return new ast.BooleanLiteral(
      this.curr,
      this.curr.literal === 'true',
    );
  }

  private parseIntegerLiteral(): ast.IntegerLiteral {
    return new ast.IntegerLiteral(
      this.curr,
      parseInt(this.curr.literal, 10),
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

  private parseConditional(): ast.IfStatement | undefined {
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
      if (tokenIs(this.peek, 'if')) {
        this.nextToken();
        const stmt = this.parseStatement();
        if (!stmt) {
          throw new SynError('Invalid `else if` clause', this.peek);
        }
        alternative = new ast.BlockStatement(this.curr, [stmt]);
      } else {
        if (!this.expectPeek('lbrace')) return;
        alternative = this.parseBlockStatement();
      }
    }

    return new ast.IfStatement(
      token,
      condition,
      consequence,
      alternative,
    );
  }

  private parseFor(): ast.ForStatement | undefined {
    const token = this.curr;

    if (!this.expectPeek('identifier')) {
      return;
    }

    const identifier = this.parseIdentifier();

    if (!this.expectPeek('in')) return;
    this.nextToken();

    const collToken = this.curr;
    const collection = this.parseExpression(precedence.NIL);
    if (!collection) {
      this.errors.push(
        new SynError(
          '`for` expression must follow the `for var in collection {}` syntax',
          collToken,
        ),
      );
      return;
    }

    if (!this.expectPeek('lbrace')) return;
    const block = this.parseBlockStatement();

    return new ast.ForStatement(token, identifier, collection, block);
  }

  private parseWhile(): ast.WhileStatement | undefined {
    const token = this.curr;

    // If using the syntactic sugar `loop` keyword, just
    // create a true boolean conditional.
    let condition;
    if (token.tokenType === 'loop') {
      condition = new ast.BooleanLiteral(
        {
          ...token,
          tokenType: 'true',
          literal: 'true',
        },
        true,
      );
    } else {
      if (!this.expectPeek('lparen')) return;
      this.nextToken();
      condition = this.parseExpression(precedence.NIL);
      if (!this.expectPeek('rparen')) return;
    }

    if (!this.expectPeek('lbrace')) return;
    if (!condition) return;

    const block = this.parseBlockStatement();
    return new ast.WhileStatement(token, condition, block);
  }

  private parseCallExpression(
    left?: ast.Expression,
  ): ast.CallExpression {
    const token = this.curr;
    const args = this.parseExpressionList('rparen');
    return new ast.CallExpression(token, left, args);
  }

  /** Utilities **/

  private peekPrecedence(): precedence {
    return PRECEDENCE_MAP[this.peek.tokenType]
      ? PRECEDENCE_MAP[this.peek.tokenType]
      : precedence.NIL;
  }

  private currPrecedence(): precedence {
    return PRECEDENCE_MAP[this.curr.tokenType]
      ? PRECEDENCE_MAP[this.curr.tokenType]
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
      const { tokenType } = this.peek;
      const msg = `Expected next token to be ${t}, got ${tokenType} instead`;
      this.errors.push(new SynError(msg, this.peek));
      return false;
    }
  }

  private skipSemicolon(): void {
    if (tokenIs(this.peek, 'semicolon')) {
      this.nextToken();
    }
  }

  private childMarker(): ChildMarker {
    if (this.childMarkers.length) {
      return this.childMarkers[this.childMarkers.length - 1];
    }
    const childMarker = new ChildMarker();
    this.childMarkers.push(childMarker);
    return childMarker;
  }
}
