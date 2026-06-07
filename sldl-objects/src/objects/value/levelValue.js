class LevelValue {
  constructor(def) {
    /** @type {LevelType} */
    this.def = def;
    this.value = void 0;
  }

  getSize() {
    return this.def.getSize();
  }

  getValue() {
    return this.value;
  }

  setValue(value) {
    this.value = value;
  }

  isNumber() {
    return this.def.isNumber();
  }

  isString() {
    return this.def.isString();
  }

  isClass() {
    return this.def.isClass();
  }
}

module.exports = {
  LevelValue
};
