import { Lexer, Parser, VM } from '.';
import { Compiler } from './compiler';

const lexer = new Lexer(`acc := 0;
        for x in [1, 2, 3] {
          acc += x;
        };
        acc;`);
const parser = new Parser(lexer);
const program = parser.parse();
const compiler = new Compiler();
compiler.compile(program);

try {
  const vm = new VM(compiler);
  vm.run();

  const result = vm.lastElement();
  console.log(result);
} catch (e) {
  console.log(e);
}
