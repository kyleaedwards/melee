/**
 * A flatted series of instruction bytes.
 */
export type Bytecode = Uint8Array;

/**
 * A small byte array representative of single instruction within a full
 * bytecode array.
 */
export type Instruction = Uint8Array;

/**
 * Byte value enumeration of an instruction's opcode (its first byte).
 */
export enum Opcode {
  CONST = 1,
  ARRAY,
  LEN,
  INDEX,
  SET_INDEX,

  TRUE = 10,
  FALSE,
  NULL,

  ADD = 20,
  SUB,
  MUL,
  DIV,
  MOD,

  BANG = 30,
  MINUS,

  AND = 40,
  OR,

  EQ = 50,
  NOT_EQ,
  GT,
  GTE,

  GETN = 60, // Get native

  SETG = 70, // Set global
  GETG, // Get global

  SET = 80, // Set local
  GET, // Get local

  CLOSURE = 90, // Wrap function in closure
  SELF, // Current closure
  GETC, // Get free variable from closure
  SETC, // Set free variable from closure

  RET = 100, // Return
  CALL, // Call function

  JMP = 110, // Jump
  JMP_IF_NOT, // Jump conditional

  NOTE = 200, // MIDI note
  CC, // MIDI CC message
  REST, // MIDI note rest

  YIELD = 210,
  NEXT,

  POP = 253,
  NOT_IMPLEMENTED = 254,
  HALT = 255,
}

/**
 * Instruction operation and its byte payload signature.
 */
export interface Operation {
  name: string;
  operands?: number[];
  size: number;
}

export const OPCODES: { [key: number]: Operation } = {};

// Precalculate all total opcode instruction sizes.
const operations: [op: Opcode, name: string, operands?: number[]][] =
  [
    [Opcode.CONST, 'CONST', [2]],
    [Opcode.ARRAY, 'ARRAY', [2]],
    [Opcode.LEN, 'LEN'],
    [Opcode.INDEX, 'INDEX'],
    [Opcode.SET_INDEX, 'SET_INDEX'],
    [Opcode.HALT, 'HALT'],
    [Opcode.TRUE, 'TRUE'],
    [Opcode.FALSE, 'FALSE'],
    [Opcode.NULL, 'NULL'],
    [Opcode.ADD, 'ADD'],
    [Opcode.SUB, 'SUB'],
    [Opcode.MUL, 'MUL'],
    [Opcode.DIV, 'DIV'],
    [Opcode.MOD, 'MOD'],
    [Opcode.AND, 'AND'],
    [Opcode.OR, 'OR'],
    [Opcode.BANG, 'BANG'],
    [Opcode.MINUS, 'MINUS'],
    [Opcode.EQ, 'EQ'],
    [Opcode.NOT_EQ, 'NOT_EQ'],
    [Opcode.GT, 'GT'],
    [Opcode.GTE, 'GTE'],
    [Opcode.GETN, 'GETN', [1]],
    [Opcode.SETG, 'SETG', [2]],
    [Opcode.GETG, 'GETG', [2]],
    [Opcode.SET, 'SET', [1]],
    [Opcode.GET, 'GET', [1]],
    [Opcode.JMP, 'JMP', [2]],
    [Opcode.JMP_IF_NOT, 'JMP_IF_NOT', [2]],
    [Opcode.POP, 'POP'],
    [Opcode.RET, 'RET'],
    [Opcode.CALL, 'CALL', [1]],
    [Opcode.CLOSURE, 'CLOSURE', [2, 1]],
    [Opcode.SELF, 'SELF'],
    [Opcode.GETC, 'GETC', [1]],
    [Opcode.SETC, 'SETC', [1]],
    [Opcode.NOTE, 'NOTE', [1]],
    [Opcode.CC, 'CC', [1]],
    [Opcode.REST, 'REST', [1]],
    [Opcode.YIELD, 'YIELD'],
    [Opcode.NEXT, 'NEXT'],
  ];

operations.forEach(([op, name, operands]) => {
  OPCODES[op] = {
    name,
    operands,
    size: operands ? operands.reduce((acc, cur) => acc + cur, 1) : 1,
  };
});

/**
 * Packs operand value of given bytes at an offset within an instruction array.
 *
 * @param arr - Instruction bytes
 * @param offset - Bytes into instruction
 * @param size - Byte width of operand
 * @param value - Value inserted into instruction at offset
 */
export function packBigEndian(
  arr: Instruction,
  offset: number,
  size: number,
  value: number,
): void {
  let n = value;
  while (size--) {
    arr[offset + size] = n & 255;
    n >>= 8;
  }
}

/**
 * Retrieves operand value of the given bytes at an offset within an
 * instruction array.
 *
 * @param arr - Instruction bytes
 * @param offset - Bytes into instruction
 * @param size - Byte width of operand
 * @returns Integer value at offset
 */
export function unpackBigEndian(
  arr: Instruction,
  offset: number,
  size: number,
): number {
  let n = 0;
  for (let i = 0; i < size; i++) {
    n += arr[offset + i] * Math.pow(256, size - i - 1);
  }
  return n;
}

/**
 * Create new instruction, packing operands in big-endian byte order.
 *
 * @param op - Opcode value
 * @param args - Additional operands
 * @returns Packed instruction bytes
 */
export function createInstruction(
  op: Opcode,
  ...args: number[]
): Instruction {
  const operation = OPCODES[op];
  if (!operation) {
    return new Uint8Array(0);
  }

  const instruction = new Uint8Array(operation.size);
  instruction[0] = op;

  if (!operation.operands) {
    return instruction;
  }

  let offset = 1;
  for (let i = 0; i < operation.operands.length; i++) {
    packBigEndian(
      instruction,
      offset,
      operation.operands[i],
      args[i],
    );
    offset += operation.operands[i];
  }

  return instruction;
}

/**
 * Disassemble a bytecode into a more human-readable format.
 *
 * @param bytecode - Series of instruction bytes
 * @returns Stringified bytecode
 */
export function disassemble(bytecode: Bytecode): string {
  let pos = 0;
  let output = '';

  while (pos < bytecode.length) {
    const operation = OPCODES[bytecode[pos]];
    const { name, operands } = operation;
    const address = `0000${pos}`.slice(-4);

    pos += 1;
    if (!operands) {
      output += `${address} ${name}\n`;
      continue;
    }

    const args: string[] = [];
    operands.forEach((width) => {
      args.push(unpackBigEndian(bytecode, pos, width).toString());
      pos += width;
    });
    output += `${address} ${name} (${args.join(', ')})\n`;
  }

  return output;
}
