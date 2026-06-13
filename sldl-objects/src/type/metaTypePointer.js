const { kMetaValueType, MetaType } = require("./metaType.js");
const { MetaTypeNumber } = require("./metaTypeNumber.js");
const { LevelValuePointer } = require("../value/levelValuePointer.js");

/**
 * Pointer type forwarding to uint32_t with target-type tracking.
 * Inherits size/align from Uint32 via MetaTypeForward.
 */
class MetaTypePointer extends MetaType {
  /**
   * @param {string} name
   * @param {MetaTypeClass} target
   */
  constructor(name, target) {
    super(name);
    /** @type {MetaTypeClass} */
    this.points = target;
  }

  getSize() {
    return 4;
  }

  getAlign() {
    return 4;
  }

  /** Override: Pointer type identity, not forwarded. */
  valueType() {
    return kMetaValueType.Pointer;
  }

  /**
   * Check whether an actual class is compatible with the pointer target.
   * @param {MetaTypeClass} actual
   * @returns {boolean}
   */
  isCompatible(actual) {
    if (!this.points)
      return true;
    return this.points.isCompatible(actual);
  }

  read(L, B, off) {
    var r = new LevelValuePointer(this);
    r.setIndex(B.readUInt32LE(off));
    return r;
  }

  write(L, B, val, off) {
    B.writeUInt32LE(val.index, off);
    return this.getSize();
  }
}

module.exports = {
  MetaTypePointer
};