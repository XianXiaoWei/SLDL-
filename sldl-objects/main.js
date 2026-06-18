/**
 * sldl-objects - OO TGCL .level.bin binary reader/writer.
 *
 * Copyright (c) 2026 That Sky Project
 * LGPL-3.0-or-later
 */

const { kObjectExceptions } = require("./src/exceptions.js");
const {
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes
} = require("./src/levelObjects.js");
const { kMetaTypes, getClumpGeneric, clumpGenericCache } = require("./src/types.js");
const { MetaType, MetaTypeForward, kMetaValueType } = require("./src/type/metaType.js");
const {
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass,
  MetaTypeClump
} = require("./src/type/metaTypeClass.js");
const { MetaTypeBool, MetaTypeNumber } = require("./src/type/metaTypeNumber.js");
const { MetaTypePointer } = require("./src/type/metaTypePointer.js");
const { MetaTypeString } = require("./src/type/metaTypeString.js");
const { MetaTypeStructMember, MetaTypeStruct } = require("./src/type/metaTypeStruct.js");
const { MetaTypeRaw } = require("./src/type/metaTypeRaw.js");
const { LevelValue } = require("./src/value/levelValue.js");
const { LevelValueClass } = require("./src/value/levelValueClass.js");
const { LevelValueBool, LevelValueNumber } = require("./src/value/levelValueNumber.js");
const { LevelValuePointer } = require("./src/value/levelValuePointer.js");
const { LevelValueString } = require("./src/value/levelValueString.js");
const { LevelValueStruct } = require("./src/value/levelValueStruct.js");
const { LevelValueRaw } = require("./src/value/levelValueRaw.js");

module.exports = {
  // ./src/exceptions.js
  kObjectExceptions,

  // ./src/levelObjects.js
  LoHeader,
  LoStringPool,
  LoMemvar,
  LoClass,
  LoIndices,
  LevelObjects,
  kMemvarTypes,

  // ./src/types.js
  kMetaTypes,
  getClumpGeneric,
  clumpGenericCache,
  MetaType,
  MetaTypeForward,
  kMetaValueType,

  // ./src/type/metaTypeClass.js
  MetaTypeClassMember,
  MetaTypeClassMemberArray,
  MetaTypeClass,
  MetaTypeClump,

  // ./src/type/metaTypeNumber.js
  MetaTypeBool,
  MetaTypeNumber,

  // ./src/type/metaTypePointer.js
  MetaTypePointer,

  // ./src/type/metaTypeString.js
  MetaTypeString,

  // ./src/type/metaTypeStruct.js
  MetaTypeStructMember,
  MetaTypeStruct,

  // ./src/type/metaTypeRaw.js
  MetaTypeRaw,

  // ./src/value/levelValue.js
  LevelValue,

  // ./src/value/levelValueClass.js
  LevelValueClass,

  // ./src/value/levelValueNumber.js
  LevelValueBool,
  LevelValueNumber,

  // ./src/value/levelValuePointer.js
  LevelValuePointer,

  // ./src/value/levelValueString.js
  LevelValueString,

  // ./src/value/levelValueStruct.js
  LevelValueStruct,

  // ./src/value/levelValueRaw.js
  LevelValueRaw,
};
