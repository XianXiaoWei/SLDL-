/**
 * Parser.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { FileSlice, kBulitInExceptions } = require("sldl-utils");
const { CompilerLexer } = require("../lexer/lexer.js");
const { TokenContent, kTokenType, kTokenReserved, Token, kInternalTypes } = require("../lexer/token.js");
const { Env, EnvEntry, kEnvEntryType } = require("./env.js");

/**
 * Initialize the symbol table. Internal types has no AstNode.
 * @param {Env} env 
 */
function initialEnv(env) {
  function prim(content) {
    return new EnvEntry(kEnvEntryType.Primitive, content);
  }

  // Integer types.
  env.put(prim(kInternalTypes.Bool));
  env.put(prim(kInternalTypes.Int8));
  env.put(prim(kInternalTypes.Uint8));
  env.put(prim(kInternalTypes.Int16));
  env.put(prim(kInternalTypes.Uint16));
  env.put(prim(kInternalTypes.Int32));
  env.put(prim(kInternalTypes.Uint32));
  env.put(prim(kInternalTypes.Int64));
  env.put(prim(kInternalTypes.Uint64));
  // Float types.
  env.put(prim(kInternalTypes.Float));
  env.put(prim(kInternalTypes.Double));
  // String types.
  env.put(prim(kInternalTypes.Cstring));
  env.put(prim(kInternalTypes.TgcString));
  // Object types.
  env.put(new EnvEntry(kEnvEntryType.Class, kInternalTypes.Object));
  env.put(new EnvEntry(kEnvEntryType.Class, kInternalTypes.Clump));
}

class CompilerParser {
  /**
   * @param {FileSlice|string} input
   */
  constructor(input) {
    this.lexer = new CompilerLexer(input);

    this.errors = [];

    this.look = void 0;
    this.done = false;

    /** Stores all symbols (types, objects, identifiers). */
    this.env = new Env();

    initialEnv(this.env);

    this.move();
  }

  /**
   * @returns {TokenContent}
   */
  get content() {
    return this.look.content;
  }

  move() {
    this.look = this.lexer.scan();
    if (!this.look)
      this.done = true;
  }

  /**
   * Move until the given token. Used in panic mode.
   * After the function, loop points to the given token or end of the file.
   * @param {...number|string|TokenContent} cond 
   */
  moveTil(...cond) {
    while (!this.done && !cond.some(this.test.bind(this)))
      this.move();
  }

  /**
   * Check the token.
   * @param {number|string|TokenContent} cond 
   * @returns {boolean}
   */
  test(cond) {
    if (typeof cond === "object") {
      if (this.content !== cond && this.content.content !== cond.content)
        return false;
      return true;
    }

    if (typeof cond === "number" && this.content.type != cond)
      return false;

    if (typeof cond === "string" && this.content.content !== cond)
      return false;

    return true;
  }

  match(cond) {
    if (!this.test(cond))
      throw kBulitInExceptions.Unexpected.from(this.look);
  }

  onerror(e) {
    if (this.errors.length >= 1024)
      throw kBulitInExceptions.TooManyError.from();
    this.errors.push(e);
  }
}

module.exports = {
  CompilerParser
};
