/**
 * Part of that-sky-project.
 * Copyright (c) 2026 That Sky Project
 * All rights reserved.
 * 
 * Examples: 01-simple-rw
 *   Simple .level.bin read, write and declarations.
 */

const { DeclarationGroup, JsonLevelObjects } = require("sldl-jsonify");
const { Buffer } = require("buffer");
const fs = require("fs");
const pl = require("path");

// Read declarations.
var decl = new DeclarationGroup(require("./decl.json")).parse();

// Parse and write JSON objects.
var obj_w = new JsonLevelObjects(decl);
var buffer = obj_w.write(require("./objects.json"));

fs.writeFileSync(pl.join(__dirname, "objects.level.bin"), buffer);

// Read without declaration.
var obj_r_nodecl = new JsonLevelObjects({});
var objects = obj_r_nodecl.read(buffer);
var decl_nodecl = obj_r_nodecl.getDeclGroup(true);
fs.writeFileSync(pl.join(__dirname, "objects.no_decl.level.json"), JSON.stringify(objects, null, 2));
fs.writeFileSync(pl.join(__dirname, "objects.no_decl.decl.json"), JSON.stringify(decl_nodecl, null, 2));

// Read with declaration.
var obj_r_decl = new JsonLevelObjects(decl);
var objects = obj_r_decl.read(buffer);
var decl_decl = obj_r_decl.getDeclGroup(true);
fs.writeFileSync(pl.join(__dirname, "objects.has_decl.level.json"), JSON.stringify(objects, null, 2));
fs.writeFileSync(pl.join(__dirname, "objects.has_decl.decl.json"), JSON.stringify(decl_decl, null, 2));
