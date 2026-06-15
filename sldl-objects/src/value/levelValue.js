class LevelValue {
  constructor(def) {
    /** @type {MetaType} */
    this.def = def;
    this.value = void 0;
  }

  /**
   * Byte size of a stored member entry, which may be a single value or an
   * array of values. Arrays are prefixed by a 4-byte count on disk.
   * @param {LevelValue|LevelValue[]} entry
   * @returns {number}
   */
  static sizeOf(entry) {
    if (!Array.isArray(entry))
      return entry.getSize();
    var size = 4;
    for (var i = 0; i < entry.length; i++)
      size += entry[i].getSize();
    return size;
  }

  /**
   * Get the type definition.
   * @returns {MetaType}
   */
  getDef() {
    return this.def;
  }

  /**
   * Get the size of the value.
   * @returns {number}
   */
  getSize() {
    return this.def.getSize();
  }

  /**
   * Get the alignment of the value.
   * @returns {number}
   */
  getAlign() {
    return this.def.getAlign();
  }

  /**
   * Get the value.
   * @returns {any}
   */
  getValue() {
    return this.value;
  }

  /**
   * Set the value of the instance.
   * @param {any} value
   */
  setValue(value) {
    this.value = value;
  }

  /**
   * Get the value type.
   * @returns {number}
   */
  valueType() {
    return this.def.valueType();
  }
}

module.exports = {
  LevelValue
};
