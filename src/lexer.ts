import { Token, lookupIdentifier, TokenType } from './token';

/**
 * Returns if the provided character is alphabetic.
 *
 * @internal
 * @param char - Character
 * @returns True if alphabetic
 */
function isAlpha(char: string): boolean {
  return (
    ('a' <= char && char <= 'z') ||
    ('A' <= char && char <= 'Z') ||
    char === '_'
  );
}

/**
 * Returns if the provided character is numeric.
 *
 * @internal
 * @param char - Character
 * @returns True if numeric
 */
function isNumeric(char: string): boolean {
  return '0' <= char && char <= '9';
}

/**
 * Returns if the provided character is alphanumeric.
 *
 * @internal
 * @param char - Character
 * @returns True if alphanumeric
 */
function isAlphaNumeric(char: string): boolean {
  return isAlpha(char) || isNumeric(char) || char === '#';
}

/**
 * Lexer class to create tokens from code string.
 */
export class Lexer {
  private position = 0;
  private readPosition = 0;
  private line = 0;
  private column = -1;
  private char: string;

  /**
   * Constructs a new lexer object.
   *
   * @param input - Code string
   */
  constructor(
    /**
     * Code snippet to be lexed.
     */
    public input: string,
  ) {
    this.char = '';
    this.readChar();
  }

  /**
   * Reads a character and advances the lexer's position.
   *
   * @internal
   */
  private readChar(this: Lexer) {
    if (this.readPosition >= this.input.length) {
      this.char = '';
    } else {
      this.char = this.input[this.readPosition];
    }
    if (this.char === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    this.position = this.readPosition;
    this.readPosition++;
  }

  /**
   * Returns the next character if possible without advancing
   * the lexer's position.
   *
   * @internal
   */
  private peekChar(this: Lexer): string {
    if (this.readPosition >= this.input.length) {
      return '';
    }
    return this.input[this.readPosition];
  }

  /**
   * Skips whitespace characters until a non-whitespace character
   * is reached.
   *
   * @internal
   */
  private skipWhitespace(this: Lexer) {
    while (this.char !== '' && ' \t\n\r'.indexOf(this.char) !== -1) {
      this.readChar();
    }
  }

  /**
   * Attempts to read a numeral from the input text.
   *
   * @internal
   * @returns Numeral string
   */
  private readIdentifier(this: Lexer): string {
    const start: number = this.position;
    if (isAlpha(this.char)) {
      this.readChar();
    } else {
      return '';
    }
    while (isAlphaNumeric(this.char)) {
      this.readChar();
    }
    return this.input.slice(start, this.position);
  }

  /**
   * Attempts to read a numeral from the input text.
   *
   * @returns Numeral string
   */
  private readNumber(this: Lexer): string {
    const start: number = this.position;
    while (isNumeric(this.char)) {
      this.readChar();
    }
    return this.input.slice(start, this.position);
  }

  /**
   * Creates a new token with the current cursor position.
   *
   * @returns New token
   */
  private createToken(tokenType: TokenType, literal: string): Token {
    return {
      tokenType,
      literal,
      line: this.line,
      column: this.column,
    };
  }

  /**
   * Iterates over characters until it can determine the next
   * valid token.
   *
   * @public
   * @returns Next token
   */
  nextToken(this: Lexer): Token {
    let token = this.createToken('illegal', this.char);

    this.skipWhitespace();

    switch (this.char) {
      case '=':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('eq', '==');
        } else {
          token = this.createToken('assign', this.char);
        }
        break;
      case ';':
        token = this.createToken('semicolon', this.char);
        break;
      case ':':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('declare', ':=');
        } else {
          token = this.createToken('colon', this.char);
        }
        break;
      case '(':
        token = this.createToken('lparen', this.char);
        break;
      case ')':
        token = this.createToken('rparen', this.char);
        break;
      case '{':
        token = this.createToken('lbrace', this.char);
        break;
      case '}':
        token = this.createToken('rbrace', this.char);
        break;
      case '[':
        token = this.createToken('lbracket', this.char);
        break;
      case ']':
        token = this.createToken('rbracket', this.char);
        break;
      case ',':
        token = this.createToken('comma', this.char);
        break;
      case '+':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('pluseq', '+=');
        } else {
          token = this.createToken('plus', this.char);
        }
        break;
      case '-':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('minuseq', '-=');
        } else {
          token = this.createToken('minus', this.char);
        }
        break;
      case '*':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('asteriskeq', '*=');
        } else {
          token = this.createToken('asterisk', this.char);
        }
        break;
      case '/':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('rslasheq', '/=');
        } else if (this.peekChar() == '/') {
          this.readChar();
          let literal = '//';
          while (this.peekChar() != '\n' && this.peekChar() != '') {
            literal += this.readChar();
          }
          token = this.createToken('comment', literal);
        } else {
          token = this.createToken('rslash', this.char);
        }
        break;
      case '%':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('percenteq', '%=');
        } else {
          token = this.createToken('percent', this.char);
        }
        break;
      case '!':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('noteq', '!=');
        } else {
          token = this.createToken('bang', this.char);
        }
        break;
      case '&':
        if (this.peekChar() == '&') {
          this.readChar();
          token = this.createToken('and', '&&');
        }
        break;
      case '|':
        if (this.peekChar() == '|') {
          this.readChar();
          token = this.createToken('or', '||');
        }
        break;
      case '>':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('gte', '>=');
        } else {
          token = this.createToken('gt', this.char);
        }
        break;
      case '<':
        if (this.peekChar() == '=') {
          this.readChar();
          token = this.createToken('lte', '<=');
        } else {
          token = this.createToken('lt', this.char);
        }
        break;
      case '':
        token = this.createToken('eof', '');
        break;
      default:
        if (isAlpha(this.char)) {
          const literal = this.readIdentifier();
          return this.createToken(lookupIdentifier(literal), literal);
        }
        if (isNumeric(this.char)) {
          return this.createToken('int', this.readNumber());
        }
    }

    this.readChar();
    return token;
  }
}
