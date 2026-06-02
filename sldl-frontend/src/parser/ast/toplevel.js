const { kTokenReserved } = require("../../lexer/token.js");
const { AstNode } = require("./astNode.js");
const { ClassStatement } = require("./statement/classStatement.js");

class ToplevelNode extends AstNode {
  constructor() {
    super();

    this.child = void 0;
  }

  /**
   * Parse a toplevel program.
   * @param {Parser} P - Parser.
   * @param {Env} E - Symbol table.
   */
  syntax(P, E) {
    while (!P.done) {
      if (P.test(kTokenReserved.Class)) {
        var clazz = new ClassStatement(P.look);
        clazz.parse(P, E);
      } else if (P.test(kTokenReserved.Semicolon))
        P.move();
      else
        throw new Error("unexpected " + P.content);
    }
  }
}

module.exports = {
  ToplevelNode
};
