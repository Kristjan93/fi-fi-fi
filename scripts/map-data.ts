/**
 * map-data.ts — Shared types and loader for hut/trail/attraction data.
 */

import { readFileSync } from "fs";

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

export function loadMapData() {
  return {
    huts: JSON.parse(readFileSync("data/huts.json", "utf8")) as Hut[],
    trails: JSON.parse(readFileSync("data/trails.json", "utf8")) as Trail[],
    attractions: JSON.parse(readFileSync("data/attractions.json", "utf8")) as Attraction[],
  };
}
