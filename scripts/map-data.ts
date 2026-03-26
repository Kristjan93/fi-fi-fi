/**
 * map-data.ts — Shared types and loader for hut/trail/attraction data.
 *
 * Single source of truth for the data shape. Both init-db.ts and
 * validate-data.ts import from here.
 */

import { readFileSync } from "fs";

// ── Types ──────────────────────────────────────

export interface Hut {
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

export interface Trail {
  id: string;
  name: string;
  distance: string | null;
  duration: string | null;
  info: string;
  geojson: string | null;
  _note?: string;
}

export interface Attraction {
  id: string;
  name: string;
  coords: [number, number] | null;
  info: string;
  _note?: string;
}

// ── Loader ─────────────────────────────────────

export interface MapData {
  huts: Hut[];
  trails: Trail[];
  attractions: Attraction[];
}

export function loadMapData(): MapData {
  return {
    huts: JSON.parse(readFileSync("data/huts.json", "utf8")),
    trails: JSON.parse(readFileSync("data/trails.json", "utf8")),
    attractions: JSON.parse(readFileSync("data/attractions.json", "utf8")),
  };
}
