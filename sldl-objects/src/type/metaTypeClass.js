const { Buffer } = require("buffer");
const { LevelValue } = require("../value/levelValue.js");
const { LevelValueClass } = require("../value/levelValueClass.js");
const { LevelValuePointer } = require("../value/levelValuePointer.js");
const { LevelValueString } = require("../value/levelValueString.js");
const { LevelValueNumber } = require("../value/levelValueNumber.js");
const { LevelValueRaw } = require("../value/levelValueRaw.js");
const { LevelValueStruct } = require("../value/levelValueStruct.js");
const { MetaType, kMetaValueType, MetaTypeForward, kMetaValueFlag } = require("./metaType.js");
const { MetaTypeRaw } = require("./metaTypeRaw.js");
const { kObjectExceptions } = require("../exceptions.js");
const { MetaTypePointer } = require("./metaTypePointer.js");

// Local copy to avoid circular dep with levelObjects.js.
var kMemvarTypes = Object.freeze({
  Raw: 0,
  String: 1,
  Ref: 2,
  Array: 3
});

var kTypesModule = null;
function getTypes() {
  if (!kTypesModule) kTypesModule = require("../types.js");
  return kTypesModule;
}

// Binary class descriptor to pass when reading a class/clump member, so that
// the member can iterate its own binary memvar order. Returns undefined for
// non-class members.
function classRawFor(L, def) {
  if (def.valueType() === kMetaValueType.Class
    || def.valueFlag() === kMetaValueFlag.Clump)
    return L.classes[L.getClassIdx(def.getName())];
  return void 0;
}

// Read a member that has no matching definition, using its raw memvar
// descriptor to choose the representation (string / pointer / raw bytes).
function readUnknownMember(L, B, off, rawMemvar) {
  var T = getTypes().kMetaTypes;
  if (!rawMemvar)
    return new MetaTypeRaw("raw", 4).read(L, B, off);
  if (rawMemvar.type === kMemvarTypes.String)
    return T.CString.read(L, B, off);
  if (rawMemvar.type === kMemvarTypes.Ref)
    return T.Pointer.read(L, B, off);
  return new MetaTypeRaw("raw", rawMemvar.size || 4).read(L, B, off);
}

class MetaTypeClassMember extends MetaTypeForward {
  constructor(def, name) {
    super(def, name);
  }
}

class MetaTypeClassMemberArray extends MetaTypeClassMember {
  /**
   * @param {MetaType} def
   * @param {string} name
   * @param {number} [count] - 0 = dynamic, >0 = fixed max count.
   */
  constructor(def, name, count) {
    super(def, name);
    this.maxCount = count || 0;
  }

  valueFlag() {
    return kMetaValueFlag.Array;
  }

  /**
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @param {LoClass} raw
   * @returns {LevelValue[]|undefined}
   */
  read(L, B, off, raw) {
    var count = B.readUInt32LE(off)
      , cursor = off + 4;

    if (this.maxCount && count > this.maxCount)
      return void 0;

    var r = [];
    for (var i = 0; i < count; i++) {
      var v = this.def.read(L, B, cursor, raw);
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

    this.parent = typeof parent === "undefined"
      ? getTypes().kMetaTypes.Object
      : parent;
    /** @type {Map<string, MetaTypeClassMember>} */
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

    var member;
    // If def is already a ClassMember (pre-wrapped by declGroup parser), use it.
    if (def instanceof MetaTypeClassMember || def.valueFlag() === kMetaValueFlag.Array) {
      member = def;
    } else if (typeof count === "number") {
      member = new MetaTypeClassMemberArray(def, this.name + "::" + name, count);
    } else {
      member = new MetaTypeClassMember(def, this.name + "::" + name);
    }

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
      var m = p.members.get(name);
      if (m)
        return m;
      p = p.parent;
    }
    return void 0;
  }

  /**
   * Get all members across the inheritance chain.
   * @param {Set<string>} [usedMembers] - if provided, only return members
   *   whose names are in this set (member pruning).
   * @returns {Array<[string, MetaTypeClassMember]>}
   */
  allMembers(usedMembers) {
    var r = []
      , seen = new Set();
    for (var p = this; p; p = p.parent) {
      for (var [memberName, member] of p.members) {
        if (seen.has(memberName))
          continue;
        if (usedMembers && !usedMembers.has(memberName))
          continue;
        seen.add(memberName);
        r.push([memberName, member]);
      }
    }
    return r;
  }

  /**
   * Read object member values from the binary buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @param {LoClass} [raw]
   * @returns {LevelValueClass|null|undefined}
   */
  read(L, B, off, raw) {
    var r = new LevelValueClass(this, "")
      , cursor = off
      , memberNames = raw
        ? Array.from(raw.raw.keys())
        : this.allMembers().map(function (e) { return e[0]; });

    for (var i = 0; i < memberNames.length; i++) {
      var memberName = memberNames[i]
        , m = this.getMember(memberName)
        , rawMemvar = raw ? raw.raw.get(memberName) : void 0
        , v;

      try {
        v = m
          ? m.read(L, B, cursor, classRawFor(L, m.def))
          : readUnknownMember(L, B, cursor, rawMemvar);
      } catch (e) {
        v = void 0;
      }

      if (!v) {
        // Gracefully skip: advance cursor by the memvar's declared size.
        cursor += rawMemvar ? (rawMemvar.size || 4) : (m ? m.getSize() : 4);
        continue;
      }

      if (m && m.valueType() == kMetaValueType.Pointer)
        Array.isArray(v)
          ? L.pointers.push.apply(L.pointers, v)
          : L.pointers.push(v);

      r.setValue(memberName, v);
      cursor += LevelValue.sizeOf(v);
    }

    r.finalize();
    return r;
  }

  /**
   * Write object member values into the binary buffer.
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {LevelValueClass} val
   * @param {number} off
   * @param {LoClass} [raw] - binary class descriptor for member iteration
   *   order. If omitted, definition order is used.
   * @returns {number} Number of bytes written, or 0 on failure.
   */
  write(L, B, val, off, raw) {
    var cursor = off
      // Use binary memvar order when available.
      , memberNames = raw
        ? Array.from(raw.raw.keys())
        : this.allMembers().map(function (e) { return e[0]; });

    for (var i = 0; i < memberNames.length; i++) {
      var memberName = memberNames[i]
        , m = this.getMember(memberName)
        , v = val.getValue(memberName);

      if (!v) {
        // Fill with default.
        v = MetaTypeClass.memberTypeDefault(m);
      }

      var n = m.write(L, B, v, cursor);
      if (!n) {
        // Fallback: write value as raw bytes if the member def mismatch.
        if (Buffer.isBuffer(v.getValue ? v.getValue() : void 0)) {
          var buf = v.getValue();
          var len = Math.min(buf.length, m.getSize());
          buf.copy(B, cursor, 0, len);
          n = m.getSize();
        } else if (v && v.def && v.def.write && v.def !== m.def) {
          n = v.def.write(L, B, v, cursor);
        }
      }
      if (!n)
        return 0;
      cursor += n;
    }

    return cursor - off;
  }

  /**
   * Create a default LevelValue for a member type.
   * @param {MetaTypeClassMember} member
   * @returns {LevelValue|LevelValue[]}
   */
  static memberTypeDefault(member) {
    var vt = member.valueType();
    var def = member.def;

    if (member.valueFlag() === kMetaValueFlag.Array) {
      return [];
    }

    if (vt === kMetaValueType.Pointer) {
      var p = new LevelValuePointer(def);
      p.setIndex(0xFFFFFFFF);
      return p;
    }

    if (vt === kMetaValueType.String) {
      var s = new LevelValueString(def);
      s.setValue("");
      return s;
    }

    if (vt === kMetaValueType.Number) {
      var n = new LevelValueNumber(def);
      n.setValue(0);
      return n;
    }

    if (vt === kMetaValueType.Raw) {
      var r = new LevelValueRaw(def);
      r.setValue(Buffer.alloc(def.getSize()));
      return r;
    }

    if (vt === kMetaValueType.Struct) {
      var st = new LevelValueStruct(def);
      for (var [name, sm] of def.members) {
        var sv = MetaTypeClass.memberTypeDefault(sm);
        st.setValue(name, sv);
      }
      return st;
    }

    // Fallback - return zero-valued number.
    var fallback = new LevelValueNumber(def);
    fallback.setValue(0);
    return fallback;
  }
}

/**
 * Clump generic type, forwarding to the base Clump class with
 * type-parameter tracking for validation.
 */
class MetaTypeClump extends MetaTypeForward {
  /**
   * @param {string} name - e.g. "Clump<Actor>"
   * @param {MetaTypeClass} genericParam - the type parameter T
   */
  constructor(name, genericParam) {
    // Lazy-load to avoid circular dep with types.js.
    super(getTypes().kMetaTypes.Clump, name);
    /** @type {MetaTypeClass} */
    this.genericParam = genericParam;
  }

  /** Forward members access to the base Clump class. */
  get members() {
    return this.def.members;
  }

  get parent() {
    return this.def.parent;
  }

  set parent(v) {
    this.def.parent = v;
  }

  /** Forward class-level methods to the base Clump. */
  allMembers(usedMembers) {
    return this.def.allMembers(usedMembers);
  }

  getMember(name) {
    return this.def.getMember(name);
  }

  addMember(def, name, count) {
    return this.def.addMember(def, name, count);
  }

  isCompatible(def) {
    return this.def.isCompatible(def);
  }

  valueType() {
    return kMetaValueType.Class;
  }

  valueFlag() {
    return kMetaValueFlag.Clump;
  }
}

module.exports = {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass,
  MetaTypeClump
};
