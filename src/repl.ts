import { Compiler } from './compiler';
import { Lexer } from './lexer';
import { BaseObject } from './object';
import { Parser } from './parser';
import { SymbolTable } from './symbols';
import { VM, createGlobalVariables } from './vm';

const MAX_REPL_HISTORY = 100;

/**
 * Read-eval-print loop for executing code from the command line.
 */
export class Repl {
  private constants: BaseObject[] = [];
  private globals: (BaseObject | undefined)[];
  private symbolTable: SymbolTable;
  private history: string[] = [];

  /**
   * Constructs a new REPL instance.
   */
  constructor() {
    this.globals = createGlobalVariables();
    this.symbolTable = SymbolTable.createGlobalSymbolTable();
  }

  /**
   * Execute a snippet of code passed through the REPL.
   *
   * @param input - Code snippet
   * @returns Stringified output
   */
  exec(input: string): string {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parse();

    const compiler = new Compiler(this.constants, this.symbolTable);
    compiler.compile(program);

    const vm = new VM(compiler, this.globals);
    vm.run();

    const obj = vm.lastElement();
    if (obj) {
      return obj.inspectObject();
    }

    this.history.push(input);
    while (this.history.length > MAX_REPL_HISTORY) {
      this.history.shift();
    }

    return 'undefined';
  }

  /**
   * Get a previously run code snippet.
   *
   * @param offset - Position from end of history record
   * @returns Previously run snippet
   */
  getPreviousEntry(offset: number = 0): string | undefined {
    if (offset >= MAX_REPL_HISTORY) return;
    return this.history[MAX_REPL_HISTORY - offset - 1];
  }
}
