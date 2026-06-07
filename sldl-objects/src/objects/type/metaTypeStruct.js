const { LevelValueStruct } = require("../value/levelValueStruct.js");
const { MetaType, kMetaValueType } = require("./metaType.js");

class MetaTypeStructMember extends MetaType {
  constructor(def, name, count) {
    super(name);

    this.def = def;
    this.name = name;
    this.offset = 0;
    this.count = count || 1;
  }

  getSize() {
    return this.def.getSize() * this.count;
  }

  getAlign() {
    return this.def.getAlign();
  }

  valueType() {
    return this.def.valueType();
  }

  /**
   * @param {Buffer} B 
   * @param {number} off - Offset of the struct.
   * @returns {LevelValue|LevelValue[]}
   */
  read(B, off) {
    var begin = off + this.offset;
    if (this.count == 1)
      return this.def.read(B, begin);

    var r = [];
    for (var i = 0; i < this.count; i++)
      r.push(this.def.read(B, begin + i * this.getSize()));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValue|LevelValue[]} val 
   * @param {number} off - Offset of the struct.
   * @returns {number}
   */
  write(B, val, off) {
    var begin = off + this.offset;
    if (this.count == 1)
      return this.def.write(B, val, begin);

    for (var i = 0; i < this.count; i++)
      this.def.write(B, val[i], begin + i * this.getSize());

    return this.getSize() * this.count;
  }
}

class MetaTypeStruct extends MetaType {
  constructor(name) {
    super(name);

    /** @type {Map<string, MetaTypeStructMember>} */
    this.members = new Map();
    this.size = 0;
    this.align = 0;
    this.cursor = 0;
  }

  getSize() {
    return this.size;
  }

  valueType() {
    return kMetaValueType.Struct;
  }

  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} count
   * @returns {boolean}
   */
  addMember(def, name, count) {
    if (def.valueType() != kMetaValueType.Number && def.valueType() != kMetaValueType.Struct)
      return false;

    var member = new MetaTypeStructMember(def, this.name + "::" + name, count)
      , align = member.getAlign();
    // Aligned to an integer multiple of the alignment value.
    member.offset = this.cursor % align
      ? this.cursor - (this.cursor % align) + align
      : this.cursor;
    // Update cursor.
    this.cursor = member.offset + member.getSize();
    // Update alignment.
    this.align = Math.max(this.align, align);
    // Update size.
    this.size = this.cursor % this.align
      ? this.cursor - (this.cursor % this.align) + this.align
      : this.cursor;
    // Add member to lookup table.
    this.members.set(name, member);
  }

  /**
   * Mark the struct as completed and force set the total alignment.
   * @param {number} [align] 
   */
  finalize(align) {
    if (align)
      this.align = align;
    this.size = this.cursor % this.align
      ? this.cursor - (this.cursor % this.align) + this.align
      : this.cursor;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValue}
   */
  read(B, off) {
    if (off + this.getSize() > B.length)
      return void 0;

    var r = new LevelValueStruct(this);
    for (var member of this.members.entries()) {
      var m = member[1].read(B, off);
      r.setValue(member[0], m);
    }

    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValue} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;
  }
}

module.exports = {
  MetaTypeStructMember,
  MetaTypeStruct
};
