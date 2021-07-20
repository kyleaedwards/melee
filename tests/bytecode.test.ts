import {
  Opcode,
  createInstruction,
  packBigEndian,
  disassemble,
} from '../src/bytecode';

describe('packBigEndian', () => {
  test('should pack values into bytecode expressions', () => {
    const inputs: [
      offset: number,
      size: number,
      value: number,
      expected: number[],
    ][] = [
      [0, 1, 1, [1, 0, 0, 0]],
      [1, 1, 1, [0, 1, 0, 0]],
      [1, 2, 256, [0, 1, 0, 0]],
      [2, 2, 5000, [0, 0, 19, 136]],
    ];

    inputs.forEach(([offset, size, value, expected]) => {
      const arr = new Uint8Array(expected.length);
      packBigEndian(arr, offset, size, value);
      for (let i = 0; i < expected.length; i++) {
        expect(arr[i]).toEqual(expected[i]);
      }
    });
  });
});

describe('createInstruction', () => {
  test('should create a new instruction', () => {
    const inputs: [op: Opcode, args: number[], expected: number[]][] =
      [
        [Opcode.HALT, [], [Opcode.HALT]],
        [Opcode.CONST, [65534], [Opcode.CONST, 0xff, 0xfe]],
        [Opcode.ADD, [], [Opcode.ADD]],
        [Opcode.SUB, [], [Opcode.SUB]],
        [Opcode.MUL, [], [Opcode.MUL]],
        [Opcode.DIV, [], [Opcode.DIV]],
        [Opcode.MOD, [], [Opcode.MOD]],
        [Opcode.POP, [], [Opcode.POP]],
        [Opcode.TRUE, [], [Opcode.TRUE]],
        [Opcode.FALSE, [], [Opcode.FALSE]],
        [Opcode.EQ, [], [Opcode.EQ]],
        [Opcode.NOT_EQ, [], [Opcode.NOT_EQ]],
        [Opcode.GT, [], [Opcode.GT]],
        [Opcode.GTE, [], [Opcode.GTE]],
        [Opcode.NOT_IMPLEMENTED, [], []],
      ];

    inputs.forEach(([op, args, expected]) => {
      const instruction = createInstruction(op, ...args);
      expect(instruction.length).toEqual(expected.length);
      for (let i = 0; i < expected.length; i++) {
        expect(instruction[i]).toEqual(expected[i]);
      }
    });
  });
});

describe('disassemble', () => {
  test('should generate readable debug code from bytecode', () => {
    const bytecode = new Uint8Array([
      ...[Opcode.CONST, 0x00, 0x01],
      ...[Opcode.CONST, 0xff, 0xfe],
      ...[Opcode.ADD],
      ...[Opcode.SUB],
      ...[Opcode.MUL],
      ...[Opcode.DIV],
      ...[Opcode.MOD],
      ...[Opcode.POP],
      ...[Opcode.TRUE],
      ...[Opcode.FALSE],
      ...[Opcode.EQ],
      ...[Opcode.NOT_EQ],
      ...[Opcode.GT],
      ...[Opcode.GTE],
      ...[Opcode.HALT],
    ]);
    const expected = [
      '0000 CONST (1)',
      '0003 CONST (65534)',
      '0006 ADD',
      '0007 SUB',
      '0008 MUL',
      '0009 DIV',
      '0010 MOD',
      '0011 POP',
      '0012 TRUE',
      '0013 FALSE',
      '0014 EQ',
      '0015 NOT_EQ',
      '0016 GT',
      '0017 GTE',
      '0018 HALT',
    ];
    expect(disassemble(bytecode).trim()).toEqual(expected.join('\n'));
  });
});
