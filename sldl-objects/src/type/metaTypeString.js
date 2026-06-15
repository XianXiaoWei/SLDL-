const { Buffer } = require("buffer");
const { MetaType, kMetaValueType } = require("./metaType.js");
const { LevelValueString } = require("../value/levelValueString.js");

class MetaTypeString extends MetaType {
  constructor(name) {
    super(name);
  }

  valueType() {
    return kMetaValueType.String;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @returns {LevelValueString}
   */
  read(L, B, off) {
    var r = new LevelValueString(this);
    // Scan for the null terminator and keep the exact bytes. The consumed
    // size must be the on-disk byte span, not the re-encoded length of the
    // decoded string (see LevelValueString for the rationale).
    var end = off;
    while (end < B.length && B[end])
      end++;
    r.setRaw(Buffer.from(B.subarray(off, end)));
    return r;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValueString} val
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    if (val.def != this)
      return 0;
    var bytes = val.getBytes();
    bytes.copy(B, off);
    B[off + bytes.length] = 0;
    return bytes.length + 1;
  }
}

module.exports = {
  MetaTypeString
};
