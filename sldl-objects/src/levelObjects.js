var { Buffer } = require("buffer");
var { kObjectExceptions } = require("./exceptions.js");
var { kMetaTypes } = require("./types.js");
var { kMetaValueType, MetaType } = require("./type/metaType.js");
var { MetaTypeClass } = require("./type/metaTypeClass.js");
var { MetaTypePointer } = require("./type/metaTypePointer.js");
var { MetaTypeRaw } = require("./type/metaTypeRaw.js");
var { LevelValue } = require("./value/levelValue.js");
var { LevelValueClass } = require("./value/levelValueClass.js");
var { LevelValuePointer } = require("./value/levelValuePointer.js");
var { LevelValueString } = require("./value/levelValueString.js");
var { LevelValueNumber } = require("./value/levelValueNumber.js");
var { LevelValueRaw } = require("./value/levelValueRaw.js");
var { DeclarationGroup } = require("./declGroup.js");
var jsonValue = require("./jsonValue.js");

// Install natively missing helpers on Buffer.
if (typeof Buffer.prototype.readStringZero !== "function") {
  Buffer.prototype.readStringZero = function (offset, encoding) {
    offset >>>= 0;
    if (offset >= this.length) return "";
    var begin = offset, end = begin;
    while (end < this.length && this[end]) end++;
    return begin < end ? this.toString(encoding, begin, end) : "";
  };
}
if (typeof Buffer.prototype.writeStringZero !== "function") {
  Buffer.prototype.writeStringZero = function (string, offset, encoding) {
    var bytes = Buffer.from(string);
    offset >>>= 0;
    this.set(bytes, offset);
  };
}

// --- Memvar Types ------------------------------------------------------------

var kMemvarTypes = Object.freeze({
  Raw: 0,
  String: 1,
  Ref: 2,
  Array: 3
});

// --- LoHeader ----------------------------------------------------------------

class LoHeader {
  constructor() {
    this.magic = "TGCL";
    this.version = 1;
    this.numClasses = 0;
    this.numMemVars = 0;
    this.numObjects = 0;
    this.numRefs = 0;
    this.classesOffset = 0;
    this.memvarsOffset = 0;
    this.stringsOffset = 0;
    this.objectsOffset = 0;
    this.fileSize = 0;
  }

  initialize() {
    this.magic = "TGCL";
    this.version = 1;
    this.numClasses = 0;
    this.numMemVars = 0;
    this.numObjects = 0;
    this.numRefs = 0;
    this.classesOffset = 0;
    this.memvarsOffset = 0;
    this.stringsOffset = 0;
    this.objectsOffset = 0;
    this.fileSize = 0;
  }

  /**
   * @param {Buffer} B
   * @returns {this}
   */
  read(B) {
    var magic = B.slice(0, 4).toString("ascii");
    if (magic !== "TGCL")
      throw new Error("invalid magic: 0x"
        + B.readUInt32LE(0).toString(16).padStart(8, "0")
        + ", expected \"TGCL\"");

    this.version = B.readUInt32LE(4);
    this.numClasses = B.readUInt32LE(8);
    this.numMemVars = B.readUInt32LE(12);
    this.numObjects = B.readUInt32LE(16);
    this.numRefs = B.readUInt32LE(20);
    this.classesOffset = B.readUInt32LE(24);
    this.memvarsOffset = B.readUInt32LE(28);
    this.stringsOffset = B.readUInt32LE(32);
    this.objectsOffset = B.readUInt32LE(36);
    this.fileSize = B.readUInt32LE(40);

    return this;
  }

  /**
   * @returns {Buffer}
   */
  write() {
    var r = Buffer.allocUnsafe(44);
    r.write(this.magic, 0, 4, "ascii");
    r.writeUInt32LE(this.version, 4);
    r.writeUInt32LE(this.numClasses, 8);
    r.writeUInt32LE(this.numMemVars, 12);
    r.writeUInt32LE(this.numObjects, 16);
    r.writeUInt32LE(this.numRefs, 20);
    r.writeUInt32LE(this.classesOffset, 24);
    r.writeUInt32LE(this.memvarsOffset, 28);
    r.writeUInt32LE(this.stringsOffset, 32);
    r.writeUInt32LE(this.objectsOffset, 36);
    r.writeUInt32LE(this.fileSize, 40);
    return r;
  }
}

// --- LoStringPool ------------------------------------------------------------

class LoStringPool {
  static read(B, offset) {
    return B.readStringZero(offset);
  }

  constructor() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    /** @type {Map<string, number>} */
    this.strings = new Map();
  }

  initialize() {
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(128);
    this.strings.clear();
  }

  /**
   * @param {string} s
   * @returns {number} Byte offset of this string in the pool.
   */
  set(s) {
    if (typeof s !== "string")
      return -1;

    if (this.strings.has(s))
      return this.strings.get(s);

    var bytes = Buffer.from(s + "\0");
    if (this.cursor + bytes.length > this.buffer.length) {
      var newed = Buffer.allocUnsafe(this.buffer.length << 1);
      newed.set(this.buffer);
      this.buffer = newed;
    }

    var r = this.cursor;
    this.buffer.set(bytes, r);
    this.cursor += bytes.byteLength;
    this.strings.set(s, r);

    return r;
  }

  /**
   * @returns {Buffer}
   */
  write() {
    return Buffer.from(this.buffer.subarray(0, this.cursor));
  }
}

// --- LoMemvar ----------------------------------------------------------------

class LoMemvar {
  constructor(type, name, size, aux) {
    this.type = type;
    this.name = name;
    this.size = size;
    this.aux = aux;
  }
}

// --- LoClass -----------------------------------------------------------------

class LoClass {
  constructor(name) {
    this.name = name;
    /** @type {Map<string, LoMemvar>} */
    this.raw = new Map();
    this.def = void 0;
    this.firstMemvar = 0;
  }

  addMemvar(memvar) {
    this.raw.set(memvar.name, memvar);
  }

  /**
   * @param {MetaTypeClass} def
   */
  setDef(def) {
    this.def = def;
  }
}

// --- LoIndices ---------------------------------------------------------------

class LoIndices {
  constructor() {
    /** @type {LoClass[]} */
    this.classes = [];
    /** @type {LoMemvar[]} */
    this.memvars = [];
    /** @type {LevelValueClass[]} */
    this.objects = [];
    /** @type {LevelValuePointer[]} */
    this.pointers = [];

    /** @type {Map<string, MetaType>} */
    this.metaTypes = new Map();
    /** @type {Map<string, MetaTypeClass>} */
    this.metaClasses = new Map();
    /** @type {Map<string, number>} */
    this.classIndices = new Map();
    /** @type {Map<string, number>} */
    this.objectIndices = new Map();
  }

  clear() {
    this.classes = [];
    this.memvars = [];
    this.objects = [];
    this.pointers = [];

    this.classIndices.clear();
    this.objectIndices.clear();
  }

  /**
   * @param {MetaType[]} definitions
   */
  define(definitions) {
    this.metaTypes.clear();
    this.metaClasses.clear();
    for (var def of definitions) {
      this.metaTypes.set(def.getName(), def);
      if (def instanceof MetaTypeClass)
        this.metaClasses.set(def.getName(), def);
    }
  }

  getClassFromName(name) {
    return this.metaTypes.get(name);
  }

  getClassIdx(name) {
    var idx = this.classIndices.get(name);
    if (typeof idx === "undefined")
      return -1;
    return idx;
  }

  getObjectIdx(name) {
    var idx = this.objectIndices.get(name);
    if (idx === undefined)
      throw kObjectExceptions.InvalidObjectIndex.from(name);
    return idx;
  }

  /**
   * @param {number} type
   * @param {string} name
   * @param {number} size
   * @param {number} aux
   * @returns {LoMemvar}
   */
  addMemvarFromBlob(type, name, size, aux) {
    var m = new LoMemvar(type, name, size, aux);
    this.memvars.push(m);
    return m;
  }

  /**
   * @param {string} name
   * @param {number} firstMemvar
   * @param {number} numMemvars
   * @returns {LoClass}
   */
  addClassFromBlob(name, firstMemvar, numMemvars) {
    var c = new LoClass(name);
    for (var i = 0; i < numMemvars; i++) {
      var m = this.memvars[firstMemvar + i];
      if (!m)
        throw kObjectExceptions.MemvarOutOfBound.from();
      c.addMemvar(m);
    }

    if (this.classIndices.has(name))
      throw kObjectExceptions.MultipleClassName.from(name);

    this.classIndices.set(name, this.classes.length);
    this.classes.push(c);
    return c;
  }

  /**
   * @param {LevelValueClass} obj
   * @returns {LevelValueClass}
   */
  addObject(obj) {
    var name = obj.getName();
    if (this.objectIndices.has(name))
      throw kObjectExceptions.MultipleObjectName.from(name);

    this.objectIndices.set(obj.getName(), this.objects.length);
    this.objects.push(obj);
    return obj;
  }

  /**
   * Add a class from a MetaTypeClass definition, creating LoMemvar entries.
   * @param {MetaTypeClass} def
   * @param {Set<string>} [usedMembers] — only create memvars for used members.
   * @returns {LoClass}
   */
  addClassFromDef(def, usedMembers) {
    var name = def.getName();

    if (this.classIndices.has(name))
      return this.classes[this.classIndices.get(name)];

    this.classIndices.set(name, this.classes.length);

    var c = new LoClass(name);
    this.classes.push(c);

    // Recursively ensure inline class types are registered first.
    for (var [memberName, member] of def.allMembers(usedMembers)) {
      if (member instanceof require("./type/metaTypeClass.js").MetaTypeClassMemberArray
        && member.def instanceof MetaTypeClass) {
        this.addClassFromDef(member.def, void 0);
      }
    }

    // Create memvar entries for used members.
    var memberList = def.allMembers(usedMembers);
    for (var i = 0; i < memberList.length; i++) {
      var memberName = memberList[i][0]
        , member = memberList[i][1]
        , type, size, aux;

      var MetaTypeClassMemberArray = require("./type/metaTypeClass.js").MetaTypeClassMemberArray;

      if (member instanceof MetaTypeClassMemberArray) {
        type = kMemvarTypes.Array;
        if (member.def instanceof MetaTypeClass) {
          size = 0;
          aux = this.classIndices.get(member.def.getName());
        } else if (member.valueType() == kMetaValueType.Pointer) {
          size = member.getSize ? member.getSize() : 4;
          aux = 0xFFFFFFFF;
        } else {
          size = member.def.getSize();
          aux = member.maxCount;
        }
      } else if (member.valueType() == kMetaValueType.Pointer) {
        type = kMemvarTypes.Ref;
        size = 0;
        aux = 0;
      } else if (member.valueType() == kMetaValueType.String) {
        type = kMemvarTypes.String;
        size = 0;
        aux = 0;
      } else {
        type = kMemvarTypes.Raw;
        size = member.getSize();
        aux = 0;
      }

      var m = new LoMemvar(type, memberName, size, aux);
      this.memvars.push(m);
      c.addMemvar(m);
    }

    this.metaClasses.set(name, def);
    return c;
  }
}

// --- LevelObjects ------------------------------------------------------------

class LevelObjects {
  /**
   * Read a TGCL binary buffer and produce JSON objects.
   * @param {Buffer} buffer
   * @param {Object} [declGroup] — optional JSON declaration group.
   * @returns {{ objects: Object, declGroup: Object }}
   */
  static read(buffer, declGroup) {
    var header = new LoHeader().read(buffer);

    var indices = new LoIndices();

    // -- Read memvars ------------------------------------------------
    for (var i = 0; i < header.numMemVars; i++) {
      var off = header.memvarsOffset + i * 16;
      indices.addMemvarFromBlob(
        buffer.readUInt32LE(off),
        LoStringPool.read(buffer, header.stringsOffset + buffer.readUInt32LE(off + 4)),
        buffer.readUInt32LE(off + 8),
        buffer.readUInt32LE(off + 12)
      );
    }

    // -- Read classes ------------------------------------------------
    for (var i = 0; i < header.numClasses; i++) {
      var off = header.classesOffset + i * 12;
      indices.addClassFromBlob(
        LoStringPool.read(buffer, header.stringsOffset + buffer.readUInt32LE(off)),
        buffer.readUInt32LE(off + 4),
        buffer.readUInt32LE(off + 8)
      );
    }

    // -- Prepare definitions -----------------------------------------
    var clonedDecl = declGroup
      ? JSON.parse(JSON.stringify(declGroup))
      : {};

    var dg = new DeclarationGroup(clonedDecl).parse();

    // Register definitions.
    var defs = [];
    for (var [name, type] of dg.types)
      defs.push(type);
    // Ensure built-in types are included.
    for (var key of Object.keys(kMetaTypes))
      if (!dg.types.has(key))
        defs.push(kMetaTypes[key]);

    indices.define(defs);

    // -- Match classes — auto-create unknown ones --------------------
    for (var j = 0; j < indices.classes.length; j++) {
      var c = indices.classes[j];
      var def = dg.classes.get(c.name);

      if (!def) {
        // Auto-create class in decl group.
        def = new MetaTypeClass(c.name, kMetaTypes.Object);
        def.isAutoCreated = true;

        for (var [memName, memvar] of c.raw) {
          // Add as raw or appropriate type.
          if (memvar.type === kMemvarTypes.Raw) {
            def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
          } else if (memvar.type === kMemvarTypes.String) {
            def.addMember(kMetaTypes.CString, memName);
          } else if (memvar.type === kMemvarTypes.Ref) {
            def.addMember(kMetaTypes.Pointer, memName);
          } else if (memvar.type === kMemvarTypes.Array) {
            if (memvar.aux === 0xFFFFFFFF)
              def.addMember(kMetaTypes.Pointer, memName, 0);
            else if (memvar.aux >= 0 && memvar.aux < indices.classes.length) {
              var elemDef2 = indices.classes[memvar.aux].def;
              def.addMember(elemDef2, memName, 0);
            } else
              def.addMember(kMetaTypes.Pointer, memName, 0);
          } else {
            def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
          }
        }

        dg.classes.set(c.name, def);
        dg.types.set(c.name, def);
        indices.metaTypes.set(c.name, def);
        indices.metaClasses.set(c.name, def);

        // Add to cloned decl group JSON.
        var classJson = { $parent: "Object" };
        for (var [memName, memvar] of c.raw) {
          if (memvar.type === kMemvarTypes.Raw)
            classJson[memName] = "R$" + (memvar.size || 4);
          else if (memvar.type === kMemvarTypes.String)
            classJson[memName] = "cstring";
          else if (memvar.type === kMemvarTypes.Ref)
            classJson[memName] = "Object *";
          else if (memvar.type === kMemvarTypes.Array) {
            if (memvar.aux === 0xFFFFFFFF)
              classJson[memName] = "Object *[]";
            else if (memvar.aux >= 0 && memvar.aux < indices.classes.length)
              classJson[memName] = indices.classes[memvar.aux].name + " []";
            else
              classJson[memName] = "Object *[]";
          }
        }
        clonedDecl["C$" + c.name] = classJson;
      } else {
        // Check for unknown members and add to definition.
        for (var [memName, memvar] of c.raw) {
          if (!def.getMember(memName)) {
            if (memvar.type === kMemvarTypes.Raw)
              def.addMember(new MetaTypeRaw(c.name + "::" + memName, memvar.size || 4), memName);
            else if (memvar.type === kMemvarTypes.String)
              def.addMember(kMetaTypes.CString, memName);
            else if (memvar.type === kMemvarTypes.Ref)
              def.addMember(kMetaTypes.Pointer, memName);
            else if (memvar.type === kMemvarTypes.Array) {
              if (memvar.aux === 0xFFFFFFFF)
                def.addMember(kMetaTypes.Pointer, memName, 0);
              else if (memvar.aux >= 0 && memvar.aux < indices.classes.length) {
                var elemDef = indices.classes[memvar.aux].def;
                def.addMember(elemDef, memName, 0);
              } else
                def.addMember(kMetaTypes.Pointer, memName, 0);
            } else
              def.addMember(new MetaTypeRaw(c.name + "::" + memName, 4), memName);

            // Update JSON decl group.
            var classJson = clonedDecl["C$" + c.name];
            if (classJson && typeof classJson === "object") {
              if (memvar.type === kMemvarTypes.Raw)
                classJson[memName] = "R$" + (memvar.size || 4);
              else if (memvar.type === kMemvarTypes.String)
                classJson[memName] = "cstring";
              else if (memvar.type === kMemvarTypes.Ref)
                classJson[memName] = "Object *";
              else if (memvar.type === kMemvarTypes.Array) {
                if (memvar.aux === 0xFFFFFFFF)
                  classJson[memName] = "Object *[]";
                else if (memvar.aux >= 0 && memvar.aux < indices.classes.length)
                  classJson[memName] = indices.classes[memvar.aux].name + " []";
                else
                  classJson[memName] = "Object *[]";
              }
            }
          }
        }
      }

      c.setDef(def);
    }

    // -- Read objects ------------------------------------------------
    var cursor = header.objectsOffset;
    for (var k = 0; k < header.numObjects && cursor < header.fileSize; k++) {
      var classIdx = buffer.readUInt32LE(cursor)
        , name = buffer.readStringZero(cursor + 4);
      if (classIdx >= indices.classes.length || classIdx < 0)
        throw kObjectExceptions.InvalidClassIndex.from(classIdx);

      cursor += 4 + Buffer.from(name).length + 1;

      var raw = indices.classes[classIdx];
      if (!raw)
        throw kObjectExceptions.InvalidClassIndex.from(classIdx);

      var objDef = raw.def;
      var obj, objSize;

      // Use raw memvar binary reading when no proper definition is available
      // (auto-created classes have generic types that may not match arrays etc.)
      if (objDef && objDef.isAutoCreated) {
        var rawResult = LevelObjects.readRawMembers(indices, buffer, cursor, raw, objDef, name);
        obj = rawResult.obj;
        objSize = rawResult.size;
      } else {
        obj = objDef.read(indices, buffer, cursor, raw);
        objSize = obj.getSize();
      }

      if (!obj || typeof name !== "string")
        throw kObjectExceptions.ReadObjectFailed.from();

      obj.name = name;
      indices.objects.push(obj);

      cursor += objSize;
    }

    // -- Backpatch pointers ------------------------------------------
    for (var pi = 0; pi < indices.pointers.length; pi++)
      indices.pointers[pi].backpatch(indices);

    // -- Convert to JSON ---------------------------------------------
    var resultObjects = {};
    for (var oi = 0; oi < indices.objects.length; oi++) {
      var obj2 = indices.objects[oi];
      var jsonObj = obj2.toJSON(new DeclarationGroup(clonedDecl));
      jsonObj.$type = obj2.getDef().getName();
      resultObjects["O$" + obj2.getName()] = jsonObj;
    }

    return { objects: resultObjects, declGroup: clonedDecl };
  }

  /**
   * Write JSON objects to a TGCL binary buffer.
   * @param {Object} objects — plain objects with "O$name" keys.
   * @param {Object} declGroup — JSON declaration group.
   * @returns {Buffer}
   */
  static write(objects, declGroup) {
    // -- Parse declaration group -------------------------------------
    var dg = new DeclarationGroup(declGroup).parse();

    // -- Register definitions in indices -----------------------------
    var indices = new LoIndices();
    var defs = [];
    for (var [name, type] of dg.types)
      defs.push(type);
    for (var key of Object.keys(kMetaTypes))
      if (!dg.types.has(key))
        defs.push(kMetaTypes[key]);
    indices.define(defs);

    // -- Analyze member usage (pruning) -----------------------------
    /** @type {Map<string, Set<string>>} */
    var usedMembers = new Map();
    /** @type {Array<{name: string, json: Object}>} */
    var objEntries = [];

    for (var objKey of Object.keys(objects)) {
      if (!objKey.startsWith("O$"))
        continue;

      var objName = objKey.slice(2);
      var objData = objects[objKey];
      if (!objData || typeof objData !== "object")
        throw kObjectExceptions.ReadObjectFailed.from();

      var className = objData.$type;
      if (typeof className !== "string")
        throw kObjectExceptions.InvalidClassName.from(String(className));

      var classDef = dg.classes.get(className);
      if (!classDef)
        throw kObjectExceptions.InvalidClassName.from(className);

      if (!usedMembers.has(className))
        usedMembers.set(className, new Set());
      var memberSet = usedMembers.get(className);

      for (var memberKey of Object.keys(objData)) {
        if (memberKey.startsWith("$"))
          continue;
        memberSet.add(memberKey);
      }

      objEntries.push({ name: objName, json: objData, def: classDef });
    }

    // -- Register classes (with pruning) -----------------------------
    for (var [className, classDef] of dg.classes) {
      var um = usedMembers.get(className);
      indices.addClassFromDef(classDef, um);
    }

    // -- Build strings pool ------------------------------------------
    var strings = new LoStringPool();

    // -- Convert JSON objects to LevelValueClass ---------------------
    for (var ei = 0; ei < objEntries.length; ei++) {
      var entry = objEntries[ei]
        , jsonObj = entry.json
        , classDef = entry.def;

      var lvc = new LevelValueClass(classDef, entry.name);

      var um = usedMembers.get(classDef.getName());
      var allMembers = classDef.allMembers(um);

      for (var mi = 0; mi < allMembers.length; mi++) {
        var memberName = allMembers[mi][0]
          , member = allMembers[mi][1]
          , jv = jsonObj[memberName];

        var lv;
        if (jv !== void 0) {
          lv = jsonValue.parse(jv, member, dg);
        } else {
          // Apply default from $default or type default.
          var defaultVal = void 0;
          try {
            var classRaw = declGroup["C$" + classDef.getName()];
            if (classRaw && classRaw.$default && classRaw.$default[memberName] !== void 0)
              defaultVal = classRaw.$default[memberName];
          } catch (e) { /* ignore */ }

          if (defaultVal !== void 0) {
            lv = jsonValue.parse(defaultVal, member, dg);
          } else {
            lv = MetaTypeClass.memberTypeDefault(member);
          }
        }

        lvc.setValue(memberName, lv);
      }

      lvc.finalize();
      indices.addObject(lvc);
    }

    // -- Collect and resolve pointers --------------------------------
    for (var oi2 = 0; oi2 < indices.objects.length; oi2++) {
      var obj3 = indices.objects[oi2];
      for (var [mname, mval] of obj3.value) {
        var memb = obj3.getDef().getMember(mname);
        if (!memb || memb.valueType() !== kMetaValueType.Pointer)
          continue;

        var ptrs = Array.isArray(mval) ? mval : [mval];
        for (var pi2 = 0; pi2 < ptrs.length; pi2++) {
          var p = ptrs[pi2];
          if (p instanceof LevelValuePointer)
            indices.pointers.push(p);
        }
      }
    }

    // Resolve P$ names to indices.
    for (var qi = 0; qi < indices.pointers.length; qi++) {
      var q = indices.pointers[qi];
      if (q.targetName !== null && q.targetName !== void 0) {
        var targetIdx = indices.objectIndices.get(q.targetName);
        if (targetIdx === void 0)
          throw kObjectExceptions.UnresolvedObjectReference.from(q.targetName);
        q.setIndex(targetIdx);
      }
    }

    // -- Write memvar buffer -----------------------------------------
    var memvarBuf = Buffer.allocUnsafe(indices.memvars.length * 16);
    for (var mi2 = 0; mi2 < indices.memvars.length; mi2++) {
      var m = indices.memvars[mi2]
        , mOff = mi2 * 16;
      memvarBuf.writeUInt32LE(m.type, mOff);
      memvarBuf.writeUInt32LE(strings.set(m.name), mOff + 4);
      memvarBuf.writeUInt32LE(m.size, mOff + 8);
      memvarBuf.writeUInt32LE(m.aux, mOff + 12);
    }

    // -- Write class buffer ------------------------------------------
    var classBuf = Buffer.allocUnsafe(indices.classes.length * 12);
    var firstMemvarAcc = 0;
    for (var ci = 0; ci < indices.classes.length; ci++) {
      var cc = indices.classes[ci]
        , cOff = ci * 12;
      classBuf.writeUInt32LE(strings.set(cc.name), cOff);
      classBuf.writeUInt32LE(firstMemvarAcc, cOff + 4);
      classBuf.writeUInt32LE(cc.raw.size, cOff + 8);
      firstMemvarAcc += cc.raw.size;
    }

    // -- Write string pool -------------------------------------------
    var stringBuf = strings.write();

    // -- Write objects -----------------------------------------------
    // First pass: calculate total object data size.
    var totalObjSize = 0;
    for (var oi3 = 0; oi3 < indices.objects.length; oi3++) {
      var o3 = indices.objects[oi3];
      totalObjSize += 4 + Buffer.from(o3.getName()).length + 1 + o3.getSize();
    }

    var objBuf = Buffer.allocUnsafe(totalObjSize)
      , objCursor = 0;
    for (var oi4 = 0; oi4 < indices.objects.length; oi4++) {
      var o4 = indices.objects[oi4];
      var cIdx = indices.getClassIdx(o4.getDef().getName());
      if (cIdx === -1)
        throw kObjectExceptions.InvalidClassName.from(o4.getDef().getName());

      objBuf.writeUInt32LE(cIdx, objCursor);
      objCursor += 4;

      var nameBuf = Buffer.from(o4.getName() + "\0");
      nameBuf.copy(objBuf, objCursor);
      objCursor += nameBuf.length;

      var um2 = usedMembers.get(o4.getDef().getName());
      var n = o4.getDef().write(indices, objBuf, o4, objCursor, um2);
      if (!n)
        throw kObjectExceptions.ReadObjectFailed.from();
      objCursor += n;
    }

    // -- Calculate offsets -------------------------------------------
    var headerSize = 44
      , classesOffset = headerSize
      , memvarsOffset = classesOffset + classBuf.length
      , stringsOffset = memvarsOffset + memvarBuf.length
      , objectsOffset = stringsOffset + stringBuf.length
      , fileSize = objectsOffset + objCursor;

    // -- Write header ------------------------------------------------
    var header = new LoHeader();
    header.initialize();
    header.numClasses = indices.classes.length;
    header.numMemVars = indices.memvars.length;
    header.numObjects = indices.objects.length;
    header.numRefs = indices.pointers.length;
    header.classesOffset = classesOffset;
    header.memvarsOffset = memvarsOffset;
    header.stringsOffset = stringsOffset;
    header.objectsOffset = objectsOffset;
    header.fileSize = fileSize;

    // -- Assemble final buffer ---------------------------------------
    var result = Buffer.allocUnsafe(fileSize);
    header.write().copy(result, 0);
    classBuf.copy(result, classesOffset);
    memvarBuf.copy(result, memvarsOffset);
    stringBuf.copy(result, stringsOffset);
    objBuf.copy(result, objectsOffset, 0, objCursor);

    return result;
  }

  /**
   * Read object member data using raw binary memvar information directly.
   * Used when no proper class definition is available (auto-created classes).
   * @param {LoIndices} L
   * @param {Buffer} B
   * @param {number} off
   * @param {LoClass} raw
   * @param {MetaTypeClass} def
   * @param {string} name
   * @returns {{ obj: LevelValueClass, size: number }}
   */
  static readRawMembers(L, B, off, raw, def, name) {
    var obj = new LevelValueClass(def, name)
      , cursor = off;

    for (var [memName, memvar] of raw.raw) {
      var v, size;

      if (memvar.type === kMemvarTypes.Raw) {
        // Raw bytes.
        size = memvar.size || 4;
        var rawType = new MetaTypeRaw(def.getName() + "::" + memName, size);
        v = rawType.read(L, B, cursor);
      } else if (memvar.type === kMemvarTypes.String) {
        // Nul-terminated string.
        v = kMetaTypes.CString.read(L, B, cursor);
        size = v.getSize();
      } else if (memvar.type === kMemvarTypes.Ref) {
        // Object reference (uint32).
        v = kMetaTypes.Pointer.read(L, B, cursor);
        size = 4;
      } else if (memvar.type === kMemvarTypes.Array) {
        // Array: count + elements.
        var count = B.readUInt32LE(cursor);
        var elemCursor = cursor + 4;
        var elemType = memvar.aux; // 0xFFFFFFFF = refs, other = class index

        if (elemType === 0xFFFFFFFF) {
          // Ref array — each element is a uint32 object_index.
          var elements = [];
          for (var ei = 0; ei < count; ei++) {
            var p = kMetaTypes.Pointer.read(L, B, elemCursor);
            elements.push(p);
            elemCursor += 4;
          }
          size = 4 + count * 4;
          v = elements;
        } else if (elemType >= 0 && elemType < L.classes.length) {
          // Inline sub-object array.
          var elements = [];
          var subRaw = L.classes[elemType];
          var subDef = subRaw.def;
          for (var ei = 0; ei < count; ei++) {
            var subResult;
            if (subDef && subDef.isAutoCreated) {
              subResult = LevelObjects.readRawMembers(L, B, elemCursor, subRaw, subDef, "");
            } else {
              var subObj = subDef.read(L, B, elemCursor, subRaw);
              subResult = { obj: subObj, size: subObj.getSize() };
            }
            elements.push(subResult.obj);
            elemCursor += subResult.size;
          }
          size = elemCursor - cursor;
          v = elements;
        } else {
          // Unknown array — read raw bytes per element.
          var elemSize = memvar.size || 4;
          size = 4 + count * elemSize;
          var rawArrType = new MetaTypeRaw(def.getName() + "::" + memName, size);
          v = rawArrType.read(L, B, cursor);
        }
      } else {
        // Fallback — raw bytes.
        size = memvar.size || 4;
        var rawType2 = new MetaTypeRaw(def.getName() + "::" + memName, size);
        v = rawType2.read(L, B, cursor);
      }

      if (!v)
        throw kObjectExceptions.ReadObjectFailed.from();

      // Collect pointers for backpatch.
      if (memvar.type === kMemvarTypes.Ref) {
        L.pointers.push(v);
      } else if (memvar.type === kMemvarTypes.Array && memvar.aux === 0xFFFFFFFF) {
        L.pointers.push.apply(L.pointers, v);
      }

      obj.setValue(memName, v);
      cursor += size;
    }

    obj.finalize();
    return { obj: obj, size: cursor - off };
  }
}

module.exports = {
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes
};
