import * as ast from './ast';
import { Opcode, Bytecode, createInstruction } from './bytecode';
import { BaseObject, Int, Fn, Gen } from './object';
import { ScopeType, SymbolTable } from './symbols';
import { NATIVE_FNS } from './builtins';
import { CompilerError } from './errors';

/**
 * Instruction occurence at a given position in the bytecode.
 */
interface CompiledInstruction {
  /**
   * Opcode value
   */
  opcode: Opcode;

  /**
   * Index within bytecode array
   */
  position: number;
}

/**
 * Scoped instruction set for
 */
interface CompilerScope {
  /**
   * Serial bytecode instructions representing a program or function body.
   */
  instructions: Bytecode;

  /**
   * Saved instruction to backtrack or remove previous items from the bytecode.
   * This is primarily used to support implicit returns from block statements.
   */
  lastInstruction: CompiledInstruction;

  /**
   * Saved instruction to backtrack or remove previous items from the bytecode.
   * This is primarily used to support implicit returns from block statements.
   */
  previousInstruction: CompiledInstruction;
}

/**
 * Compiles AST into serial bytecode instructions.
 */
export class Compiler {
  private scopes: CompilerScope[];
  private scopeIndex: number;
  private symbolTable: SymbolTable;
  private loopStarts: number[] = [];
  private breaks: number[][] = [];

  constructor(
    /**
     * Constant values referenced by the VM.
     */
    public constants: BaseObject[] = [],
    symbolTable?: SymbolTable,
  ) {
    this.scopeIndex = -1;
    this.scopes = [];

    // Create native symbol table for built-in functions and values.
    this.symbolTable = new SymbolTable(ScopeType.NATIVE);
    NATIVE_FNS.forEach((fn) => {
      this.symbolTable.add(fn.label);
    });

    this.pushScope(symbolTable);
  }

  /**
   * Gets the current scope. (Can't use getters in ES3.)
   *
   * @returns Current scope
   *
   * @internal
   */
  private scope(): CompilerScope {
    return this.scopes[this.scopeIndex];
  }

  /**
   * Gets the current scope's instructions. (Can't use getters in ES3.)
   *
   * @returns Instruction bytecode
   *
   * @internal
   */
  public instructions(): Bytecode {
    return this.scopes[this.scopeIndex].instructions;
  }

  /**
   * Compiles an AST node into bytecode.
   *
   * @param node - AST node, preferrably a program node
   */
  public compile(node: ast.Node): void {
    if (
      node instanceof ast.Program ||
      node instanceof ast.BlockStatement
    ) {
      for (let i = 0; i < node.statements.length; i++) {
        this.compile(node.statements[i]);
      }
    } else if (node instanceof ast.ExpressionStatement) {
      if (node.value) {
        this.compile(node.value);
      }
      this.emit(Opcode.POP);
    } else if (node instanceof ast.DeclareStatement) {
      const index = this.symbolTable.add(node.name.value);
      if (node.value) {
        this.compile(node.value);
      }
      this.emit(
        this.symbolTable.type === ScopeType.GLOBAL
          ? Opcode.SETG
          : Opcode.SET,
        index,
      );
    } else if (node instanceof ast.AssignExpression) {
      const name = node.name;
      if (!(name instanceof ast.Identifier)) {
        // Assignment for array expressions
        if (name instanceof ast.IndexExpression) {
          this.compile(name.collection);
          this.compile(name.index);
          if (node.value) {
            this.compile(node.value);
          }
          this.emit(Opcode.SET_INDEX);

          this.compile(name.collection);
          this.compile(name.index);
          this.emit(Opcode.INDEX);
          return;
        }
        throw new CompilerError(
          'Left-hand of assignment must be a variable or an array index expression',
          name.token,
        );
      }
      const sym = this.symbolTable.get(name.value);
      if (!sym) {
        throw new CompilerError(
          `Cannot assign undefined variable ${name.value}`,
          name.token,
        );
      }
      if (node.value) {
        this.compile(node.value);
      }
      let opcode: Opcode;
      let fetch: Opcode;
      switch (sym.type) {
        case ScopeType.FREE:
          opcode = Opcode.SETC;
          fetch = Opcode.GETC;
          break;
        case ScopeType.LOCAL:
          opcode = Opcode.SET;
          fetch = Opcode.GET;
          break;
        case ScopeType.GLOBAL:
          opcode = Opcode.SETG;
          fetch = Opcode.GETG;
          break;
        default:
          throw new CompilerError(
            `Cannot assign unassigned variable ${name.value}`,
            name.token,
          );
      }
      this.emit(opcode, sym.index);
      this.emit(fetch, sym.index);
    } else if (node instanceof ast.CompoundAssignExpression) {
      const name = node.name;
      if (!(name instanceof ast.Identifier)) {
        // Assignment for array expressions
        if (name instanceof ast.IndexExpression) {
          this.compile(name.collection);
          this.compile(name.index);
          this.compile(name.collection);
          this.compile(name.index);
          this.emit(Opcode.INDEX);
          if (node.value) {
            this.compile(node.value);
          }
          switch (node.operator) {
            case '+=':
              this.emit(Opcode.ADD);
              break;
            case '-=':
              this.emit(Opcode.SUB);
              break;
            case '*=':
              this.emit(Opcode.MUL);
              break;
            case '/=':
              this.emit(Opcode.DIV);
              break;
            case '%=':
              this.emit(Opcode.MOD);
              break;
          }
          this.emit(Opcode.SET_INDEX);

          this.compile(name.collection);
          this.compile(name.index);
          this.emit(Opcode.INDEX);
          return;
        }
        throw new CompilerError(
          'Left-hand of assignment must be a variable or an array index expression',
          name.token,
        );
      }
      const sym = this.symbolTable.get(name.value);
      if (!sym) {
        throw new CompilerError(
          `Cannot assign undefined variable ${name.value}`,
          name.token,
        );
      }
      this.compile(name);
      if (node.value) {
        this.compile(node.value);
      }
      switch (node.operator) {
        case '+=':
          this.emit(Opcode.ADD);
          break;
        case '-=':
          this.emit(Opcode.SUB);
          break;
        case '*=':
          this.emit(Opcode.MUL);
          break;
        case '/=':
          this.emit(Opcode.DIV);
          break;
        case '%=':
          this.emit(Opcode.MOD);
          break;
      }

      let opcode: Opcode;
      let fetch: Opcode;
      switch (sym.type) {
        case ScopeType.FREE:
          opcode = Opcode.SETC;
          fetch = Opcode.GETC;
          break;
        case ScopeType.LOCAL:
          opcode = Opcode.SET;
          fetch = Opcode.GET;
          break;
        case ScopeType.GLOBAL:
          opcode = Opcode.SETG;
          fetch = Opcode.GETG;
          break;
        default:
          throw new CompilerError(
            `Cannot assign unassigned variable ${name.value}`,
            name.token,
          );
      }
      this.emit(opcode, sym.index);
      this.emit(fetch, sym.index);
    } else if (node instanceof ast.Identifier) {
      const sym = this.symbolTable.get(node.value);
      if (typeof sym === 'undefined') {
        throw new CompilerError(
          `Attempting to use undefined variable ${node.value}`,
          node.token,
        );
      }
      let opcode: Opcode;
      switch (sym.type) {
        case ScopeType.FREE:
          opcode = Opcode.GETC;
          break;
        case ScopeType.NATIVE:
          opcode = Opcode.GETN;
          break;
        case ScopeType.GLOBAL:
          opcode = Opcode.GETG;
          break;
        case ScopeType.SELF:
          opcode = Opcode.SELF;
          break;
        default:
          opcode = Opcode.GET;
      }
      this.emit(opcode, sym.index);
    } else if (node instanceof ast.PrefixExpression) {
      if (node.right) {
        this.compile(node.right);
      }
      switch (node.operator) {
        case '-':
          this.emit(Opcode.MINUS);
          break;
        case '!':
          this.emit(Opcode.BANG);
          break;
      }
    } else if (node instanceof ast.InfixExpression) {
      if (node.operator === '<' || node.operator === '<=') {
        if (node.right) {
          this.compile(node.right);
        }
        if (node.left) {
          this.compile(node.left);
        }
        this.emit(node.operator === '<' ? Opcode.GT : Opcode.GTE);
        return;
      }
      if (node.left) {
        this.compile(node.left);
      }
      if (node.right) {
        this.compile(node.right);
      }
      switch (node.operator) {
        case '+':
          this.emit(Opcode.ADD);
          break;
        case '-':
          this.emit(Opcode.SUB);
          break;
        case '*':
          this.emit(Opcode.MUL);
          break;
        case '/':
          this.emit(Opcode.DIV);
          break;
        case '%':
          this.emit(Opcode.MOD);
          break;
        case '==':
          this.emit(Opcode.EQ);
          break;
        case '!=':
          this.emit(Opcode.NOT_EQ);
          break;
        case '>':
          this.emit(Opcode.GT);
          break;
        case '>=':
          this.emit(Opcode.GTE);
          break;
        case '&&':
          this.emit(Opcode.AND);
          break;
        case '||':
          this.emit(Opcode.OR);
          break;
      }
    } else if (node instanceof ast.IfExpression) {
      this.compile(node.condition);

      // Jump to else clause (or outside of conditional statement if else doesn't exist).
      const jumpToElse = this.emit(Opcode.JMP_IF_NOT, 0xffff);

      this.compile(node.consequence);
      this.removeInstructionIf(Opcode.POP);

      const jumpOut = this.emit(Opcode.JMP, 0xffff);

      this.replaceInstruction(jumpToElse, this.instructions().length);

      if (node.alternative) {
        this.compile(node.alternative);
        this.removeInstructionIf(Opcode.POP);
      } else {
        this.emit(Opcode.NULL);
      }

      this.replaceInstruction(jumpOut, this.instructions().length);
    } else if (node instanceof ast.IntegerLiteral) {
      // TODO: Why use constants for MIDI Ints, could we just bake them
      // into the bytecode instead?
      const o = new Int(node.value);
      this.emit(Opcode.CONST, this.addConstant(o));
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcode.TRUE : Opcode.FALSE);
    } else if (node instanceof ast.ArrayLiteral) {
      node.values.forEach(this.compile.bind(this));
      this.emit(Opcode.ARRAY, node.values.length);
    } else if (node instanceof ast.IndexExpression) {
      this.compile(node.collection);
      this.compile(node.index);
      this.emit(Opcode.INDEX);
    } else if (
      node instanceof ast.FunctionLiteral ||
      node instanceof ast.GeneratorLiteral
    ) {
      this.pushScope();
      if (node.name) {
        this.symbolTable.setSelf(node.name);
      }
      node.parameters.forEach((param) => {
        this.symbolTable.add(param.value);
      });
      this.compile(node.body);

      const { freeSymbols, numSymbols } = this.symbolTable;

      if (this.scope().lastInstruction.opcode !== Opcode.RET) {
        this.emit(Opcode.NULL);
        this.emit(Opcode.RET);
      }
      const instructions = this.popScope();
      if (!instructions) {
        throw new CompilerError(
          'Error compiling function',
          node.token,
        );
      }

      freeSymbols.forEach((sym) => {
        let opcode: Opcode;
        switch (sym.type) {
          case ScopeType.FREE:
            opcode = Opcode.GETC;
            break;
          case ScopeType.NATIVE:
            opcode = Opcode.GETN;
            break;
          case ScopeType.GLOBAL:
            opcode = Opcode.GETG;
            break;
          case ScopeType.SELF:
            opcode = Opcode.SELF;
            break;
          default:
            opcode = Opcode.GET;
        }
        this.emit(opcode, sym.index);
      });

      const repr = node.toString();
      const CallableConstructor =
        node instanceof ast.FunctionLiteral ? Fn : Gen;
      const fn = new CallableConstructor(
        instructions,
        repr,
        numSymbols,
        node.parameters.length,
      );
      this.emit(
        Opcode.CLOSURE,
        this.addConstant(fn),
        freeSymbols.length,
      );
    } else if (node instanceof ast.YieldStatement) {
      if (!node.value) {
        this.emit(Opcode.NULL);
      } else {
        this.compile(node.value);
      }
      this.emit(Opcode.YIELD);
    } else if (node instanceof ast.NextExpression) {
      if (!node.right) {
        throw new CompilerError(
          'Cannot use the `next` keyword without an operand',
          node.token,
        );
      } else {
        this.compile(node.right);
      }
      this.emit(Opcode.NEXT);
    } else if (node instanceof ast.CallExpression) {
      if (!node.fn) {
        throw new CompilerError(
          'Invalid call expression',
          node.token,
        );
      }
      this.compile(node.fn);
      node.args.forEach(this.compile.bind(this));
      this.emit(Opcode.CALL, node.args.length);
    } else if (node instanceof ast.ReturnStatement) {
      if (node.value) {
        this.compile(node.value);
      } else {
        this.emit(Opcode.NULL);
      }
      this.emit(Opcode.RET);
    } else if (node instanceof ast.ForStatement) {
      const identifier = this.symbolTable.add(node.identifier.value);
      const setter =
        this.symbolTable.type === ScopeType.GLOBAL
          ? Opcode.SETG
          : Opcode.SET;
      const getter =
        this.symbolTable.type === ScopeType.GLOBAL
          ? Opcode.GETG
          : Opcode.GET;
      const counter = this.symbolTable.addIota();
      const collection = this.symbolTable.addIota();
      const incr = this.addConstant(new Int(1));

      // Set counter
      this.emit(Opcode.CONST, this.addConstant(new Int(0)));
      this.emit(setter, counter);

      // Save collection
      this.compile(node.collection);
      this.emit(setter, collection);

      this.loopStarts.push(this.instructions().length);
      this.breaks.push([]);

      // Check if iterator has gone past the end of the arra
      this.emit(getter, collection);
      this.emit(Opcode.LEN);
      this.emit(getter, counter);
      this.emit(Opcode.GT);
      const jumpOut = this.emit(Opcode.JMP_IF_NOT, 0xffff);

      // Set the current array item in the local variable
      this.emit(getter, collection);
      this.emit(getter, counter);
      this.emit(Opcode.INDEX);
      this.emit(setter, identifier);

      // Increment the iterator
      this.emit(getter, counter);
      this.emit(Opcode.CONST, incr);
      this.emit(Opcode.ADD);
      this.emit(setter, counter);

      // Compile code block and loop
      this.compile(node.block);
      this.emit(
        Opcode.JMP,
        this.loopStarts[this.loopStarts.length - 1],
      );
      this.replaceInstruction(jumpOut, this.instructions().length);
      while (this.breaks[this.breaks.length - 1].length) {
        const brk = this.breaks[this.breaks.length - 1].pop();
        if (brk) {
          this.replaceInstruction(brk, this.instructions().length);
        }
      }
      this.breaks.pop();
      this.loopStarts.pop();
    } else if (node instanceof ast.WhileStatement) {
      this.loopStarts.push(this.instructions().length);
      this.breaks.push([]);
      this.compile(node.condition);
      const jumpToElse = this.emit(Opcode.JMP_IF_NOT, 0xffff);
      this.compile(node.block);
      this.emit(
        Opcode.JMP,
        this.loopStarts[this.loopStarts.length - 1],
      );
      this.replaceInstruction(jumpToElse, this.instructions().length);
      while (this.breaks[this.breaks.length - 1].length) {
        const brk = this.breaks[this.breaks.length - 1].pop();
        if (brk) {
          this.replaceInstruction(brk, this.instructions().length);
        }
      }
      this.breaks.pop();
      this.loopStarts.pop();
    } else if (node instanceof ast.BreakStatement) {
      this.breaks[this.breaks.length - 1].push(
        this.emit(Opcode.JMP, 0xffff),
      );
    } else if (node instanceof ast.ContinueStatement) {
      if (!this.loopStarts.length) {
        throw new CompilerError(
          'Cannot use continue outside of a loop',
          node.token,
        );
      }
      this.emit(
        Opcode.JMP,
        this.loopStarts[this.loopStarts.length - 1],
      );
    } else if (node instanceof ast.NoteExpression) {
      if (!node.note) {
        throw new CompilerError(
          'Cannot use the `note` keyword without an operand',
          node.token,
        );
      }
      this.compile(node.note);
      this.emit(Opcode.NOTE);
    } else if (node instanceof ast.SkipExpression) {
      if (node.duration) {
        this.compile(node.duration);
      } else {
        this.emit(Opcode.CONST, this.addConstant(new Int(1)));
      }
      this.emit(Opcode.SKIP);
    } else if (node instanceof ast.CCExpression) {
      if (!node.message) {
        throw new CompilerError(
          'Cannot use the `cc` keyword without an operand',
          node.token,
        );
      }
      this.compile(node.message);
      this.emit(Opcode.CC);
    }
  }

  /**
   * Add a new scope item onto the stack.
   *
   * @param symbolTable - Optional symbol table
   *
   * @internal
   */
  private pushScope(symbolTable?: SymbolTable): void {
    this.scopeIndex++;
    this.scopes.push({
      instructions: new Uint8Array(0),
      lastInstruction: {
        opcode: Opcode.NOT_IMPLEMENTED,
        position: -1,
      },
      previousInstruction: {
        opcode: Opcode.NOT_IMPLEMENTED,
        position: -1,
      },
    });
    if (symbolTable) {
      symbolTable.parent = this.symbolTable;
      this.symbolTable = symbolTable;
    } else if (this.symbolTable.type === ScopeType.NATIVE) {
      const globals = SymbolTable.createGlobalSymbolTable();
      globals.parent = this.symbolTable;
      this.symbolTable = globals;
    } else {
      this.symbolTable = new SymbolTable(
        ScopeType.LOCAL,
        this.symbolTable,
      );
    }
  }

  /**
   * Remove the topmost scope object and return its instructions.
   *
   * @returns Instructions from popped scope
   *
   * @internal
   */
  private popScope(): Bytecode | undefined {
    if (!this.scopeIndex || !this.symbolTable.parent) {
      return;
    }
    this.symbolTable = this.symbolTable.parent;
    this.scopeIndex--;
    return this.scopes.pop()?.instructions;
  }

  /**
   * Keeps track of a program constant and return a reference.
   *
   * @param obj - Constant value
   * @returns Index into constant array
   *
   * @internal
   */
  private addConstant(obj: BaseObject): number {
    this.constants.push(obj);
    return this.constants.length - 1;
  }

  /**
   * Removes the last instruction from the bytecode.
   *
   * @internal
   */
  private removeInstruction(): void {
    const position = this.scope().lastInstruction.position;
    this.scope().lastInstruction.opcode =
      this.scope().previousInstruction.opcode;
    this.scope().lastInstruction.position =
      this.scope().previousInstruction.position;

    const temp = new Uint8Array(position);
    temp.set(this.instructions().slice(0, position));
    this.scope().instructions = temp;
  }

  /**
   * Removes the last instruction from the bytecode if it matches
   * the supplied opcode.
   *
   * @param op - Opcode
   *
   * @internal
   */
  private removeInstructionIf(op: Opcode): void {
    if (this.scope().lastInstruction.opcode === op) {
      this.removeInstruction();
    }
  }

  /**
   * Replaces an instruction in the program's bytecode.
   *
   * @param position - Bytecode index of instruction to replace
   * @param operands - Operator arguments
   *
   * @internal
   */
  private replaceInstruction(
    position: number,
    ...operands: number[]
  ): void {
    const op: Opcode = this.instructions()[position];
    this.instructions().set(
      createInstruction(op, ...operands),
      position,
    );
  }

  /**
   * Add an instruction to the program's bytecode.
   *
   * @param op - Opcode
   * @param operands - Operator arguments
   * @returns Position of new bytecode instruction
   *
   * @internal
   */
  private emit(op: Opcode, ...operands: number[]): number {
    const instruction = createInstruction(op, ...operands);
    const position = this.instructions().length;
    const temp = new Uint8Array(position + instruction.length);
    temp.set(this.instructions());
    temp.set(instruction, position);
    this.scope().instructions = temp;
    this.scope().previousInstruction.opcode =
      this.scope().lastInstruction.opcode;
    this.scope().previousInstruction.position =
      this.scope().lastInstruction.position;
    this.scope().lastInstruction.opcode = op;
    this.scope().lastInstruction.position = position;
    return position;
  }
}
