import type { MapLocation } from "./map-zoom-css";

/**
 * PoC location data — Kettmeir wine regions (Alto Adige).
 * Swap this array to reuse the map zoom with different content.
 *
 * x/y: marker position on the map (percentage of container).
 * originX/originY: zoom center — can differ from marker to better frame the view.
 */
export const locations: MapLocation[] = [
  {
    id: "pochi",
    name: "Pochi di Salorno",
    x: 68,
    y: 54,
    originX: 72,
    originY: 55,
    label: "Bassa Atesina",
    info: "The southernmost point of South Tyrol, where warm Mediterranean winds meet Alpine air.",
  },
  {
    id: "caldaro",
    name: "Castelvecchio",
    x: 55,
    y: 35,
    originX: 72,
    originY: 35,
    label: "Lago di Caldaro",
    info: "Perched above Lake Caldaro, the oldest wine-growing area in the region.",
  },
  {
    id: "soprabolzano",
    name: "Soprabolzano",
    x: 60,
    y: 25,
    originX: 65,
    originY: 25,
    label: "Altopiano del Renon",
    info: "High above Bolzano on the Renon plateau, where altitude shapes character.",
  },
];
