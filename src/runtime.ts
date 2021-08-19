import { Bytecode, disassemble } from './bytecode';
import { Compiler } from './compiler';
import { Lexer } from './lexer';
import { BaseObject, Closure, Seq, Null, Gen, Fn } from './object';
import { Parser } from './parser';
import { SymbolTable } from './symbols';
import { VM, createGlobalVariables } from './vm';

const NULL = new Null();

/**
 * Opinionated runtime environment for generating MIDI sequences.
 */
export class Runtime {
  private constants: BaseObject[] = [];
  private globals: (BaseObject | undefined)[];
  private symbolTable: SymbolTable;
  private instructions?: Bytecode;
  private vm?: VM;
  private seq?: Seq;

  /**
   * Constructs a new runtime instance.
   */
  constructor() {
    this.globals = createGlobalVariables();
    this.symbolTable = SymbolTable.createGlobalSymbolTable();
  }

  /**
   * Execute a snippet of code passed through the runtime.
   *
   * @param input - Code snippet
   */
  exec(input: string): void {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parse();

    const compiler = new Compiler(this.constants, this.symbolTable);
    compiler.compile(program);
    this.instructions = compiler.instructions();

    const vm = new VM(compiler, this.globals);
    vm.run();

    const main = this.symbolTable.get('main');
    if (!main) {
      throw new Error(
        'Runtime environment requires a top-level `main` object',
      );
    }

    let seq = this.globals[main.index];
    if (seq instanceof Closure) {
      seq = vm.callAndReturn(seq, []);
    }
    if (!(seq instanceof Seq)) {
      throw new Error(
        'Top level `main` object must be a sequence or a sequence generator',
      );
    }

    this.seq = seq;
    this.vm = vm;
  }

  /**
   * Return a new object off of the main sequence.
   *
   * @returns Next object in the sequence
   */
  getNextValue(): BaseObject {
    if (!this.vm || !this.seq) {
      return NULL;
    }
    return this.vm.takeNext(this.seq);
  }

  getBytecode(): string {
    let bytecode = 'Constants:\n\n';
    this.constants.forEach((obj, i) => {
      bytecode += `${i}: ${obj.inspectObject()}\n`
    });
    if (this.instructions) {
      bytecode += '\n\n';
      bytecode += disassemble(this.instructions);
      this.constants.forEach((obj, i) => {
        if (obj instanceof Fn || obj instanceof Gen) {
          bytecode += `\n\nFn[${i}]\n`;
          bytecode += disassemble(obj.instructions);
        }
      })
      return bytecode;
    }
    return 'No bytecode found.';
  }
}
