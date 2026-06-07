class MetaType {
  constructor(name) {
    return this.name = name;
  }

  getSize() {
    return 0;
  }

  isNumber() {
    return false;
  }

  isString() {
    return false;
  }

  isClass() {
    return false;
  }

  /**
   * Read a LevelValue from the buffer.
   * @param {Buffer} B 
   * @param {number} off 
   * @returns {LevelValue}
   */
  read(B, off) {
    ;
  }

  /**
   * Write a LevelValue to the buffer.
   * @param {Buffer} B 
   * @param {LevelValue} val 
   * @param {number} off 
   * @returns {number} Number of bytes written.
   */
  write(B, val, off) {
    ;
  }
}

module.exports = {
  MetaType
};
