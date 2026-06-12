var { Buffer } = require("buffer");
var { LevelValueString } = require("./value/levelValueString.js");
var { LevelValueNumber, LevelValueBool } = require("./value/levelValueNumber.js");
var { LevelValuePointer } = require("./value/levelValuePointer.js");
var { LevelValueRaw } = require("./value/levelValueRaw.js");
var { LevelValueStruct } = require("./value/levelValueStruct.js");
var { LevelValueClass } = require("./value/levelValueClass.js");
var { kMetaValueType } = require("./type/metaType.js");
var { MetaTypeClassMemberArray } = require("./type/metaTypeClass.js");
var { kObjectExceptions } = require("./exceptions.js");

/**
 * Convert a JSON value to a LevelValue based on the member definition.
 * @param {any} jsonValue — the JSON value (number, string, boolean, object, array, null)
 * @param {MetaTypeClassMember} member — the member definition
 * @param {DeclarationGroup} declGroup — for resolving K$ / P$ refs
 * @returns {LevelValue|LevelValue[]}
 */
function parse(jsonValue, member, declGroup) {
  // Handle arrays.
  if (member instanceof MetaTypeClassMemberArray) {
    if (!Array.isArray(jsonValue)) {
      // Single value coerced to single-element array.
      jsonValue = jsonValue === void 0 || jsonValue === null ? [] : [jsonValue];
    }

    var elemDef = member.def;
    var result = [];
    for (var i = 0; i < jsonValue.length; i++) {
      result.push(parse(jsonValue[i],
        new (require("./type/metaTypeClass.js").MetaTypeClassMember)(elemDef, member.name),
        declGroup));
    }
    return result;
  }

  // Handle pointers (P$ references).
  if (member.valueType() === kMetaValueType.Pointer) {
    var ptr = new LevelValuePointer();

    if (jsonValue === null || jsonValue === void 0) {
      ptr.setIndex(0xFFFFFFFF);
      ptr.targetName = null;
    } else if (typeof jsonValue === "string" && jsonValue.startsWith("P$")) {
      ptr.targetName = jsonValue.slice(2);
      ptr.setIndex(0xFFFFFFFF); // Placeholder, resolved during write.
    } else if (typeof jsonValue === "number") {
      ptr.setIndex(jsonValue >>> 0);
      ptr.targetName = null;
    } else {
      throw kObjectExceptions.InvalidValueFormat.from(String(jsonValue),
        member.def.getName());
    }

    return ptr;
  }

  // Handle strings.
  if (member.valueType() === kMetaValueType.String) {
    var s = new LevelValueString(member.def);
    s.setValue(typeof jsonValue === "string" ? jsonValue
      : jsonValue === null || jsonValue === void 0 ? ""
      : String(jsonValue));
    return s;
  }

  // Handle raw.
  if (member.valueType() === kMetaValueType.Raw) {
    return parseRaw(jsonValue, member.def);
  }

  // Handle numbers.
  if (member.valueType() === kMetaValueType.Number) {
    return parseNumber(jsonValue, member.def, declGroup);
  }

  // Handle structs.
  if (member.valueType() === kMetaValueType.Struct) {
    var st = new LevelValueStruct(member.def);
    if (jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)) {
      for (var [smName, smDef] of member.def.members) {
        var sv = parse(jsonValue[smName], smDef, declGroup);
        st.setValue(smName, sv);
      }
    }
    return st;
  }

  // Handle class (inline class).
  if (member.valueType() === kMetaValueType.Class) {
    return parseClass(jsonValue, member.def, declGroup);
  }

  throw kObjectExceptions.InvalidValueFormat.from(String(jsonValue),
    member.def.getName());
}

/**
 * Parse a number value from JSON with B$/K$ prefix support.
 */
function parseNumber(jsonValue, def, declGroup) {
  var size = def.getSize();
  var isBool = def.getName() === "bool";

  if (isBool) {
    var b = new LevelValueBool(def);
    b.setValue(!!jsonValue);
    return b;
  }

  var num;
  if (typeof jsonValue === "number" || typeof jsonValue === "bigint") {
    num = jsonValue;
  } else if (typeof jsonValue === "string") {
    var s = jsonValue.trim();

    // B$ prefix — hex binary, big-endian value representation.
    if (s.startsWith("B$")) {
      var hex = s.slice(2);
      var buf = Buffer.from(hex, "hex");
      buf = rightAlign(buf, size);
      // Read as big-endian, since hex represents the numeric value
      // with most-significant bytes first.
      num = readIntFromBufferBE(buf, size);
    }
    // K$ prefix — enum constant.
    else if (s.startsWith("K$")) {
      var constName = s.slice(2);
      if (!declGroup.enumConstants.has(constName))
        throw kObjectExceptions.UnresolvedEnumConstant.from(constName);
      num = declGroup.enumConstants.get(constName);
    }
    // Plain numeric string.
    else {
      if (size <= 4)
        num = parseInt(s, 10);
      else
        num = BigInt(s);
      if (isNaN(num))
        num = size <= 4 ? 0 : 0n;
    }
  } else {
    num = 0;
  }

  var r = new LevelValueNumber(def);
  r.setValue(num);
  return r;
}

/**
 * Parse a raw value from JSON with suffix support.
 */
function parseRaw(jsonValue, def) {
  var targetSize = def.getSize();
  var r = new LevelValueRaw(def);

  if (Buffer.isBuffer(jsonValue)) {
    r.setValue(rightAlign(jsonValue, targetSize));
    return r;
  }

  if (typeof jsonValue !== "string") {
    r.setValue(Buffer.alloc(targetSize));
    return r;
  }

  var s = jsonValue.trim();

  // B$ prefix.
  if (s.startsWith("B$")) {
    var hex = s.slice(2);
    var buf = Buffer.from(hex, "hex");
    r.setValue(rightAlign(buf, targetSize));
    return r;
  }

  // Suffix-based parsing.
  var numericStr;
  var buf;

  if (s.endsWith("ul")) {
    numericStr = s.slice(0, -2).trim();
    var u64 = BigInt(numericStr);
    buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(u64);
  } else if (s.endsWith("l")) {
    numericStr = s.slice(0, -1).trim();
    var i64 = BigInt(numericStr);
    buf = Buffer.alloc(8);
    buf.writeBigInt64LE(i64);
  } else if (s.endsWith("u")) {
    numericStr = s.slice(0, -1).trim();
    var u32 = parseInt(numericStr, 10) >>> 0;
    buf = Buffer.alloc(4);
    buf.writeUInt32LE(u32);
  } else if (s.endsWith("i")) {
    numericStr = s.slice(0, -1).trim();
    var i32 = parseInt(numericStr, 10) | 0;
    buf = Buffer.alloc(4);
    buf.writeInt32LE(i32);
  } else if (s.endsWith("f")) {
    numericStr = s.slice(0, -1).trim();
    var f = parseFloat(numericStr);
    buf = Buffer.alloc(4);
    buf.writeFloatLE(f);
  } else if (s.endsWith("d")) {
    numericStr = s.slice(0, -1).trim();
    var d = parseFloat(numericStr);
    buf = Buffer.alloc(8);
    buf.writeDoubleLE(d);
  } else {
    // Treat as hex string.
    buf = Buffer.from(s, "hex");
  }

  r.setValue(rightAlign(buf, targetSize));
  return r;
}

/**
 * Parse a JSON object into a LevelValueClass (for inline class members).
 */
function parseClass(jsonValue, classDef, declGroup) {
  var lvc = new LevelValueClass(classDef, "");

  if (jsonValue && typeof jsonValue === "object" && !Array.isArray(jsonValue)) {
    for (var [memberName, member] of classDef.allMembers()) {
      var val = jsonValue[memberName];
      if (val !== void 0) {
        var lv = parse(val, member, declGroup);
        lvc.setValue(memberName, lv);
      }
    }
  }

  lvc.finalize();
  return lvc;
}

/**
 * Right-align a buffer to targetSize bytes.
 * Pads with zeros on the LEFT (MSB), truncates from the LEFT.
 */
function rightAlign(buf, targetSize) {
  if (buf.length === targetSize)
    return buf;
  if (buf.length < targetSize) {
    var padding = Buffer.alloc(targetSize - buf.length);
    return Buffer.concat([padding, buf]);
  }
  // Truncate from the left.
  return buf.subarray(buf.length - targetSize);
}

/**
 * Read an integer from a buffer based on its size.
 */
function readIntFromBuffer(buf, size) {
  switch (size) {
    case 1: return buf.readUInt8(0);
    case 2: return buf.readUInt16LE(0);
    case 4: return buf.readInt32LE(0);
    case 8: return buf.readBigInt64LE(0);
    default: return buf.readUInt32LE(0);
  }
}

function readIntFromBufferBE(buf, size) {
  switch (size) {
    case 1: return buf.readUInt8(0);
    case 2: return buf.readUInt16BE(0);
    case 4: return buf.readInt32BE(0);
    case 8: return buf.readBigInt64BE(0);
    default: return buf.readUInt32BE(0);
  }
}

module.exports = {
  parse,
  parseRaw,
  parseNumber,
  parseClass,
  rightAlign,
};
