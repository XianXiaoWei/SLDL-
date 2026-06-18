# sldl-jsonify

JSON and Itanium frontend for `sldl-objects` - Sky:CotL level editor.

## Installation

```sh
npm i sldl-jsonify
```

## Quick Start

### JSON Declaration Group

```js
var { JsonLevelObjects } = require("sldl-jsonify");
var fs = require("fs");

// Define types as JSON.
var declGroup = {
  "C$MyType": {
    "$parent": "Object",
    "enabled": "bool",
    "speed": "float",
    "label": "cstring",
    "target": "C$MyType *",
    "children": "C$MyType *[]"
  }
};

var jlo = new JsonLevelObjects(declGroup);

// Read binary -> JSON.
var { objects } = jlo.read(fs.readFileSync("Objects.level.bin"));
console.log(objects["O$SomeObject"].enabled);

// Write JSON -> binary.
fs.writeFileSync("output.bin", jlo.write(objects));
```

## Declaration Group Format

Declaration groups use prefixed keys to define types:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `C$` | Class | `"C$Actor": { "$parent": "Object", "hp": "int32_t" }` |
| `S$` | Struct | `"S$Vec3": { "x": "float", "y": "float", "z": "float" }` |
| `E$` | Enum | `"E$Color": { "$as": "int32_t", "Red": 1, "Blue": 2 }` |
| `A$` | Alias | `"A$Health": "int32_t"` |

### Class Members

```
<TypeName>                    inline type (number, struct, string)
<TypeName> *                  object pointer
<TypeName> *[]                dynamic pointer array
<TypeName> *[N]               fixed-size pointer array
<TypeName> []                 inline object array
<TypeName> [N]                fixed-size inline object array
R$<N>                         raw binary of N bytes
```

### JSON Value Format

**Numbers**: plain JS numbers, `"B$<hex>"` for binary values, `"K$<enum>"` for enum constants.

**Raw bytes**: `"B$<hex>"` only. Hex is big-endian, right-aligned to target size.

**References**: `"P$<objectName>"` or `null`.

### Object Format

```json
{
  "O$ObjectName": {
    "$type": "ClassName",
    "memberA": value,
    "memberB": "P$OtherObject"
  }
}
```

## API Reference

### JsonLevelObjects

```js
new JsonLevelObjects(declGroup)          // from JSON declaration group
jlo.read(buffer)                         // -> { objects, declGroup }
jlo.write(objects)                       // -> Buffer
```

### DeclarationGroup

```js
var dg = new DeclarationGroup(declGroupObj)
dg.parse()                               // -> this
dg.types                                 // Map<string, MetaType>
dg.classes                               // Map<string, MetaTypeClass>
dg.enumConstants                         // Map<string, value>
dg.resolveType(name)                     // -> MetaType | undefined
```

### JSON Value Helpers

```js
var jsonValue = require("sldl-jsonify").jsonValue
jsonValue.parse(jsonValue, member, dg)   // JSON -> LevelValue
jsonValue.serialize(levelValue)          // LevelValue -> JSON
```

## License

LGPL-3.0-or-later - Copyright (c) 2026 That Sky Project
