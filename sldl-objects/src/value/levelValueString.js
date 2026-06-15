const { Buffer } = require("buffer");
const { LevelValue } = require("./levelValue.js");

class LevelValueString extends LevelValue {
  constructor(def) {
    super(def);
    // Raw on-disk bytes of the string content, excluding the null
    // terminator. Preserved on read so that the consumed and written byte
    // count matches the file exactly, even when the bytes are not valid
    // UTF-8. Decoding to a JS string and re-encoding is not byte-stable
    // (an invalid byte becomes U+FFFD, a 3-byte sequence), which would
    // corrupt cursor advancement during reads. See tgcl.js readCString.
    this.raw = void 0;
  }

  getSize() {
    if (Buffer.isBuffer(this.raw))
      return this.raw.length + 1;
    return typeof this.value === "string"
      ? Buffer.from(this.value).length + 1
      : 1;
  }

  getValue() {
    return typeof this.value === "string"
      ? this.value
      : "";
  }

  // Set from a decoded string. Drops any preserved raw bytes.
  setValue(value) {
    this.value = value;
    this.raw = void 0;
  }

  /**
   * Set from raw on-disk bytes, excluding the terminator. Stores the bytes
   * verbatim and exposes a decoded view through getValue().
   * @param {Buffer} bytes
   */
  setRaw(bytes) {
    this.raw = bytes;
    this.value = bytes.toString("utf8");
  }

  // Bytes to serialize, excluding the terminator.
  getBytes() {
    if (Buffer.isBuffer(this.raw))
      return this.raw;
    return Buffer.from(typeof this.value === "string" ? this.value : "");
  }
}

module.exports = {
  LevelValueString
};
