/**
 * map-data.ts — Read map data from SQLite.
 */

import { Database } from "bun:sqlite";

const DB_PATH = "data/map.db";

export interface Hut {
  id: string;
  name: string;
  lon: number;
  lat: number;
  beds: number;
  elevation: number | null;
  open: string | null;
  label: string;
  info: string;
  source: string | null;
}

export interface Trail {
  id: string;
  name: string;
  distance: string | null;
  duration: string | null;
  info: string;
  geojson: string | null;
}

export interface Attraction {
  id: string;
  name: string;
  lon: number | null;
  lat: number | null;
  info: string;
}

export function openMapDb() {
  const db = new Database(DB_PATH, { readonly: true });
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function getHuts(db: Database): Hut[] {
  return db.query("SELECT * FROM huts").all() as Hut[];
}

export function getTrailsForHut(db: Database, hutId: string): Trail[] {
  return db.query(
    "SELECT t.* FROM trails t JOIN hut_trails ht ON ht.trail_id = t.id WHERE ht.hut_id = ?"
  ).all(hutId) as Trail[];
}

export function getAttractionsForHut(db: Database, hutId: string): Attraction[] {
  return db.query(
    "SELECT a.* FROM attractions a JOIN hut_attractions ha ON ha.attraction_id = a.id WHERE ha.hut_id = ?"
  ).all(hutId) as Attraction[];
}
