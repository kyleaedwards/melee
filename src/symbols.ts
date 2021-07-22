/**
 * Symbol representing a scoped variable.
 */
export interface SymbolIdentifier {
  /**
   * Variable name
   */
  label: string;

  /**
   * Index within symbol table
   */
  index: number;
}

/**
 * Symbol table for tracking named variables through the
 * compilation process.
 */
export class SymbolTable {
  private symbols: Record<string, SymbolIdentifier>;
  private numSymbols: number;

  constructor(public parent: SymbolTable | undefined) {
    this.symbols = {};
    this.numSymbols = 0;
  }
}
