/**
 * Imports
 */
const { KNOWN_LABELS } = require('../..');

module.exports = (CodeMirror) => {
  CodeMirror.defineMode('melee', (config) => {
    const indentUnit = config.indentUnit;
    const keywords = {
      'break': true,
      'cc': true,
      'continue': true,
      'else': true,
      'for': true, 
      'fn': true,
      'gen': true,
      'if': true,
      'in': true,
      'loop': true,
      'next': true,
      'note': true,
      'return': true,
      'skip': true,
      'while': true,
      'yield': true,
    };

    const atoms = {
      'true': true,
      'false': true,
      ...KNOWN_LABELS.reduce((acc, cur) => ({
        ...acc,
        [cur]: true,
      }), {}),
    };

    const isOperatorChar = /[+\-*&^%:=<>!|\/]/;

    let curPunc;

    function tokenBase(stream, state) {
      const ch = stream.next();

      if (/[\d\.]/.test(ch)) {
        stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
        return 'number';
      }
      if (/[\[\]{}\(\),;\:\.=]/.test(ch)) {
        curPunc = ch;
        return null;
      }
      if (ch == '/') {
        if (stream.eat('/')) {
          stream.skipToEnd();
          return 'comment';
        }
      }
      if (isOperatorChar.test(ch)) {
        stream.eatWhile(isOperatorChar);
        return 'operator';
      }
      stream.eatWhile(/[\w\$#_\xa1-\uffff]/);
      var cur = stream.current();
      if (keywords.propertyIsEnumerable(cur)) {
        return 'keyword';
      }
      if (atoms.propertyIsEnumerable(cur)) return 'atom';
      return 'variable';
    }

    function Context(indented, column, type, align, prev) {
      this.indented = indented;
      this.column = column;
      this.type = type;
      this.align = align;
      this.prev = prev;
    }

    function pushContext(state, col, type) {
      return state.context = new Context(state.indented, col, type, null, state.context);
    }

    function popContext(state) {
      if (!state.context.prev) return;
      var t = state.context.type;
      if (t == ')' || t == ']' || t == '}')
        state.indented = state.context.indented;
      return state.context = state.context.prev;
    }

    return {
      startState: function(basecolumn) {
        return {
          tokenize: null,
          context: new Context((basecolumn || 0) - indentUnit, 0, 'top', false),
          indented: 0,
          startOfLine: true
        };
      },

      token: function(stream, state) {
        var ctx = state.context;
        if (stream.sol()) {
          if (ctx.align == null) ctx.align = false;
          state.indented = stream.indentation();
          state.startOfLine = true;
        }
        if (stream.eatSpace()) return null;
        curPunc = null;
        var style = (state.tokenize || tokenBase)(stream, state);
        if (style == 'comment') return style;
        if (ctx.align == null) ctx.align = true;

        if (curPunc == '{') pushContext(state, stream.column(), '}');
        else if (curPunc == '[') pushContext(state, stream.column(), ']');
        else if (curPunc == '(') pushContext(state, stream.column(), ')');
        else if (curPunc == '}' && ctx.type == '}') popContext(state);
        else if (curPunc == ctx.type) popContext(state);
        state.startOfLine = false;
        return style;
      },

      indent: function(state, textAfter) {
        if (state.tokenize != tokenBase && state.tokenize != null) return CodeMirror.Pass;
        var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
        var closing = firstChar == ctx.type;
        if (ctx.align) return ctx.column + (closing ? 0 : 1);
        else return ctx.indented + (closing ? 0 : indentUnit);
      },

      electricChars: '{}):',
      closeBrackets: '()[]{}',
      fold: 'brace',
      lineComment: '//'
    };
  });

  CodeMirror.defineMIME('text/x-melee', 'melee');
};
