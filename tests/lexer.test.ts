import { Lexer } from '../src/lexer';
import { Token } from '../src/token';

describe('Lexer', () => {
  test('should tokenize identifiers and identify illegal patterns', () => {
    const inputs: Record<string, string[][]> = {
      'a3': [['identifier', 'a3']],
      '3a': [
        ['int', '3'],
        ['identifier', 'a'],
      ],
      '#m': [
        ['illegal', '#'],
        ['identifier', 'm'],
      ],
      'C#3': [['identifier', 'C#3']],
      'longer_phrase': [['identifier', 'longer_phrase']],
    };

    Object.keys(inputs).forEach((input) => {
      const l = new Lexer(input);
      const tokens = [];

      let token: Token = l.nextToken();
      while (token.tokenType !== 'eof') {
        const [tokenType, literal] = inputs[input].shift();
        expect(token.tokenType).toEqual(tokenType);
        expect(token.literal).toEqual(literal);
        tokens.push(token);
        token = l.nextToken();
      }
    });
  });

  test('should tokenize string script', () => {
    const input = `
      a := 3;
      b := 4;
      b = b - a;
      abc := fn(x, y) {
        return x + y;
      };
      m := note [C#4 127 4];
      l := gen {
        yield note [Db3 64 1];
      };
      a += 3;
      b -= 4;
      c *= 5;
      d /= 6;
      e %= 7;
    `;

    const expected: string[][] = [
      ['identifier', 'a'],
      ['declare', ':='],
      ['int', '3'],
      ['semicolon', ';'],
      ['identifier', 'b'],
      ['declare', ':='],
      ['int', '4'],
      ['semicolon', ';'],
      ['identifier', 'b'],
      ['assign', '='],
      ['identifier', 'b'],
      ['minus', '-'],
      ['identifier', 'a'],
      ['semicolon', ';'],
      ['identifier', 'abc'],
      ['declare', ':='],
      ['fn', 'fn'],
      ['lparen', '('],
      ['identifier', 'x'],
      ['comma', ','],
      ['identifier', 'y'],
      ['rparen', ')'],
      ['lbrace', '{'],
      ['return', 'return'],
      ['identifier', 'x'],
      ['plus', '+'],
      ['identifier', 'y'],
      ['semicolon', ';'],
      ['rbrace', '}'],
      ['semicolon', ';'],
      ['identifier', 'm'],
      ['declare', ':='],
      ['note', 'note'],
      ['lbracket', '['],
      ['identifier', 'C#4'],
      ['int', '127'],
      ['int', '4'],
      ['rbracket', ']'],
      ['semicolon', ';'],
      ['identifier', 'l'],
      ['declare', ':='],
      ['gen', 'gen'],
      ['lbrace', '{'],
      ['yield', 'yield'],
      ['note', 'note'],
      ['lbracket', '['],
      ['identifier', 'Db3'],
      ['int', '64'],
      ['int', '1'],
      ['rbracket', ']'],
      ['semicolon', ';'],
      ['rbrace', '}'],
      ['semicolon', ';'],
      ['identifier', 'a'],
      ['pluseq', '+='],
      ['int', '3'],
      ['semicolon', ';'],
      ['identifier', 'b'],
      ['minuseq', '-='],
      ['int', '4'],
      ['semicolon', ';'],
      ['identifier', 'c'],
      ['asteriskeq', '*='],
      ['int', '5'],
      ['semicolon', ';'],
      ['identifier', 'd'],
      ['rslasheq', '/='],
      ['int', '6'],
      ['semicolon', ';'],
      ['identifier', 'e'],
      ['percenteq', '%='],
      ['int', '7'],
      ['semicolon', ';'],
    ];

    const l = new Lexer(input);
    let token: Token = l.nextToken();
    while (token.tokenType !== 'eof') {
      const [tokenType, literal] = expected.shift();
      expect(token.tokenType).toEqual(tokenType);
      expect(token.literal).toEqual(literal);
      token = l.nextToken();
    }
  });
});
