/**
 * Label defining level of variable scope.
 */
export enum ScopeType {
  NATIVE,
  GLOBAL,
  LOCAL,
}

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

  /**
   * Depth of owning symbol table
   */
  depth: number;

  /**
   * Type of owning symbol table
   */
  type: ScopeType;
}

/**
 * Symbol table for tracking named variables through the
 * compilation process.
 */
export class SymbolTable {
  private symbols: Record<string, SymbolIdentifier>;
  public numSymbols: number;
  public depth: number;

  constructor(public type: ScopeType, public parent?: SymbolTable) {
    this.symbols = {};
    this.numSymbols = 0;
    this.depth = parent ? parent.depth + 1 : -1;
  }

  /**
   * Adds a new symbol to the table and returns its unique index.
   *
   * @param label - Variable name
   * @returns Index of new symbol
   */
  add(label: string): number {
    const sym = {
      label,
      index: this.numSymbols,
      depth: this.depth,
      type: this.type,
    };
    this.numSymbols++;
    this.symbols[label] = sym;
    return sym.index;
  }

  /**
   * Look up a symbol in the table. If not found, it recurses
   * up its parent scope.
   *
   * @param label - Variable name
   * @returns Symbol
   */
  get(label: string): SymbolIdentifier | undefined {
    if (!this.symbols[label] && this.parent) {
      return this.parent.get(label);
    }
    return this.symbols[label];
  }

  /**
   * Look up a symbol in the table and return its unique index.
   *
   * @param label - Variable name
   * @returns Index of symbol
   */
  getIndex(label: string): number | undefined {
    return this.get(label)?.index;
  }
}
