import { Bytecode, disassemble } from './bytecode';
import { Compiler } from './compiler';
import { MeleeError, RuntimeError } from './errors';
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
  provisionMidiNote,
  Rest,
} from './object';
import { Parser } from './parser';
import { SymbolTable } from './symbols';
import { VM, createGlobalVariables, VMCallbackFn } from './vm';

const NULL = new Null();

export interface ClockUpdate {
  on: BaseObject[];
  off: BaseObject[];
  done: boolean;
}

function createRuntimeError(msg: string): RuntimeError {
  return new RuntimeError(msg, 0, 0, 0);
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
   * Stage changes to check for errors.
   *
   * @param input - Code snippet
   * @returns Lexer, parser, compiler, and runtime errors
   */
  stageChanges(input: string): MeleeError[] {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parse();
    const errors: MeleeError[] = [...parser.errors];

    const symbolTable = SymbolTable.createGlobalSymbolTable();
    const compiler = new Compiler([], symbolTable);
    try {
      compiler.compile(program);
    } catch (e) {
      if (e instanceof MeleeError) {
        errors.push(e);
      }
      throw e;
    }

    if (errors.length) return errors;

    const globals = createGlobalVariables();
    const vm = new VM(compiler, globals, this.callbacks);
    vm.run();

    const main = symbolTable.get('main');
    if (!main) {
      errors.push(
        createRuntimeError(
          'Runtime environment requires a top-level `main` object',
        ),
      );
    } else {
      const seq = globals[main.index];
      if (!(seq instanceof Closure)) {
        errors.push(
          createRuntimeError(
            'Top level `main` object must be a sequence generator',
          ),
        );
      }
    }
    return errors;
  }

  /**
   * Applies a new snippet of code passed through the runtime.
   *
   * @param input - Code snippet
   * @param args - Arguments to main generator
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
      if (e instanceof MeleeError) {
        this.errors.push(e);
      }
      throw e;
    }
    this.instructions = compiler.instructions();

    const vm = new VM(compiler, this.globals, this.callbacks);
    vm.run();

    const main = this.symbolTable.get('main');
    if (!main) {
      this.errors.push(
        createRuntimeError(
          'Runtime environment requires a top-level `main` object',
        ),
      );
      return;
    }

    let seq = this.globals[main.index];
    if (seq instanceof Closure) {
      seq = vm.callAndReturn(seq, args);
    } else {
      this.errors.push(
        createRuntimeError(
          'Top level `main` object must be a sequence generator',
        ),
      );
      return;
    }
    if (!(seq instanceof Seq)) {
      this.errors.push(
        createRuntimeError(
          'Top level `main` object must return a sequence',
        ),
      );
      return;
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
  clearNotes(): BaseObject[] {
    const newQueue = [];
    const notesOff: BaseObject[] = [];

    // Iterate over playing notes...
    while (this.queue.length) {
      // Grab the next available note.
      const item = this.queue.shift();
      if (
        !(item instanceof MidiNote) &&
        !(item instanceof Hold) &&
        !(item instanceof Rest)
      )
        break;

      // Decrement remaining note duration.
      item.duration--;

      if (item.duration) {
        newQueue.push(item);
      } else if (!(item instanceof Rest)) {
        // Prune if out of remaining note duration.
        notesOff.push(item);
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
      this.queue.push(
        provisionMidiNote(
          note.channel,
          note.pitch,
          note.duration,
          note.velocity,
        ),
      );
    } else if (note instanceof Rest) {
      this.queue.push(note);
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
      } else if (
        nextValue instanceof MidiNote ||
        nextValue instanceof Rest
      ) {
        if (this.noteOn(nextValue)) {
          notesOn.push(nextValue);
        }
      }
    }
    return {
      on: notesOn,
      off: notesOff.filter((n: BaseObject): boolean => {
        if (n instanceof MidiNote || n instanceof Hold) {
          return n.pitch >= 0;
        }
        return false;
      }),
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
