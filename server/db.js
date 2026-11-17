"use strict";
// Tiny JSON file database. Fine for one admin and a few thousand rows.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DIR, "db.json");
let db = { leads: [], articles: [], projects: [] };

function load() {
  fs.mkdirSync(path.join(DIR, "uploads"), { recursive: true });
  try {
    db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, "utf8")));
    fs.copyFileSync(FILE, FILE + ".bak"); // one backup per start
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
function save() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

module.exports = { DIR, load, save, id, now, get: (name) => db[name] };
