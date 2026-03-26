/**
 * validate-data.ts — Check huts/trails/attractions JSON for consistency.
 *
 * Checks: broken cross-references, orphaned entries, bidirectional link
 * mismatches, stale "TODO" strings, schema completeness.
 *
 * Run: bun scripts/validate-data.ts
 */

import { readFileSync } from "fs";

interface Hut {
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

interface Trail {
  id: string;
  name: string;
  distance: string | null;
  duration: string | null;
  info: string;
  huts: string[];
  geojson: string | null;
  _note?: string;
}

interface Attraction {
  id: string;
  name: string;
  coords: [number, number] | null;
  info: string;
  huts: string[];
  _note?: string;
}

const huts: Hut[] = JSON.parse(readFileSync("data/huts.json", "utf8"));
const trails: Trail[] = JSON.parse(readFileSync("data/trails.json", "utf8"));
const attrs: Attraction[] = JSON.parse(readFileSync("data/attractions.json", "utf8"));

const hutIds = new Set(huts.map((h) => h.id));
const trailIds = new Set(trails.map((t) => t.id));
const attrIds = new Set(attrs.map((a) => a.id));

const errors: string[] = [];
const warnings: string[] = [];

// ── Broken references ──────────────────────────
for (const h of huts) {
  for (const a of h.attractions) {
    if (!attrIds.has(a)) errors.push(`hut "${h.id}" -> attraction "${a}" does not exist`);
  }
  for (const t of h.trails) {
    if (!trailIds.has(t)) errors.push(`hut "${h.id}" -> trail "${t}" does not exist`);
  }
}

for (const a of attrs) {
  for (const h of a.huts) {
    if (!hutIds.has(h)) errors.push(`attraction "${a.id}" -> hut "${h}" does not exist`);
  }
}

for (const t of trails) {
  for (const h of t.huts) {
    if (!hutIds.has(h)) errors.push(`trail "${t.id}" -> hut "${h}" does not exist`);
  }
}

// ── Bidirectional consistency ──────────────────
for (const a of attrs) {
  for (const hutId of a.huts) {
    const hut = huts.find((h) => h.id === hutId);
    if (hut && !hut.attractions.includes(a.id)) {
      warnings.push(`attraction "${a.id}" claims hut "${hutId}" but hut does not list it back`);
    }
  }
}

for (const h of huts) {
  for (const attrId of h.attractions) {
    const attr = attrs.find((a) => a.id === attrId);
    if (attr && !attr.huts.includes(h.id)) {
      warnings.push(`hut "${h.id}" claims attraction "${attrId}" but attraction does not list it back`);
    }
  }
}

for (const t of trails) {
  for (const hutId of t.huts) {
    const hut = huts.find((h) => h.id === hutId);
    if (hut && !hut.trails.includes(t.id)) {
      warnings.push(`trail "${t.id}" claims hut "${hutId}" but hut does not list it back`);
    }
  }
}

for (const h of huts) {
  for (const trailId of h.trails) {
    const trail = trails.find((t) => t.id === trailId);
    if (trail && !trail.huts.includes(h.id)) {
      warnings.push(`hut "${h.id}" claims trail "${trailId}" but trail does not list it back`);
    }
  }
}

// ── Orphaned entries ───────────────────────────
for (const a of attrs) {
  const referencedBy = huts.filter((h) => h.attractions.includes(a.id));
  if (referencedBy.length === 0) {
    warnings.push(`attraction "${a.id}" is orphaned — no hut references it (claims: ${a.huts.join(", ")})`);
  }
}

// ── Duplicate IDs ──────────────────────────────
const allIds = [...huts.map((h) => h.id), ...trails.map((t) => t.id), ...attrs.map((a) => a.id)];
const seen = new Set<string>();
for (const id of allIds) {
  if (seen.has(id)) errors.push(`duplicate ID: "${id}"`);
  seen.add(id);
}

// ── Stale TODOs ────────────────────────────────
function checkTodo(obj: Record<string, unknown>, context: string) {
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("_")) continue;
    if (val === "TODO") warnings.push(`${context} has "TODO" in field "${key}"`);
  }
}

for (const h of huts) checkTodo(h as unknown as Record<string, unknown>, `hut "${h.id}"`);
for (const t of trails) checkTodo(t as unknown as Record<string, unknown>, `trail "${t.id}"`);
for (const a of attrs) checkTodo(a as unknown as Record<string, unknown>, `attraction "${a.id}"`);

// ── Required fields ────────────────────────────
for (const h of huts) {
  if (!h.id || !h.name || !h.coords || !h.info || !h.label) {
    errors.push(`hut "${h.id}" missing required field(s)`);
  }
}
for (const t of trails) {
  if (!t.id || !t.name || !t.info) {
    errors.push(`trail "${t.id}" missing required field(s)`);
  }
}
for (const a of attrs) {
  if (!a.id || !a.name || !a.info) {
    errors.push(`attraction "${a.id}" missing required field(s)`);
  }
}

// ── Report ─────────────────────────────────────
console.log(`\nData validation: ${huts.length} huts, ${trails.length} trails, ${attrs.length} attractions\n`);

if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
}

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (!errors.length && !warnings.length) {
  console.log("All checks passed.");
}

process.exit(errors.length ? 1 : 0);
