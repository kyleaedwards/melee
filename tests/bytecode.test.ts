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
        [Opcode.BANG, [], [Opcode.BANG]],
        [Opcode.MINUS, [], [Opcode.MINUS]],
        [Opcode.TRUE, [], [Opcode.TRUE]],
        [Opcode.FALSE, [], [Opcode.FALSE]],
        [Opcode.NULL, [], [Opcode.NULL]],
        [Opcode.EQ, [], [Opcode.EQ]],
        [Opcode.NOT_EQ, [], [Opcode.NOT_EQ]],
        [Opcode.GT, [], [Opcode.GT]],
        [Opcode.GTE, [], [Opcode.GTE]],
        [Opcode.SETG, [65533], [Opcode.SETG, 0xff, 0xfd]],
        [Opcode.GETG, [2], [Opcode.GETG, 0x00, 0x02]],
        [Opcode.SET, [255], [Opcode.SET, 0xff]],
        [Opcode.GET, [0], [Opcode.GET, 0x00]],
        [Opcode.JMP, [65532], [Opcode.JMP, 0xff, 0xfc]],
        [Opcode.JMP_IF_NOT, [3], [Opcode.JMP_IF_NOT, 0x00, 0x03]],
        [Opcode.ARRAY, [3], [Opcode.ARRAY, 0x00, 0x03]],
        [Opcode.INDEX, [], [Opcode.INDEX]],
        [Opcode.RET, [], [Opcode.RET]],
        [Opcode.CALL, [1], [Opcode.CALL, 0x01]],
        [
          Opcode.CLOSURE,
          [65535, 1],
          [Opcode.CLOSURE, 0xff, 0xff, 0x01],
        ],
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
      ...[Opcode.BANG],
      ...[Opcode.MINUS],
      ...[Opcode.TRUE],
      ...[Opcode.FALSE],
      ...[Opcode.EQ],
      ...[Opcode.NOT_EQ],
      ...[Opcode.GT],
      ...[Opcode.GTE],
      ...[Opcode.SETG, 0xff, 0xfd],
      ...[Opcode.GETG, 0x00, 0x02],
      ...[Opcode.SET, 0xff],
      ...[Opcode.GET, 0x00],
      ...[Opcode.JMP, 0xff, 0xfc],
      ...[Opcode.JMP_IF_NOT, 0x00, 0x03],
      ...[Opcode.NULL],
      ...[Opcode.ARRAY, 0x00, 0x03],
      ...[Opcode.INDEX],
      ...[Opcode.RET],
      ...[Opcode.CALL, 0x01],
      ...[Opcode.GETN, 0x33],
      ...[Opcode.CLOSURE, 0xff, 0xff, 0x01],
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
      '0012 BANG',
      '0013 MINUS',
      '0014 TRUE',
      '0015 FALSE',
      '0016 EQ',
      '0017 NOT_EQ',
      '0018 GT',
      '0019 GTE',
      '0020 SETG (65533)',
      '0023 GETG (2)',
      '0026 SET (255)',
      '0028 GET (0)',
      '0030 JMP (65532)',
      '0033 JMP_IF_NOT (3)',
      '0036 NULL',
      '0037 ARRAY (3)',
      '0040 INDEX',
      '0041 RET',
      '0042 CALL (1)',
      '0044 GETN (51)',
      '0046 CLOSURE (65535, 1)',
      '0050 HALT',
    ];
    expect(disassemble(bytecode).trim()).toEqual(expected.join('\n'));
  });
});
