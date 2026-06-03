const { FileSlice } = require("sldl-utils");
const {
  TokenContent,
  NumericLiteral,
  StringLiteral,
  Word,
  Token,
  kTokenReserved,
  kTokenType
} = require("./token.js");

/**
 * Lexer for the compiler frontend.
 * Takes a preprocessed FileSlice and produces a stream of Token objects.
 *
 * Unlike `PreprocessLexer`, this lexer does NOT handle preprocessor
 * directives - those have already been resolved by the preprocessor.
 */
class CompilerLexer {
  /**
   * @param {FileSlice|string} input - Input source (FileSlice or string).
   */
  constructor(input) {
    if (!(input instanceof FileSlice))
      input = FileSlice.fromFile("__temp__.skyc", input, 0);

    this.original = input;
    this.currentFile = input;
    // Convert input to a char array, in order to support unicode.
    this.string = Array.from(this.currentFile.getContent());
    this.line = this.column = this.columnEnd = 0;
    this.cursor = -1;
    this.readingVaniCmd = 0;
    this.peek = " ";
    this.begin = 0;
    this.isFirstInLine = 1;
    this.afterWhitespace = 0;
    this.look = void 0;

    /** Map of all words. */
    this.words = new Map();
    this.initReserved();
  }

  /**
   * Initialise the reserved-word table.
   */
  initReserved() {
    for (var k in kTokenReserved) {
      var r = kTokenReserved[k];
      if (r instanceof Word)
        this.reserve(r);
    }
  }

  /**
   * @param {Word} w
   */
  reserve(w) {
    this.words.set(w.lexeme, w)
  }

  /**
   * Build a Token from the current lexer state.
   * @param {TokenContent|string} content
   * @param {number} [type] - TokenContent type if content is a plain string.
   * @returns {Token}
   */
  buildToken(content, type) {
    var r;
    if (!(content instanceof TokenContent))
      content = new TokenContent(type, content);
    r = new Token(
      content,
      this.begin,
      this.begin + content.content.length,
      this.currentFile,
      this.line + this.currentFile.parentLine,
      this.column,
      this.isFirstInLine,
      this.afterWhitespace
    );
    // Once you build a token from this line, the next token(s) won't be the
    // first token in the line.
    this.isFirstInLine = 0;
    this.look = r;
    return r;
  }

  /**
   * @returns {boolean}
   */
  done() {
    return this.cursor >= this.string.length && !this.currentFile.next;
  }

  /**
   * @returns {boolean}
   */
  isUnquotedStringStart() {
    return /[\p{ID_Start}_]/u.test(this.peek);
  }

  /**
   * @returns {boolean}
   */
  isUnquotedString() {
    return /[\p{ID_Continue}]/u.test(this.peek);
  }

  /**
   * @returns {boolean}
   */
  isWhitespace() {
    return /[\t\v\f\uFEFF\p{Space_Separator}]/u.test(this.peek);
  }

  /**
   * Read a character. If `c` is given, check for match.
   * @param {string} [c]
   * @returns {boolean}
   */
  readch(c) {
    if (this.cursor >= this.string.length && this.currentFile.next) {
      // Switch to the next file in the chain.
      this.currentFile = this.currentFile.next;
      this.cursor = -1;
      this.line = this.column = this.columnEnd = 0;
      this.peek = " ";
      this.string = Array.from(this.currentFile.getContent());
    }

    if (!this.done()) {
      this.cursor++;
      this.columnEnd++;
      this.peek = this.string[this.cursor];
      if (this.peek != c)
        return false;
      this.peek = " ";
      return true
    }
  }

  /**
   * Check the current character without consuming it from the stream.
   * @param {string} c
   * @returns {boolean}
   */
  isch(c) {
    if (this.peek != c)
      return false;
    this.peek = " ";
    return true
  }

  /**
   * Skip whitespace. Returns 1 if whitespace was skipped, 0 otherwise.
   * @returns {number}
   */
  skipWhitespace() {
    var result = 0;
    for (; !this.done(); this.readch()) {
      if (this.isWhitespace()) {
        result = 1;
        continue;
      } else if (this.peek == "\n") {
        result = 1;
        this.line++;
        // It will consider "\n" as the first element in the line because of
        // the trailing this.readch() function, so we need to set the column
        // counter to -1, set the character after "\n" as the first character.
        this.columnEnd = this.column = -1;
        this.isFirstInLine = 1
      } else
        return result;
    }
    return result
  }

  /**
   * Skip the current line.
   */
  skipLine() {
    while (this.peek != "\n" && !this.done())
      this.readch();
  }

  /**
   * Scan a token content without context.
   * @returns {TokenContent|undefined}
   */
  scanRaw() {
    if (this.done())
      return void 0;

    // Read tokens.
    switch (this.peek) {
      case '&':
        if (this.readch('&'))
          return kTokenReserved.LogicAnd;
        return kTokenReserved.And;
      case '|':
        if (this.readch('|'))
          return kTokenReserved.LogicOr;
        return kTokenReserved.Or;
      case '=':
        if (this.readch('='))
          return kTokenReserved.Eq;
        return kTokenReserved.Assign;
      case '!':
        if (this.readch('='))
          return kTokenReserved.Neq;
        return kTokenReserved.Excl;
      case '<':
        if (this.readch('='))
          return kTokenReserved.Leq;
        return kTokenReserved.Lt;
      case '>':
        if (this.readch('='))
          return kTokenReserved.Geq;
        return kTokenReserved.Gt;
      case '-':
        if (this.readch('-'))
          return kTokenReserved.Dec;
        else if (this.isch('='))
          return kTokenReserved.SubTo;
        return kTokenReserved.Sub;
      case '+':
        if (this.readch('+'))
          return kTokenReserved.Inc;
        else if (this.isch('='))
          return kTokenReserved.AddTo;
        return kTokenReserved.Add;
      case '*':
        if (this.readch('='))
          return kTokenReserved.MulTo;
        return kTokenReserved.Mul;
      case '/':
        if (this.readch('='))
          return kTokenReserved.DivTo;
        return kTokenReserved.Div;
      case '%':
        if (this.readch('='))
          return kTokenReserved.ModTo;
        return kTokenReserved.Mod;
    }

    // Read identifier or keyword.
    if (this.isUnquotedStringStart()) {
      var b = this.readStringUnquoted()
        , w = this.words.get(b);

      if (w != void 0)
        return w;

      w = new Word(b);
      this.words.set(w.lexeme, w);

      return w;
    }

    // Read number.
    if (/\d/.test(this.peek)) {
      var numStr = this.readNumber();
      // TODO: Optimize number values.
      if (numStr.indexOf(".") >= 0)
        return new NumericLiteral(numStr, parseFloat(numStr));
      return new NumericLiteral(numStr, parseInt(numStr, 10));
    }

    // Read string literal.
    if (this.peek === '"') {
      var strval = this.readStringUntil('"');
      return new StringLiteral("\"" + strval + "\"", strval);
    }

    if (this.done())
      return void 0;

    // Unknown token - emit as a plain token.
    var t = new TokenContent(kTokenType.Token, this.peek);
    this.peek = " ";

    return t;
  }

  /**
   * Scan the next token.
   * @returns {Token|null}
   */
  scan() {
    this.afterWhitespace = this.skipWhitespace();
    if (this.done())
      return null;

    // Start reading, record current cursor.
    this.begin = this.cursor;
    this.column = this.columnEnd;

    var tokenContent = this.scanRaw();
    if (!tokenContent)
      return null;

    return this.buildToken(tokenContent);
  }

  /**
   * Implements JS iterator protocol.
   * @returns {{value: Token|null, done: boolean}}
   */
  next() {
    var d = this.done()
      , v = d ? null : this.scan();
    return {
      value: v,
      done: d
    }
  }

  readMarks() {
    ;
  }

  /**
   * Read a numeric literal.
   * @returns {string}
   */
  readNumber() {
    var o = "";
    do {
      o += this.peek;
      this.readch()
    } while (/\d/.test(this.peek))
    if (this.peek != ".")
      return o;
    o += ".";
    for (; !this.done();) {
      this.readch();
      if (!/\d/.test(this.peek))
        break;
      o += this.peek;
    }
    return o
  }

  /**
   * Read a string until the given terminator character.
   * @param {string} terminator
   * @returns {string}
   */
  readStringUntil(terminator) {
    var result = ""
      , escaped = false;
    while (!this.done()) {
      this.readch();
      if (escaped) {
        if (this.peek == "n")
          result += "\n";
        else
          result += this.peek;
        escaped = false;
      } else if (this.peek == "\\")
        escaped = true;
      else if (this.peek == terminator) {
        this.readch();
        return result;
      } else
        result += this.peek;
    }
    return result
  }

  /**
   * Read an unquoted identifier string.
   * @returns {string}
   */
  readStringUnquoted() {
    var result = "";
    if (!this.isUnquotedStringStart())
      return "";
    result += this.peek;
    while (!this.done()) {
      this.readch();
      if (!this.isUnquotedString())
        break;
      result += this.peek;
    }
    return result
  }
}

module.exports = {
  CompilerLexer
};
