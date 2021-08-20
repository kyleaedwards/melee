import { Token } from "./token";

/**
 * Base language error class.
 */
export class MeleeError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public length: number,
  ) {
    super(message);
    this.name = 'MeleeError';
  }
}

/**
 * Error representing invalid syntax, tokens, and characters.
 */
export class SynError extends MeleeError {
  constructor(
    message: string,
    token: Token,
  ) {
    const { line, column, literal } = token;
    super(message, line, column, literal.length);
    this.name = 'SynError';
  }
}

/**
 * Error representing compilation issues.
 */
export class CompilerError extends MeleeError {
  constructor(
    message: string,
    token: Token,
  ) {
    const { line, column, literal } = token;
    super(message, line, column, literal.length);
    this.name = 'CompilerError';
  }
}

/**
 * Errors occurring during runtime VM execution.
 */
export class RuntimeError extends MeleeError {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public length: number,
  ) {
    super(message, line, column, length);
    this.name = 'RuntimeError';
  }
}
