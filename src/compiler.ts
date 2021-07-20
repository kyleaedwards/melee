import * as ast from './ast';
import { Opcode, Bytecode, createInstruction } from './bytecode';
import { BaseObject, Int } from './object';

export class Compiler {
  public instructions: Bytecode;
  public constants: BaseObject[];

  constructor() {
    this.instructions = new Uint8Array(0);
    this.constants = [];
  }

  /**
   * Compiles an AST node into bytecode.
   *
   * @param node - AST node, preferrably a program node
   */
  compile(node: ast.Node): void {
    if (node instanceof ast.Program) {
      for (let i = 0; i < node.statements.length; i++) {
        this.compile(node.statements[i]);
      }
    } else if (node instanceof ast.ExpressionStatement) {
      if (node.value) {
        this.compile(node.value);
      }
      this.emit(Opcode.POP);
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
    } else if (node instanceof ast.IntegerLiteral) {
      // TODO: Why use constants for midi Ints, just bake them
      // into the bytecode.
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
    return position;
  }
}
