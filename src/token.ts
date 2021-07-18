/**
 * Token tuple
 */
export type Token = [tokenType: TokenType, literal: string];

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
  | 'while'
  | 'loop'
  | 'return'
  | 'fn'
  | 'yield'
  | 'note'
  | 'skip'
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
  | 'rbrace';

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
      'while',
      'loop',
      'true',
      'false',
      'return',
      'yield',
      'next',
      'note',
      'skip',
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
  return token[0] === tokenType;
}
