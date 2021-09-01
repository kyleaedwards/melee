import { Bytecode, disassemble } from './bytecode';
import { Compiler } from './compiler';
import { MeleeError } from './errors';
import { Lexer } from './lexer';
import {
  BaseObject,
  Closure,
  Seq,
  Null,
  Gen,
  Fn,
  MidiNote,
  Arr,
  Hold,
} from './object';
import { Parser } from './parser';
import { SymbolTable } from './symbols';
import { VM, createGlobalVariables, VMCallbackFn } from './vm';

const NULL = new Null();

export interface ClockUpdate {
  on: BaseObject[];
  off: number[];
  done: boolean;
}

/**
 * Opinionated runtime environment for generating MIDI sequences.
 */
export class Runtime {
  private queue: BaseObject[] = [];
  private constants: BaseObject[] = [];
  private globals!: (BaseObject | undefined)[];
  private symbolTable!: SymbolTable;
  private instructions?: Bytecode;
  private vm?: VM;
  private seq?: Seq;

  /**
   * Syntax, compiler, and runtime errors found during execution.
   */
  public errors: MeleeError[] = [];

  /**
   * Constructs a new runtime instance.
   */
  constructor(
    public active: boolean = true,
    private callbacks?: Record<string, VMCallbackFn>,
  ) {
    this.reset();
  }

  /**
   * Full reset of constants, globals, and the symbol table.
   */
  reset(): void {
    this.globals = createGlobalVariables();
    this.symbolTable = SymbolTable.createGlobalSymbolTable();
    this.constants = [];
    this.errors = [];
    this.queue = [];
  }

  /**
   * Executes a new runtime by resetting, and then applying a
   * new snippet of code to the runtime.
   *
   * @param input - Code snippet
   */
  exec(input: string, args: BaseObject[] = []): void {
    this.reset();
    this.apply(input, args);
  }

  /**
   * Applies a new snippet of code passed through the runtime.
   *
   * @param input - Code snippet
   */
  apply(input: string, args: BaseObject[]): void {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parse();
    this.errors = [...parser.errors];

    const compiler = new Compiler(this.constants, this.symbolTable);
    try {
      compiler.compile(program);
    } catch (e) {
      this.errors.push(e);
      throw e;
    }
    this.instructions = compiler.instructions();

    const vm = new VM(compiler, this.globals, this.callbacks);
    vm.run();

    const main = this.symbolTable.get('main');
    if (!main) {
      throw new Error(
        'Runtime environment requires a top-level `main` object',
      );
    }

    let seq = this.globals[main.index];
    if (seq instanceof Closure) {
      seq = vm.callAndReturn(seq, args);
    } else {
      throw new Error(
        'Top level `main` object must be a sequence generator',
      );
    }
    if (!(seq instanceof Seq)) {
      throw new Error(
        'Top level `main` object must return a sequence',
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

  /**
   * Clear the note queue of any notes whose
   * durations have lapsed.
   *
   * @returns Note pitches to be turned off
   */
  clearNotes(): number[] {
    const newQueue = [];
    const notesOff: number[] = [];

    // Iterate over playing notes...
    while (this.queue.length) {
      // Grab the next available note.
      const item = this.queue.shift();
      if (!(item instanceof MidiNote) && !(item instanceof Hold)) break;

      // Decrement remaining note duration.
      item.duration--;

      if (item.duration) {
        newQueue.push(item);
      } else {
        // Prune if out of remaining note duration.
        notesOff.push(item.pitch);
      }
    }

    // Update the queue.
    this.queue = newQueue;
    return notesOff;
  }

  /**
   * Adds a note object to the queue.
   *
   * @returns True if note should be played
   */
  noteOn(note: BaseObject): boolean {
    let playable = false;
    if (note instanceof MidiNote) {
      if (note.pitch >= 0) {
        playable = true;
      }
      this.queue.push(new MidiNote(note.pitch, note.duration, note.velocity));
    }
    return playable;
  }

  /**
   * Handles a new clock pulse while honoring note duration.
   *
   * @returns Note updates usable by runtime implementations
   */
  clock(): ClockUpdate {
    const notesOff = this.clearNotes();
    let notesOn: BaseObject[] = [];
    if (this.active) {
      let nextValue;
      if (!this.queue.length || notesOff.length) {
        nextValue = this.getNextValue();
      }
      if (nextValue instanceof Arr) {
        notesOn = nextValue.items.filter((item) => this.noteOn(item));
      } else if (nextValue instanceof MidiNote) {
        if (this.noteOn(nextValue)) {
          notesOn.push(nextValue);
        }
      }
    }
    return {
      on: notesOn,
      off: notesOff.filter(n => n >= 0),
      done: this.seq ? this.seq.done : true,
    };
  }

  /**
   * Debugs the bytecode for the current instructions
   * in the runtime.
   *
   * @returns Human-readable bytecode
   */
  getBytecode(): string {
    let bytecode = 'Constants:\n\n';
    this.constants.forEach((obj, i) => {
      bytecode += `${i}: ${obj.inspectObject()}\n`;
    });
    if (this.instructions) {
      bytecode += '\n\n';
      bytecode += disassemble(this.instructions);
      this.constants.forEach((obj, i) => {
        if (obj instanceof Fn || obj instanceof Gen) {
          bytecode += `\n\nFn[${i}]\n`;
          bytecode += disassemble(obj.instructions);
        }
      });
      return bytecode;
    }
    return 'No bytecode found.';
  }
}
