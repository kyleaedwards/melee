import * as ast from './ast';
import { Opcode, Bytecode, createInstruction } from './bytecode';
import { BaseObject, Int, Func } from './object';
import { SymbolTable } from './symbols';

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
  public scopes: CompilerScope[];
  public scopeIndex: number;
  public symbolTable!: SymbolTable;

  constructor(
    public constants: BaseObject[] = [],
  ) {
    this.scopeIndex = -1;
    this.scopes = [];
    this.pushScope();
  }

  /**
   * Gets the current scope. (Can't use getters in ES3.)
   *
   * @returns Current scope
   */
  scope(): CompilerScope {
    return this.scopes[this.scopeIndex];
  }

  /**
   * Gets the current scope's instructions. (Can't use getters in ES3.)
   *
   * @returns Instruction bytecode
   */
  instructions(): Bytecode {
    return this.scopes[this.scopeIndex].instructions;
  }

  /**
   * Compiles an AST node into bytecode.
   *
   * @param node - AST node, preferrably a program node
   */
  compile(node: ast.Node): void {
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
      if (node.value) {
        this.compile(node.value);
      }
      const index = this.symbolTable.add(node.name.value);
      this.emit(this.symbolTable.parent ? Opcode.SET : Opcode.SETG, index);
    } else if (node instanceof ast.Identifier) {
      const sym = this.symbolTable.get(node.value);
      if (typeof sym === 'undefined') {
        throw new Error(
          `Attempting to use undefined variable ${node.value}`,
        );
      }
      this.emit(sym.depth ? Opcode.GET : Opcode.GETG, sym.index);
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
      const obj = new Int(node.value);
      this.emit(Opcode.CONST, this.addConstant(obj));
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcode.TRUE : Opcode.FALSE);
    } else if (node instanceof ast.ArrayLiteral) {
      node.values.forEach(this.compile.bind(this));
      this.emit(Opcode.ARRAY, node.values.length);
    } else if (node instanceof ast.IndexExpression) {
      this.compile(node.collection);
      this.compile(node.index);
      this.emit(Opcode.INDEX);
    } else if (node instanceof ast.FunctionLiteral) {
      this.pushScope();
      node.parameters.forEach((param) => {
        this.symbolTable.add(param.value);
      });
      this.compile(node.body);
      const numLocals = this.symbolTable.numSymbols;
      if (this.scope().lastInstruction.opcode !== Opcode.RET) {
        this.emit(Opcode.NULL);
        this.emit(Opcode.RET);
      }
      const instructions = this.popScope();
      if (!instructions) {
        throw new Error('Error compiling function');
      }
      const repr = node.toString();
      const fn = new Func(instructions, repr, numLocals);
      this.emit(Opcode.CONST, this.addConstant(fn));
    } else if (node instanceof ast.CallExpression) {
      if (!node.func) {
        throw new Error('Invalid call expression');
      }
      this.compile(node.func);
      node.args.forEach(this.compile.bind(this));
      this.emit(Opcode.CALL, node.args.length);
    } else if (node instanceof ast.ReturnStatement) {
      if (node.value) {
        this.compile(node.value);
      } else {
        this.emit(Opcode.NULL);
      }
      this.emit(Opcode.RET);
    }
  }

  /**
   * Add a new scope item onto the stack.
   *
   * @internal
   */
  pushScope(): void {
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
    this.symbolTable = new SymbolTable(this.symbolTable);
  }

  /**
   * Remove the topmost scope object and return its instructions.
   *
   * @returns Instructions from popped scope
   *
   * @internal
   */
  popScope(): Bytecode | undefined {
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
  addConstant(obj: BaseObject): number {
    this.constants.push(obj);
    return this.constants.length - 1;
  }

  /**
   * Removes the last instruction from the bytecode.
   *
   * @internal
   */
  removeInstruction(): void {
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
  removeInstructionIf(op: Opcode): void {
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
  replaceInstruction(position: number, ...operands: number[]): void {
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
  emit(op: Opcode, ...operands: number[]): number {
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
