/**
 * Node of abstract syntax tree.
 * 
 * Each AstNode can contain two types of other nodes: reference nodes and child
 * nodes. Reference nodes represent things like the original type declaration and
 * are used only for identification; child nodes are nodes directly derived from
 * productions and are used for semantic computation.
 */
class AstNode {
  /**
   * @param {Token} [token] 
   */
  constructor(token) {
    /** 
     * Complete initial token with context. Errors of the node will use this
     * token as context.
     */
    this.ctx = token;
  }

  /**
   * Triggers an error.
   * @param {CompileException} e
   */
  error(e) {
    throw e;
  }

  /**
   * Relocate the node to a new context.
   * @param {Token} token 
   */
  relocate(token) {
    this.ctx = token;
  }

  /**
   * Parse the node from the Parser, with panic mode.
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   * @param {...any} args - Other arguments.
   * @returns {boolean}
   */
  parse(P, E, ...args) {
    try {
      this.syntax(P, E, ...args);
      return true;
    } catch (e) {
      P.onerror(e);
      return false;
    }
  }

  /**
   * Parse the node from the Parser.
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    ;
  }

  /**
   * Do the semantic computation.
   */
  semantic(P, E) {
    ;
  }

  /**
   * Default toString().
   * @returns {string}
   */
  toString() {
    if (!this.ctx)
      return "";
    return this.ctx.content.toString();
  }
}

module.exports = {
  AstNode
};
