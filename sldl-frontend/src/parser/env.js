/**
 * Symbol table on scope.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kBulitInExceptions } = require("sldl-utils");
const { Token, TokenContent, kInternalTypes } = require("../lexer/token.js");

const kEnvEntryType = Object.freeze({
  Variable: 0,
  Constant: 1,
  Primitive: 2,
  Typedef: 3,
  Struct: 5,
  Class: 4,
});

/** Represents a register in symbol table. */
class EnvEntry {
  static createStruct(token, node) {
    return new EnvEntry(
      kEnvEntryType.Struct,
      token.content,
      node
    );
  }

  static createClass(token, node) {
    return new EnvEntry(
      kEnvEntryType.Class,
      token.content,
      node
    );
  }

  /**
   * @param {number} type - Type.
   * @param {Word} id - Name.
   * @param {StructStatement|ClassStatement|Reference} [node] - Content.
   */
  constructor(type, id, node) {
    this.type = type || kEnvEntryType.Variable;
    this.name = id;
    /**
     * The AstNode of the definition. Undefined if the entry a pre-defined.
     * @type {AstNode|undefined}
     */
    this.node = node || void 0;
    /**
     * If this.type == kEnvEntryType.Typedef, the parent field represents the
     * original type of the alias; otherwise, it represents the parent class
     * inherited from.
     * @type {EnvEntry|undefined}
     */
    this.parent = void 0;
    /**
     * Member variable defs of the class or struct. Only valid when this.type
     * == kEnvEntryType.Class || this.type == kEnvEntryType.Struct.
     * @type {Map<string,AstNode>}
     */
    this.members = new Map();
  }

  /**
   * @returns {Word}
   */
  get ident() {
    return this.name;
  }

  /**
   * @param {EnvEntry} parent 
   */
  setParent(parent) {
    this.parent = parent;
  }

  /**
   * True if the entry represents a type declaration.
   * @returns {boolean}
   */
  isType() {
    return this.type == kEnvEntryType.Primitive
      || this.type == kEnvEntryType.Typedef
      || this.type == kEnvEntryType.Struct
      || this.type == kEnvEntryType.Class;
  }

  /**
   * True if the entry represents a internal type declaration.
   * @returns {boolean}
   */
  isInternalType() {
    return this.isPrimitive()
      || this.name == kInternalTypes.Object
      || this.name == kInternalTypes.Clump;
  }

  /**
   * True if the entry represents a variable or constant.
   * @returns {boolean}
   */
  isReference() {
    return !this.isType();
  }

  /**
   * Can be used in "extend" in class declarations.
   * @returns {boolean}
   */
  isExtendable() {
    return this.type == kEnvEntryType.Class;
  }

  /**
   * True if the entry represents a primitive type.
   * @returns {boolean}
   */
  isPrimitive() {
    return this.type == kEnvEntryType.Primitive;
  }
}

class Env {
  /**
   * @param {Env} [prev] 
   */
  constructor(prev = void 0) {
    this.prev = prev;
    this.symbols = new Map();
  }

  /**
   * Put a token and the related definition into the symbol table.
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [parent] 
   * @returns {boolean}
   */
  put(entry, parent) {
    if (this.symbols.has(entry.name.toString()))
      return false;

    if (parent) {
      var def = this.get(parent);
      if (!def)
        return false;

      if (entry.type != kEnvEntryType.Class && entry.type != kEnvEntryType.Typedef)
        return false;

      entry.setParent(def);
    }

    this.symbols.set(entry.name.toString(), entry);
    return true;
  }

  /**
   * Declare inherit from the entry specified by "parent".
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [parent] 
   * @returns {boolean}
   */
  inherit(entry, parent) {
    if (entry.type != kEnvEntryType.Class)
      return false;

    return this.put(entry, parent);
  }

  /**
   * Declare an alias from the entry specified by "token".
   * @param {EnvEntry} entry 
   * @param {Token|TokenContent|string} [parent] 
   * @returns {boolean}
   */
  alias(entry, parent) {
    if (entry.type != kEnvEntryType.Typedef)
      return false;

    return this.put(entry, parent);
  }

  /**
   * Get an identifier by a token.
   * @param {Token|TokenContent|string} token 
   * @returns {EnvEntry|undefined}
   */
  get(token) {
    var s = token instanceof Token
      ? token.raw()
      : token instanceof TokenContent
        ? token.content
        : token;
    for (var p = this; p; p = p.prev) {
      if (p.symbols.has(s))
        return p.symbols.get(s);
    }
    return void 0;
  }
}

module.exports = {
  Env,
  EnvEntry,
  kEnvEntryType
};
