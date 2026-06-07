const { Buffer } = require("sldl-utils");
const { MetaType, kMetaValueType } = require("./metaType.js");
const { LevelValueBool, LevelValueNumber } = require("../value/levelValueNumber.js");

class MetaTypeBool extends MetaType {
  constructor(name) {
    super(name);
  }

  getSize() {
    return 1;
  }

  getAlign() {
    return 1;
  }

  valueType() {
    return kMetaValueType.Number;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValueBool}
   */
  read(B, off) {
    var r = new LevelValueBool(this);
    r.setValue(!!B.readUInt8(off));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueBool} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;
    B.writeUInt8(!!val.getValue(), off);
    return val.getSize();
  }
}

class MetaTypeNumber extends MetaType {
  /**
   * @param {string} name 
   * @param {number} size 
   * @param {(off:number)=>any} reader 
   * @param {(val:any, off:number)=>void} writer 
   */
  constructor(name, size, reader, writer) {
    super(name);
    this.size = size;
    this.reader = reader;
    this.writer = writer;
  }

  getSize() {
    return this.size;
  }

  getAlign() {
    return this.size;
  }

  valueType() {
    return kMetaValueType.Number;
  }

  /**
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValueNumber}
   */
  read(B, off) {
    var r = new LevelValueNumber(this);
    r.setValue(this.reader.call(B, off));
    return r;
  }

  /**
   * @param {Buffer} B 
   * @param {LevelValueNumber} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    if (val.def != this)
      return 0;
    this.writer.call(B, val.getValue(), off);
    return val.getSize();
  }
}

const kTypeNumber = Object.freeze({
  // Boolean.
  Bool: new MetaTypeBool("bool"),

  // Integer.
  Int8: new MetaTypeNumber("int8_t", 1, Buffer.prototype.readInt8, Buffer.prototype.writeInt8),
  Uint8: new MetaTypeNumber("uint8_t", 1, Buffer.prototype.readUint8, Buffer.prototype.writeUint8),
  Int16: new MetaTypeNumber("int16_t", 2, Buffer.prototype.readInt16LE, Buffer.prototype.writeInt16LE),
  Uint16: new MetaTypeNumber("uint16_t", 2, Buffer.prototype.readUint16LE, Buffer.prototype.writeUint16LE),
  Int32: new MetaTypeNumber("int32_t", 4, Buffer.prototype.readInt32LE, Buffer.prototype.writeInt32LE),
  Uint32: new MetaTypeNumber("uint32_t", 4, Buffer.prototype.readUint32LE, Buffer.prototype.writeUint32LE),
  Int64: new MetaTypeNumber("int64_t", 8, Buffer.prototype.readBigInt64LE, Buffer.prototype.writeBigInt64LE),
  Uint64: new MetaTypeNumber("uint64_t", 8, Buffer.prototype.readBigUInt64LE, Buffer.prototype.writeBigUInt64LE),

  // Float.
  Float: new MetaTypeNumber("float", 4, Buffer.prototype.readFloatLE, Buffer.prototype.writeFloatLE),
  Double: new MetaTypeNumber("double", 8, Buffer.prototype.readDoubleLE, Buffer.prototype.writeDoubleLE),

  // Pointer.
  Pointer: new MetaTypeNumber("pointer", 4, Buffer.prototype.readInt32LE, Buffer.prototype.writeInt32LE),
});

module.exports = {
  MetaTypeBool,
  MetaTypeNumber,
  kTypeNumber
};
