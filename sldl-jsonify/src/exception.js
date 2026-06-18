const { DynamicExceptionBuilder, SimpleExceptionBuilder } = require("sldl-utils");

const kJsonifyException = Object.freeze({
  // Declaration group errors.
  DuplicateTypeName: new DynamicExceptionBuilder(
    name => "duplicate type name \"" + name + "\""),
  DuplicateEnumConstant: new DynamicExceptionBuilder(
    name => "duplicate enum constant \"" + name + "\""),
  InvalidAliasTarget: new DynamicExceptionBuilder(
    (name, target) => "alias \"" + name + "\" cannot target \"" + target + "\""),
  UnresolvedTypeName: new DynamicExceptionBuilder(
    name => "unresolved type name \"" + name + "\""),
  CircularInheritance: new DynamicExceptionBuilder(
    name => "circular inheritance detected for \"" + name + "\""),
  InvalidMemberSyntax: new DynamicExceptionBuilder(
    expr => "invalid member syntax \"" + expr + "\""),
  InvalidEnumBaseType: new DynamicExceptionBuilder(
    (name, type) => "enum \"" + name + "\" has invalid base type \"" + type + "\""),

  // Value parsing errors.
  UnrecognizedType: new DynamicExceptionBuilder(
    clazz => "unrecognized type \"" + clazz + "\""),
  UnresolvedEnumConstant: new DynamicExceptionBuilder(
    name => "unresolved enum constant \"" + name + "\""),
  UnresolvedObjectReference: new DynamicExceptionBuilder(
    name => "unresolved object reference \"" + name + "\""),
  InvalidValueFormat: new DynamicExceptionBuilder(
    (val, type) => "invalid value \"" + val + "\" for type \"" + type + "\""),
});

module.exports = {
  kJsonifyException
};
