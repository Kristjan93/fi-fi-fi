/**
 * init-db.ts — Create and populate the map SQLite database.
 *
 * Migrates data from JSON files into data/map.db with foreign key
 * constraints. Run once, or re-run to rebuild from JSON source.
 *
 * Run: bun scripts/init-db.ts
 */

import { Database } from "bun:sqlite";
import { readFileSync, unlinkSync, existsSync } from "fs";

const DB_PATH = "data/map.db";

// Start fresh
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ── Schema ─────────────────────────────────────

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

  -- Junction tables with foreign keys
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

// ── Load JSON ──────────────────────────────────

interface HutJson {
  id: string;
  name: string;
  coords: [number, number];
  beds: number;
  elevation: number | null;
  open: string;
  label: string;
  info: string;
  trails: string[];
  attractions: string[];
  source: string;
}

interface TrailJson {
  id: string;
  name: string;
  distance: string | null;
  duration: string | null;
  info: string;
  huts: string[];
  geojson: string | null;
  _note?: string;
}

interface AttrJson {
  id: string;
  name: string;
  coords: [number, number] | null;
  info: string;
  huts: string[];
  _note?: string;
}

const huts: HutJson[] = JSON.parse(readFileSync("data/huts.json", "utf8"));
const trails: TrailJson[] = JSON.parse(readFileSync("data/trails.json", "utf8"));
const attrs: AttrJson[] = JSON.parse(readFileSync("data/attractions.json", "utf8"));

// ── Insert ─────────────────────────────────────

const insertHut = db.prepare(`
  INSERT INTO huts (id, name, lon, lat, beds, elevation, open, label, info, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTrail = db.prepare(`
  INSERT INTO trails (id, name, distance, duration, info, geojson, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAttr = db.prepare(`
  INSERT INTO attractions (id, name, lon, lat, info, note)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertHutTrail = db.prepare(`
  INSERT INTO hut_trails (hut_id, trail_id) VALUES (?, ?)
`);

const insertHutAttr = db.prepare(`
  INSERT INTO hut_attractions (hut_id, attraction_id) VALUES (?, ?)
`);

const populate = db.transaction(() => {
  for (const t of trails) {
    insertTrail.run(t.id, t.name, t.distance, t.duration, t.info, t.geojson, t._note ?? null);
  }

  for (const a of attrs) {
    insertAttr.run(a.id, a.name, a.coords?.[0] ?? null, a.coords?.[1] ?? null, a.info, a._note ?? null);
  }

  for (const h of huts) {
    insertHut.run(h.id, h.name, h.coords[0], h.coords[1], h.beds, h.elevation, h.open, h.label, h.info, h.source);
    for (const trailId of h.trails) {
      insertHutTrail.run(h.id, trailId);
    }
    for (const attrId of h.attractions) {
      insertHutAttr.run(h.id, attrId);
    }
  }
});

populate();

// ── Verify ─────────────────────────────────────

const counts = {
  huts: db.query("SELECT COUNT(*) as n FROM huts").get() as { n: number },
  trails: db.query("SELECT COUNT(*) as n FROM trails").get() as { n: number },
  attractions: db.query("SELECT COUNT(*) as n FROM attractions").get() as { n: number },
  hutTrails: db.query("SELECT COUNT(*) as n FROM hut_trails").get() as { n: number },
  hutAttractions: db.query("SELECT COUNT(*) as n FROM hut_attractions").get() as { n: number },
};

console.log(`Created ${DB_PATH}:`);
console.log(`  ${counts.huts.n} huts`);
console.log(`  ${counts.trails.n} trails`);
console.log(`  ${counts.attractions.n} attractions`);
console.log(`  ${counts.hutTrails.n} hut↔trail links`);
console.log(`  ${counts.hutAttractions.n} hut↔attraction links`);

// Quick FK test
try {
  db.prepare("INSERT INTO hut_trails VALUES (?, ?)").run("fake-hut", "laugavegur");
  console.log("\n  ✗ FK constraint NOT enforced!");
} catch {
  console.log("\n  ✓ Foreign key constraints enforced");
}

db.close();
