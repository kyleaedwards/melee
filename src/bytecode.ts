export type Bytecode = Uint8Array;
export type Instruction = Uint8Array;

export enum Opcode {
  CONST = 1,

  TRUE,
  FALSE,

  ADD,
  SUB,
  MUL,
  DIV,
  MOD,

  EQ,
  NOT_EQ,
  GT,
  GTE,
  LT,
  LTE,

  POP = 253,
  NOT_IMPLEMENTED = 254,
  HALT = 255,
}

export interface Operation {
  name: string;
  operands?: number[];
  size: number;
}

const OPCODES: { [key: number]: Operation } = {};

// Precalculate all total opcode instruction sizes.
const operations: [op: Opcode, name: string, operands?: number[]][] =
  [
    [Opcode.CONST, 'CONST', [2]],
    [Opcode.HALT, 'HALT'],
    [Opcode.TRUE, 'TRUE'],
    [Opcode.FALSE, 'FALSE'],
    [Opcode.ADD, 'ADD'],
    [Opcode.SUB, 'SUB'],
    [Opcode.MUL, 'MUL'],
    [Opcode.DIV, 'DIV'],
    [Opcode.MOD, 'MOD'],
    [Opcode.EQ, 'EQ'],
    [Opcode.NOT_EQ, 'NOT_EQ'],
    [Opcode.GT, 'GT'],
    [Opcode.GTE, 'GTE'],
    [Opcode.LT, 'LT'],
    [Opcode.LTE, 'LTE'],
    [Opcode.POP, 'POP'],
  ];

operations.forEach(([op, name, operands]) => {
  OPCODES[op] = {
    name,
    operands,
    size: operands ? operands.reduce((acc, cur) => acc + cur, 1) : 1,
  };
});

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
