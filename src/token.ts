/**
 * Token tuple
 */
export interface Token {
  tokenType: TokenType;
  literal: string;
  line: number;
  column: number;
}

/**
 * List of allowed token types
 */
export type TokenType =
  | 'illegal'
  | 'eof'
  | 'identifier'
  | 'int'
  | 'true'
  | 'false'
  | 'if'
  | 'else'
  | 'and'
  | 'or'
  | 'for'
  | 'in'
  | 'while'
  | 'loop'
  | 'return'
  | 'fn'
  | 'continue'
  | 'break'
  | 'yield'
  | 'note'
  | 'rest'
  | 'cc'
  | 'gen'
  | 'next'
  | 'declare'
  | 'assign'
  | 'plus'
  | 'minus'
  | 'asterisk'
  | 'rslash'
  | 'percent'
  | 'pluseq'
  | 'minuseq'
  | 'asteriskeq'
  | 'rslasheq'
  | 'percenteq'
  | 'bang'
  | 'eq'
  | 'noteq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'tilde'
  | 'comma'
  | 'colon'
  | 'semicolon'
  | 'lbracket'
  | 'rbracket'
  | 'lparen'
  | 'rparen'
  | 'lbrace'
  | 'rbrace'
  | 'comment';

/**
 * User-defined type guard for keyword token types.
 *
 * @param str - Token literal
 * @returns True if a valid keyword
 *
 * @interal
 */
function isKeyword(str: string): str is TokenType {
  return (
    [
      'fn',
      'gen',
      'if',
      'else',
      'for',
      'in',
      'while',
      'loop',
      'continue',
      'break',
      'true',
      'false',
      'return',
      'yield',
      'next',
      'note',
      'rest',
      'cc',
    ].indexOf(str) !== -1
  );
}

/**
 * Determines if identifier token is already a valid keyword.
 *
 * @param str - Token literal
 * @returns Keyword if valid, otherwise `identifier`
 *
 * @internal
 */
export function lookupIdentifier(str: string): TokenType {
  if (isKeyword(str)) {
    return str;
  }
  return 'identifier';
}

/**
 * Confirms that a token is of a particular token type.
 *
 * @param token Token tuple
 * @param tokenType Token type string
 * @returns True if token type matches
 */
export function tokenIs(token: Token, tokenType: TokenType): boolean {
  return token.tokenType === tokenType;
}
