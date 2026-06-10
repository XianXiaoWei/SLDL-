const { Buffer } = require("sldl-utils");
const { LevelValueClass } = require("../value/levelValueClass.js");
const { MetaType, kMetaValueType, MetaTypeForward } = require("./metaType.js");
const { kObjectExceptions } = require("../exceptions.js");

class MetaTypeClassMember extends MetaTypeForward {
  constructor(def, name) {
    super(def, name);
  }
}

class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count] 
   */
  constructor(def, name, count) {
    super(def, name);

    this.maxCount = count || 0;
  }

  /**
   * @param {LoIndices} L 
   * @param {Buffer} B 
   * @param {number} off
   * @returns {LevelValue[]}
   */
  read(L, B, off) {
    var count = B.readUint32LE(off)
      , cursor = off + 4;

    if (this.maxCount && count > this.maxCount)
      return void 0;

    var r = [];
    for (var i = 0; i < count; i++) {
      var v = this.def.read(L, B, cursor);
      r.push(v);
      cursor += v.getSize();
    }

    return r;
  }

  /**
   * @param {LoIndices} L 
   * @param {Buffer} B 
   * @param {LevelValue[]} val 
   * @param {number} off
   * @returns {number}
   */
  write(L, B, val, off) {
    if (this.maxCount && val.length > this.maxCount)
      return 0;

    B.writeUInt32LE(val.length, off);

    var cursor = off + 4;
    for (var v of val) {
      var n = this.def.write(L, B, v, cursor);
      if (!n)
        return 0;
      cursor += n;
    }

    return cursor - off;
  }
}

class MetaTypeClass extends MetaType {
  constructor(name, parent) {
    super(name);

    this.parent = typeof parent === "undefined" ? require("../types.js").kMetaTypes.Object : parent;
    this.members = new Map();
  }

  /**
   * Check if the given type is in the inheritance chain.
   * @param {MetaType} def 
   * @returns {boolean}
   */
  isCompatible(def) {
    for (var p = this; p; p = p.parent)
      if (def == p)
        return true;
    return false;
  }

  valueType() {
    return kMetaValueType.Class;
  }

  /**
   * @param {MetaType} def 
   * @param {string} name 
   * @param {number} [count]
   * @returns {boolean}
   */
  addMember(def, name, count) {
    if (this.getMember(name))
      return false;

    var member = typeof count === "number"
      ? new MetaTypeClassMemberArray(def, this.name + "::" + name, count)
      : new MetaTypeClassMember(def, this.name + "::" + name);

    // Add member to lookup table.
    this.members.set(name, member);

    return true;
  }

  /**
   * @param {string} name 
   * @returns {MetaTypeClassMemberArray|MetaTypeClassMember|undefined}
   */
  getMember(name) {
    var p = this;
    while (p) {
      var m = p.members.get(name)
      if (m)
        return m;
      p = p.parent;
    }
    return void 0;
  }

  /**
   * Get all members across the inheritance chain.
   * Members defined in child classes take precedence over parent
   * members with the same name.
   * @returns {Array<[string, MetaTypeClassMember]>}
   */
  allMembers() {
    var r = []
      , seen = new Set();
    for (var p = this; p; p = p.parent) {
      for (var [memberName, member] of p.members) {
        if (seen.has(memberName))
          continue;
        seen.add(memberName);
        r.push([memberName, member]);
      }
    }
    return r;
  }

  /**
   * @param {LoIndices} L 
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValue|null|undefined}
   */
  read(L, B, off) {
    var cursor = off
      , classIdx = B.readUint32LE(cursor)
      , name = B.readStringZero(cursor + 4);

    // Verify the real class and dispatch.
    var raw = L.classes[classIdx];
    if (!raw)
      throw kObjectExceptions.InvalidClassIndex.from(classIdx);
    if (raw.def != this)
      return raw.def.read(L, B, off);

    // Found the correct class definition, read from the buffer.
    cursor += 4 + Buffer.from(name).length + 1;

    var r = new LevelValueClass(this, name);
    for (var memberName of raw.raw.keys()) {
      var m = this.getMember(memberName)
        , v = m.read(L, B, cursor);

      if (!v)
        return void 0;

      if (m.valueType() == kMetaValueType.Pointer) {
        Array.isArray(v)
          ? L.pointers.push(...v)
          : L.pointers.push(v);
      }

      r.setValue(memberName, v);
      cursor += Array.isArray(v)
        ? v.reduce((sum, val) => sum + val.getSize(), 0) + 4
        : v.getSize();
    }

    r.finalize();

    return r;
  }

  /**
   * @param {LoIndices} L 
   * @param {Buffer} B 
   * @param {LevelValueClass|null} val 
   * @param {number} off 
   * @returns {number}
   */
  write(L, B, val, off) {
    var cursor = off;

    // Look up the class index for this object's type.
    var classIdx = L.getClassIdx(val.getDef().getName());
    B.writeUInt32LE(classIdx, cursor);
    cursor += 4;

    // Write the object name as a zero-terminated string inline.
    var name = Buffer.from(val.getName() + "\0");
    name.copy(B, cursor);
    cursor += name.length;

    // Write each member in the raw memvar order from the LoClass.
    var raw = L.classes[classIdx];
    for (var memberName of raw.raw.keys()) {
      var m = this.getMember(memberName)
        , v = val.getValue(memberName);

      if (!v)
        return 0;

      var n = m.write(L, B, v, cursor);
      if (!n)
        return 0;
      cursor += n;
    }

    return cursor - off;
  }
}

module.exports = {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass
};
