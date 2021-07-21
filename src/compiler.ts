import * as ast from './ast';
import { Opcode, Bytecode, createInstruction } from './bytecode';
import { BaseObject, Int } from './object';

interface CompiledInstruction {
  opcode: Opcode;
  position: number;
}

export class Compiler {
  public instructions: Bytecode;
  public constants: BaseObject[];
  private lastInstruction: CompiledInstruction;
  private previousInstruction: CompiledInstruction;

  constructor() {
    this.instructions = new Uint8Array(0);
    this.constants = [];
    this.lastInstruction = {
      opcode: Opcode.NOT_IMPLEMENTED,
      position: -1,
    };
    this.previousInstruction = {
      opcode: Opcode.NOT_IMPLEMENTED,
      position: -1,
    };
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

      this.replaceInstruction(jumpToElse, this.instructions.length);

      if (node.alternative) {
        this.compile(node.alternative);
        this.removeInstructionIf(Opcode.POP);
      } else {
        this.emit(Opcode.NULL);
      }

      this.replaceInstruction(jumpOut, this.instructions.length);
    } else if (node instanceof ast.IntegerLiteral) {
      // TODO: Why use constants for MIDI Ints, could we just bake them
      // into the bytecode instead?
      const obj = new Int(node.value);
      this.emit(Opcode.CONST, this.addConstant(obj));
    } else if (node instanceof ast.BooleanLiteral) {
      this.emit(node.value ? Opcode.TRUE : Opcode.FALSE);
    }
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
    const position = this.lastInstruction.position;
    this.lastInstruction.opcode = this.previousInstruction.opcode;
    this.lastInstruction.position = this.previousInstruction.position;

    const temp = new Uint8Array(position);
    temp.set(this.instructions.slice(0, position));
    this.instructions = temp;
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
    if (this.lastInstruction.opcode === op) {
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
    const op: Opcode = this.instructions[position];
    this.instructions.set(
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
    const position = this.instructions.length;
    const temp = new Uint8Array(position + instruction.length);
    temp.set(this.instructions);
    temp.set(instruction, position);
    this.instructions = temp;
    this.previousInstruction.opcode = this.lastInstruction.opcode;
    this.previousInstruction.position = this.lastInstruction.position;
    this.lastInstruction.opcode = op;
    this.lastInstruction.position = position;
    return position;
  }
}
