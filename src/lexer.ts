import { Token, lookupIdentifier } from './token';

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
  private position: number;
  private readPosition: number;
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
    this.position = 0;
    this.readPosition = 0;
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
   * Iterates over characters until it can determine the next
   * valid token.
   *
   * @public
   * @returns Next token
   */
  nextToken(this: Lexer): Token {
    let token: Token;

    this.skipWhitespace();

    switch (this.char) {
      case '=':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['eq', '=='];
        } else {
          token = ['assign', this.char];
        }
        break;
      case ';':
        token = ['semicolon', this.char];
        break;
      case ':':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['declare', ':='];
        } else {
          token = ['colon', this.char];
        }
        break;
      case '(':
        token = ['lparen', this.char];
        break;
      case ')':
        token = ['rparen', this.char];
        break;
      case '{':
        token = ['lbrace', this.char];
        break;
      case '}':
        token = ['rbrace', this.char];
        break;
      case '[':
        token = ['lbracket', this.char];
        break;
      case ']':
        token = ['rbracket', this.char];
        break;
      case ',':
        token = ['comma', this.char];
        break;
      case '+':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['pluseq', '+='];
        } else {
          token = ['plus', this.char];
        }
        break;
      case '-':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['minuseq', '-='];
        } else {
          token = ['minus', this.char];
        }
        break;
      case '*':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['asteriskeq', '*='];
        } else {
          token = ['asterisk', this.char];
        }
        break;
      case '/':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['rslasheq', '/='];
        } else if (this.peekChar() == '/') {
          this.readChar();
          let literal = '//';
          while (this.peekChar() != '\n' && this.peekChar() != '') {
            literal += this.readChar();
          }
          token = ['comment', literal];
        } else {
          token = ['rslash', this.char];
        }
        break;
      case '%':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['percenteq', '%='];
        } else {
          token = ['percent', this.char];
        }
        break;
      case '!':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['noteq', '!='];
        } else {
          token = ['bang', this.char];
        }
        break;
      case '>':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['gte', '>='];
        } else {
          token = ['gt', this.char];
        }
        break;
      case '<':
        if (this.peekChar() == '=') {
          this.readChar();
          token = ['lte', '<='];
        } else {
          token = ['lt', this.char];
        }
        break;
      case '':
        token = ['eof', ''];
        break;
      default:
        if (isAlpha(this.char)) {
          const literal = this.readIdentifier();
          return [lookupIdentifier(literal), literal];
        }
        if (isNumeric(this.char)) {
          return ['int', this.readNumber()];
        }
        token = ['illegal', this.char];
    }

    this.readChar();
    return token;
  }
}
