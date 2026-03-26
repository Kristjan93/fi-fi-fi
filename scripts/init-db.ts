/**
 * init-db.ts — Create and populate the map SQLite database.
 *
 * Reads JSON source files and builds data/map.db with foreign key
 * constraints. Huts are the single source of truth for relationships;
 * junction tables are derived from hut.trails[] and hut.attractions[].
 *
 * Run: bun scripts/init-db.ts
 */

import { Database } from "bun:sqlite";
import { unlinkSync, existsSync } from "fs";
import { loadMapData } from "./map-data";

const DB_PATH = "data/map.db";

if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE huts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lon         REAL NOT NULL,
    lat         REAL NOT NULL,
    beds        INTEGER NOT NULL,
    elevation   INTEGER,
    open        TEXT,
    label       TEXT NOT NULL,
    info        TEXT NOT NULL,
    source      TEXT
  );

  CREATE TABLE trails (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    distance    TEXT,
    duration    TEXT,
    info        TEXT NOT NULL,
    geojson     TEXT,
    note        TEXT
  );

  CREATE TABLE attractions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lon         REAL,
    lat         REAL,
    info        TEXT NOT NULL,
    note        TEXT
  );

  CREATE TABLE hut_trails (
    hut_id      TEXT NOT NULL REFERENCES huts(id),
    trail_id    TEXT NOT NULL REFERENCES trails(id),
    PRIMARY KEY (hut_id, trail_id)
  );

  CREATE TABLE hut_attractions (
    hut_id      TEXT NOT NULL REFERENCES huts(id),
    attraction_id TEXT NOT NULL REFERENCES attractions(id),
    PRIMARY KEY (hut_id, attraction_id)
  );
`);

const { huts, trails, attractions } = loadMapData();

const insertHut = db.prepare(
  "INSERT INTO huts (id, name, lon, lat, beds, elevation, open, label, info, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const insertTrail = db.prepare(
  "INSERT INTO trails (id, name, distance, duration, info, geojson, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
const insertAttr = db.prepare(
  "INSERT INTO attractions (id, name, lon, lat, info, note) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertHutTrail = db.prepare("INSERT INTO hut_trails (hut_id, trail_id) VALUES (?, ?)");
const insertHutAttr = db.prepare("INSERT INTO hut_attractions (hut_id, attraction_id) VALUES (?, ?)");

const populate = db.transaction(() => {
  for (const t of trails) {
    insertTrail.run(t.id, t.name, t.distance, t.duration, t.info, t.geojson, t._note ?? null);
  }
  for (const a of attractions) {
    insertAttr.run(a.id, a.name, a.coords?.[0] ?? null, a.coords?.[1] ?? null, a.info, a._note ?? null);
  }
  for (const h of huts) {
    insertHut.run(h.id, h.name, h.coords[0], h.coords[1], h.beds, h.elevation, h.open, h.label, h.info, h.source);
    for (const trailId of h.trails) insertHutTrail.run(h.id, trailId);
    for (const attrId of h.attractions) insertHutAttr.run(h.id, attrId);
  }
});

populate();

const count = (table: string) => (db.query(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

console.log(`Created ${DB_PATH}:`);
console.log(`  ${count("huts")} huts`);
console.log(`  ${count("trails")} trails`);
console.log(`  ${count("attractions")} attractions`);
console.log(`  ${count("hut_trails")} hut↔trail links`);
console.log(`  ${count("hut_attractions")} hut↔attraction links`);

try {
  db.prepare("INSERT INTO hut_trails VALUES (?, ?)").run("fake-hut", "laugavegur");
  console.log("\n  ✗ FK constraint NOT enforced!");
} catch {
  console.log("\n  ✓ Foreign key constraints enforced");
}

db.close();
