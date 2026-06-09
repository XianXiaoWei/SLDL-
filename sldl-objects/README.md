# sldl-objects

Fully-typed `.level.bin` reader and writer for **Sky: Children of the Light** (TGCL binary level format).

## Installation

```bash
npm install sldl-jsonify
```

## Quick start

```js
const { LevelObjects, MetaTypeClass, kMetaTypes } = require("sldl-objects");
const { Buffer } = require("sldl-utils");
const fs = require("fs");

// -- Reading --

var def_Test = new MetaTypeClass("Test");
def_Test.addMember(kMetaTypes.Bool, "enabled");
def_Test.addMember(kMetaTypes.Float, "foo");
def_Test.addMember(kMetaTypes.Pointer, "bar");
def_Test.addMember(kMetaTypes.Pointer, "data", 0); // array with maxCount=0 (unbounded)

var level = new LevelObjects([def_Test]);
level.read(Buffer.from(fs.readFileSync("test.level.bin")));
level.finalize();

console.log(level.get("MyTestObject").getValue("enabled")); // LevelValueBool

// -- Writing --

var out = level.write();
fs.writeFileSync("output.level.bin", out);
```

## Binary format

The TGCL format is a chunked binary layout:

| Offset | Section | Description |
|---|---|---|
| 0 | `LoHeader` (44 bytes) | Magic `TGCL`, version, counts, section offsets |
| `classesOffset` | Classes (N × 12) | Class name offset, first memvar index, memvar count |
| `memvarsOffset` | Memvars (N × 16) | Type enum, name offset, size, aux value |
| `stringsOffset` | String pool | Zero-terminated strings referenced by offset |
| `objectsOffset` | Objects | Serialized `LevelValueClass` instances |

## API reference

### Type system — `MetaType` hierarchy

All types extend `MetaType`. Built-in types are available via `kMetaTypes`.

```
MetaType (base)
├── MetaTypeBool          — 1-byte boolean
├── MetaTypeNumber        — Integer / float of configurable width
├── MetaTypePointer       — 4-byte object reference (index into object table)
├── MetaTypeString        — Zero-terminated inline string
├── MetaTypeStruct        — Composite value type with aligned member layout
│   └── MetaTypeStructMember — Individual struct field
└── MetaTypeClass         — Object definition with named members
    ├── MetaTypeClassMember      — Single-value member
    └── MetaTypeClassMemberArray — Dynamic array member
```

**`MetaType`** — abstract base:

| Method | Returns | Description |
|---|---|---|
| `getName()` | `string` | Type name |
| `getSize()` | `number` | Size in bytes |
| `getAlign()` | `number` | Alignment requirement |
| `valueType()` | `number` | One of `kMetaValueType` |
| `read(L, B, off)` | `LevelValue` | Deserialize from buffer |
| `write(L, B, val, off)` | `number` | Serialize to buffer; returns bytes written |

#### Built-in types (`kMetaTypes`)

```js
const { kMetaTypes } = require("sldl-objects");

kMetaTypes.Bool      // MetaTypeBool
kMetaTypes.Int8      // MetaTypeNumber  (1 byte,  signed)
kMetaTypes.Uint8     // MetaTypeNumber  (1 byte,  unsigned)
kMetaTypes.Int16     // MetaTypeNumber  (2 bytes, signed LE)
kMetaTypes.Uint16    // MetaTypeNumber  (2 bytes, unsigned LE)
kMetaTypes.Int32     // MetaTypeNumber  (4 bytes, signed LE)
kMetaTypes.Uint32    // MetaTypeNumber  (4 bytes, unsigned LE)
kMetaTypes.Int64     // MetaTypeNumber  (8 bytes, signed LE)
kMetaTypes.Uint64    // MetaTypeNumber  (8 bytes, unsigned LE)
kMetaTypes.Float     // MetaTypeNumber  (4 bytes, IEEE 754 LE)
kMetaTypes.Double    // MetaTypeNumber  (8 bytes, IEEE 754 LE)
kMetaTypes.Pointer   // MetaTypePointer (4 bytes)
kMetaTypes.Object    // MetaTypeClass   (base object type, no members)
```

#### Defining custom types

```js
const { MetaTypeClass, MetaTypeStruct, kMetaTypes } = require("sldl-objects");

// Class definition (can hold mixed member types including pointers)
var Vec3 = new MetaTypeStruct("Vec3");
Vec3.addMember(kMetaTypes.Float, "x");
Vec3.addMember(kMetaTypes.Float, "y");
Vec3.addMember(kMetaTypes.Float, "z");
Vec3.finalize(16); // optional: force 16-byte alignment

// Class definition
var MyClass = new MetaTypeClass("MyClass");
MyClass.addMember(kMetaTypes.Bool,   "active");
MyClass.addMember(kMetaTypes.Int32,  "count");
MyClass.addMember(kMetaTypes.Pointer, "target");
MyClass.addMember(kMetaTypes.Float,  "values", 10); // array, max 10 elements
```

#### Value type enums (`kMetaValueType`)

```js
kMetaValueType.None    = 0
kMetaValueType.Number  = 1
kMetaValueType.String  = 2
kMetaValueType.Struct  = 3
kMetaValueType.Class   = 4
kMetaValueType.Pointer = 5
```

---

### Value system — `LevelValue` hierarchy

All values extend `LevelValue`. Each holds a reference to its defining `MetaType`.

```
LevelValue (base)
├── LevelValueBool     — boolean value
├── LevelValueNumber   — integer / float / bigint value
├── LevelValueString   — string value
├── LevelValuePointer  — object reference (resolved after backpatch)
├── LevelValueStruct   — composite value with named fields
└── LevelValueClass    — class instance with name and member values
```

**`LevelValue`** — abstract base:

| Method | Returns | Description |
|---|---|---|
| `getDef()` | `MetaType` | The type that produced this value |
| `getSize()` | `number` | Serialized size in bytes |
| `getAlign()` | `number` | Alignment requirement |
| `getValue()` | `any` | Raw value |
| `setValue(v)` | `void` | Set raw value |
| `valueType()` | `number` | One of `kMetaValueType` |

**`LevelValueClass`** — object instance:

| Method | Returns | Description |
|---|---|---|
| `getName()` | `string` | Object name |
| `getValue(name)` | `LevelValue \| LevelValue[] \| undefined` | Get member by name |
| `setValue(name, v)` | `void` | Set member value |
| `finalize()` | `void` | Recalculate serialized size |

**`LevelValuePointer`** — resolved after read:

| Method | Returns | Description |
|---|---|---|
| `backpatch(L)` | `void` | Resolve index → object reference (called internally) |
| `setIndex(i)` | `void` | Set raw index (used before write) |
| `getValue()` | `LevelValueClass \| null` | Target object (null if `0xFFFFFFFF`) |

---

### Reader / Writer — `LevelObjects`

```js
var level = new LevelObjects(definitions);
```

| Method | Returns | Description |
|---|---|---|
| `define(defs)` | `void` | Register an array of `MetaType` definitions |
| `finalize()` | `void` | Rebuild internal name→object maps |
| `get(name)` | `LevelValueClass \| undefined` | Get object by name |
| `set(object)` | `void` | Add or replace an object (keyed by `object.name`) |
| `read(B)` | `void` | Parse a TGCL binary buffer |
| `write()` | `Buffer` | Serialize all objects to a TGCL binary buffer |
| `readDataString(B, off)` | `string` | Read a string from the string pool (used internally) |

---

### Binary format classes

These are used internally but exposed for advanced use:

| Class | Description |
|---|---|
| `LoHeader` | File header (magic, version, counts, offsets). Methods: `read(B)`, `write()`, `initialize()` |
| `LoStringPool` | Zero-terminated string accumulator. Methods: `set(s)`, `write()`, `initialize()`. Static: `read(B, off)` |
| `LoMemvar` | Member variable descriptor (type, name, size, aux) |
| `LoClass` | Raw class entry linking to its memvars and definition |
| `LoIndices` | Serialization context — holds class/memvar/object arrays, pointer lists, and name→index maps |

#### Memvar types (`kMemvarTypes`)

```js
kMemvarTypes.Raw    = 0  // Number or Struct
kMemvarTypes.String = 1  // Inline string
kMemvarTypes.Ref    = 2  // Object pointer
kMemvarTypes.Array  = 3  // Dynamic array
```

---

### Exceptions (`kObjectExceptions`)

```js
const { kObjectExceptions } = require("sldl-objects");

kObjectExceptions.MemvarOutOfBound     // memvar index exceeds available range
kObjectExceptions.ReadObjectFailed     // failed to deserialize an object
kObjectExceptions.InvalidClassName     // class name not found in definitions
kObjectExceptions.MultipleObjectName   // duplicate object name
kObjectExceptions.MultipleClassName    // duplicate class name
kObjectExceptions.MemberMismatch       // member type doesn't match definition
kObjectExceptions.InvalidClassIndex    // class index out of range
kObjectExceptions.InvalidObjectIndex   // object index out of range (dangling pointer)
```

All exceptions are thrown via `SldlException` from `sldl-utils`. Catch them with:

```js
try {
  level.read(buf);
} catch (e) {
  console.error(e.message);
}
```

---

## Reading flow (internal)

```
Binary Buffer
  → LoHeader.read()           // Parse header, get section offsets
  → LoIndices.addMemvarFromBlob() × N   // Parse memvar descriptors
  → LoIndices.addClassFromBlob() × N    // Parse class descriptors
  → LoClass.setDef() × N               // Match classes to MetaType definitions
  → MetaTypeClass.read() × N           // Deserialize each object
    → for each member:
        MetaTypeClassMember.read()       // Delegate to inner type
          → pointer values collected into LoIndices.pointers
  → LevelValuePointer.backpatch() × N  // Resolve pointer indices → object refs
```

## Writing flow (internal)

```
LevelObjects.write()
  → LoIndices.define()         // Register type definitions
  → LoIndices.addClassFromDef() × N  // Create binary descriptors from MetaType defs
  → LoIndices.addObject() × N        // Register objects, assign indices
  → Front-patch pointers       // Resolve object refs → array indices
  → Write memvar buffer        // 16 bytes each
  → Write class buffer         // 12 bytes each
  → Write string pool          // All name strings
  → Write object buffer        // Via MetaTypeClass.write()
  → Assemble final Buffer      // Header + [classes|memvars|strings|objects]
```

## TypeScript

This package ships with type declarations (`main.d.ts`). All classes, constants, and method signatures are fully typed.

```typescript
import { LevelObjects, MetaTypeClass, kMetaTypes, LevelValueClass } from "sldl-objects";

var def: MetaTypeClass = new MetaTypeClass("Test");
def.addMember(kMetaTypes.Bool, "active");

var level: LevelObjects = new LevelObjects([def]);
level.read(someBuffer);

var obj: LevelValueClass | undefined = level.get("MyObject");
```

## License

LGPL-3.0-or-later — Copyright (c) 2026 That Sky Project
