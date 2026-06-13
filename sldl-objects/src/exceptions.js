const { SimpleExceptionBuilder, DynamicExceptionBuilder } = require("sldl-utils");

const kObjectExceptions = Object.freeze({
  // Read errors.
  HeaderMagicMismatch: new DynamicExceptionBuilder(function (uint32) {
    return `invalid magic 0x${uint32.toString(16).padStart(8, "0")}, expected 0x4c434754`;
  }),
  MemvarOutOfBound: new SimpleExceptionBuilder("memvar access out of bounds"),
  ReadObjectFailed: new SimpleExceptionBuilder("read object failed"),
  InvalidClassName: new DynamicExceptionBuilder(function (name) {
    return `unrecognized class name: ${name}`;
  }),
  MultipleObjectName: new DynamicExceptionBuilder(function (name) {
    return `multiple object name: ${name}`;
  }),
  MultipleClassName: new DynamicExceptionBuilder(function (name) {
    return `multiple class name: ${name}`;
  }),
  MemberMismatch: new DynamicExceptionBuilder(function (clazz, name) {
    return `"member mismatch: ${clazz}${(name ? "::" + name : "")}`;
  }),
  InvalidClassIndex: new DynamicExceptionBuilder(function (idx) {
    return `unrecognized class index: ${idx}`;
  }),
  InvalidObjectIndex: new DynamicExceptionBuilder(function (idx) {
    return `invalid object index: ${idx}`;
  }),
  InvalidObjectName: new DynamicExceptionBuilder(function (name) {
    return `unrecognized object name: ${name}`;
  }),

  // Write errors.
  UndeclaredSymbol: new DynamicExceptionBuilder(function (name) {
    return `symbol "${name}" is not declared in the declaration group`;
  }),
});

module.exports = {
  kObjectExceptions
};
