import { Lexer } from './lexer';
import { Parser } from './parser';
import * as ast from './ast';
import * as obj from './object';
import { VM } from './vm';
import { Token, TokenType, tokenIs } from './token';

export { ast, obj, Lexer, Parser, Token, TokenType, tokenIs, VM };
