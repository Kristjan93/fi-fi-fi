/**
 * generate-map.ts — Build-time SVG generator.
 *
 * Reads GeoJSON coastline data, projects it with D3, and outputs:
 *   1. src/map/iceland.svg  — static SVG coastline (fill="currentColor")
 *   2. src/map/locations.ts — location data with computed x/y percentages
 *
 * Run: bun scripts/generate-map.ts
 * D3 is a devDependency — nothing here ships to the browser.
 */

import { geoMercator, geoPath } from "d3-geo";
import { line, curveCatmullRom } from "d3-shape";
import sharp from "sharp";
import type { FeatureCollection } from "geojson";

// ── Config ──────────────────────────────────────────────

const W = 1920;
const H = 1080;
const PADDING = 50;

// Locations with geographic coordinates [longitude, latitude]
const MARKERS = [
  {
    id: "rvk",
    name: "Reykjavík",
    coords: [-21.9426, 64.1466] as [number, number],
    label: "Höfuðborg",
    info: "Norðurljós borgarinnar, þar sem skapandi menning og náttúra mætast.",
  },
  {
    id: "tmk",
    name: "Þórsmörk",
    coords: [-19.52, 63.68] as [number, number],
    label: "Dalur",
    info: "Falinn dalur milli jökla, vafinn birki og villtum blómum.",
  },
  {
    id: "jkl",
    name: "Jökulsárlón",
    coords: [-16.18, 64.08] as [number, number],
    label: "Jökullón",
    info: "Ísmoldur reka á lóninu þar sem jökull og sjór mætast.",
  },
  {
    id: "lml",
    name: "Landmannalaugar",
    coords: [-19.07, 63.98] as [number, number],
    label: "Hálendi",
    info: "Litríkar líparitfjöll og heitar laugar í hjarta hálendisins.",
  },
  {
    id: "snf",
    name: "Snæfellsjökull",
    coords: [-23.77, 64.81] as [number, number],
    label: "Jökuleldfjall",
    info: "Jökullinn sem Jules Verne valdi sem hlið inn í jörðina.",
  },
  {
    id: "aku",
    name: "Akureyri",
    coords: [-18.1, 65.68] as [number, number],
    label: "Norðurland",
    info: "Höfuðborg norðursins, umkringd fjöllum og Eyjafjörður.",
  },
  {
    id: "myt",
    name: "Mývatn",
    coords: [-16.96, 65.6] as [number, number],
    label: "Eldfjallahérað",
    info: "Jarðhitasvæði og lághitaeldfjöll við norðurhöf.",
  },
];

// Routes — loaded from GeoJSON files in data/
// Generated from OSM via scripts/convert-trail.ts, simplified with Douglas-Peucker
const ROUTES: { id: string; name: string; file: string }[] = [
  { id: "laugavegur", name: "Laugavegurinn", file: "data/laugavegur.geojson" },
];

// ── Simplification ──────────────────────────────────────
// Douglas-Peucker: remove points that deviate less than `tolerance`
// from the line between their neighbors. Higher = smoother/simpler.

function simplifyRing(
  ring: [number, number][],
  tolerance: number,
): [number, number][] {
  if (ring.length <= 2) return ring;

  let maxDist = 0;
  let maxIdx = 0;
  const [sx, sy] = ring[0]!;
  const [ex, ey] = ring[ring.length - 1]!;

  for (let i = 1; i < ring.length - 1; i++) {
    const [px, py] = ring[i]!;
    // Perpendicular distance from point to line segment
    const dx = ex - sx;
    const dy = ey - sy;
    const len2 = dx * dx + dy * dy;
    const dist =
      len2 === 0
        ? Math.hypot(px - sx, py - sy)
        : Math.abs(dy * px - dx * py + ex * sy - ey * sx) / Math.sqrt(len2);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRing(ring.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRing(ring.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [ring[0]!, ring[ring.length - 1]!];
}

function simplifyGeoJSON(
  geojson: FeatureCollection,
  tolerance: number,
): FeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((f) => {
      if (f.geometry.type !== "MultiPolygon") return f;
      return {
        ...f,
        geometry: {
          ...f.geometry,
          coordinates: f.geometry.coordinates
            .map((polygon) =>
              polygon.map((ring) =>
                simplifyRing(ring as [number, number][], tolerance),
              ),
            )
            .filter((polygon) => polygon[0]!.length >= 4), // drop tiny islands
        },
      };
    }),
  };
}

// ── Load GeoJSON ────────────────────────────────────────

const rawGeoJSON: FeatureCollection = await Bun.file(
  "data/iceland.geojson",
).json();

// Optional simplification — set to 0 to disable, 0.02 for smooth hero (~600 pts)
const SIMPLIFY_TOLERANCE = 0;
const geojson = SIMPLIFY_TOLERANCE > 0
  ? simplifyGeoJSON(rawGeoJSON, SIMPLIFY_TOLERANCE)
  : rawGeoJSON;

// ── Project ─────────────────────────────────────────────

const projection = geoMercator().fitExtent(
  [
    [PADDING, PADDING],
    [W - PADDING, H - PADDING],
  ],
  geojson,
);

const pathGenerator = geoPath(projection);

// Generate coastline path — d3 composites all polygons into one d string
const coastlineD = pathGenerator(geojson.features[0]!.geometry);
if (!coastlineD) {
  console.error("Failed to generate coastline path from GeoJSON");
  process.exit(1);
}

// ── Fetch ESRI terrain ──────────────────────────────────
// Free hillshade export — no API key needed. We request at 2x viewBox
// for crisp rendering at 2.8x zoom. Clipped to coastline via SVG <clipPath>.

function toWebMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.34 / 180);
  return [x, y];
}

// Get geographic bounds from the projection
const nw = projection.invert!([0, 0])!;
const se = projection.invert!([W, H])!;
const [x0, y0] = toWebMercator(nw[0], nw[1]);
const [x1, y1] = toWebMercator(se[0], se[1]);

const TERRAIN_SCALE = 3; // 3x for crisp rendering at 2.8x zoom
const terrainW = W * TERRAIN_SCALE;
const terrainH = H * TERRAIN_SCALE;

const bboxParams =
  `?bbox=${x0},${y1},${x1},${y0}&bboxSR=3857` +
  `&size=${terrainW},${terrainH}&imageSR=3857` +
  `&format=png32&transparent=true&f=image`;

const hillshadeUrl =
  `https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/export` +
  bboxParams;
const reliefUrl =
  `https://server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer/export` +
  bboxParams;

// Fetch both terrain layers in parallel
console.log("Fetching ESRI terrain (hillshade + shaded relief)...");
const [hillshadeRes, reliefRes] = await Promise.all([
  fetch(hillshadeUrl),
  fetch(reliefUrl),
]);
const hillshadeBuffer = Buffer.from(await hillshadeRes.arrayBuffer());
const reliefBuffer = Buffer.from(await reliefRes.arrayBuffer());
console.log(
  `Hillshade: ${(hillshadeBuffer.byteLength / 1024 / 1024).toFixed(1)} MB, ` +
  `Relief: ${(reliefBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
);

// Coastline mask — white land, transparent ocean
const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${terrainW}" height="${terrainH}" viewBox="0 0 ${W} ${H}">` +
  `<path d="${coastlineD}" fill="white"/>` +
  `</svg>`,
);
const maskBuffer = await sharp(maskSvg).resize(terrainW, terrainH).toBuffer();

// Generate glacier mask from GeoJSON using same projection
const glacierFile = Bun.file("data/glaciers.geojson");
let glacierMaskSvg = "";
if (await glacierFile.exists()) {
  const glacierGeoJSON = await glacierFile.json();
  const glacierD = pathGenerator(glacierGeoJSON.geometry);
  if (glacierD) {
    glacierMaskSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${terrainW}" height="${terrainH}" viewBox="0 0 ${W} ${H}">` +
      `<path d="${glacierD}" fill="white"/>` +
      `</svg>`;
  }
}

// Save raw layers + masks for Python processing script
await sharp(hillshadeBuffer).resize(terrainW, terrainH).png().toFile("public/assets/raw-hillshade.png");
await sharp(reliefBuffer).resize(terrainW, terrainH).png().toFile("public/assets/raw-relief.png");
await sharp(maskSvg).resize(terrainW, terrainH).png().toFile("public/assets/raw-mask.png");
if (glacierMaskSvg) {
  await sharp(Buffer.from(glacierMaskSvg)).resize(terrainW, terrainH).png().toFile("public/assets/raw-glaciers.png");
  console.log("Glacier mask saved → public/assets/raw-glaciers.png");
}
console.log("Raw terrain layers saved → public/assets/raw-*.png");
console.log("Run: uv run scripts/process-terrain.py");

// ── Generate SVG ────────────────────────────────────────

// Build route paths — project to pixels, then smooth with Catmull-Rom curves
const smoothLine = line<[number, number]>()
  .x((d) => d[0])
  .y((d) => d[1])
  .curve(curveCatmullRom.alpha(0.5));

const routesSvg = (
  await Promise.all(
    ROUTES.map(async (route) => {
      const routeGeoJSON = await Bun.file(route.file).json();
      const coords: [number, number][] = routeGeoJSON.geometry.coordinates;
      const pixels = coords
        .map((c) => projection(c))
        .filter(Boolean) as [number, number][];
      const d = smoothLine(pixels);
      if (!d) return "";
      return `  <path d="${d}" class="route" data-route="${route.id}"
        fill="none" stroke="currentColor" stroke-width="2"
        opacity="0.5" />`;
    }),
  )
).join("\n");

// Build marker circles for the SVG preview
const markersSvg = MARKERS.map((m) => {
  const projected = projection(m.coords);
  if (!projected) return "";
  const [px, py] = projected;
  return `  <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="currentColor" />
  <text x="${(px + 14).toFixed(1)}" y="${(py + 4).toFixed(1)}" font-size="14" font-family="system-ui, sans-serif" font-weight="600" letter-spacing="0.15em" fill="currentColor">${m.name.toUpperCase()}</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
     preserveAspectRatio="xMidYMid slice">
  <!-- Coastline outline -->
  <path d="${coastlineD}" fill="none" stroke="currentColor" stroke-width="1.5" />

  <!-- Routes -->
  <g class="routes">
${routesSvg}
  </g>

  <!-- Markers -->
  <g class="markers" fill="currentColor" stroke="none">
${markersSvg}
  </g>
</svg>
`;

// ── Compute positions + CSS transform values ────────────
// Formula: tx = -(x - 50) * (scale - 1), ty = -(y - 50) * (scale - 1)
// This centers the target point in the viewport when scaled.

const MAP_SCALE = 2.8;

const locations = MARKERS.map((m) => {
  const projected = projection(m.coords);
  if (!projected) {
    console.error(`Failed to project ${m.name} at ${m.coords}`);
    process.exit(1);
  }

  const [px, py] = projected;
  const x = +((px / W) * 100).toFixed(2);
  const y = +((py / H) * 100).toFixed(2);
  const tx = +(-(x - 50) * (MAP_SCALE - 1)).toFixed(1);
  const ty = +(-(y - 50) * (MAP_SCALE - 1)).toFixed(1);

  return { ...m, x, y, tx, ty };
});

// ── Generate locations.json ─────────────────────────────
// Simple JSON — no TypeScript types needed. Used by HTML/CSS only.

const locationsJson = locations.map(({ coords, ...rest }) => rest);
await Bun.write("src/map/locations.json", JSON.stringify(locationsJson, null, 2));

// ── Render route overlay images ─────────────────────────
// Each route → transparent WebP, rendered by sharp from SVG (no manual parsing)

for (const route of ROUTES) {
  const routeGeoJSON = await Bun.file(route.file).json();
  const coords: [number, number][] = routeGeoJSON.geometry.coordinates;
  const pixels = coords
    .map((c: [number, number]) => projection(c))
    .filter(Boolean) as [number, number][];
  const d = smoothLine(pixels);
  if (!d) continue;

  // Create a minimal SVG with just this route on a transparent background
  const routeSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${terrainW}" height="${terrainH}">` +
    `<path d="${d}" fill="none" stroke="#1a1a5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,
  );

  // sharp renders the SVG properly — handles all bezier curves correctly
  await sharp(routeSvg)
    .resize(terrainW, terrainH)
    .webp({ quality: 90 })
    .toFile(`public/assets/route-${route.id}.webp`);

  const size = Bun.file(`public/assets/route-${route.id}.webp`).size;
  console.log(`Route ${route.id}: ${(size / 1024).toFixed(0)} KB → public/assets/route-${route.id}.webp`);
}

// ── Write SVG ───────────────────────────────────────────

await Bun.write("src/map/iceland.svg", svg);

// ── Output summary ──────────────────────────────────────

console.log(`Generated:
  src/map/iceland.svg     (${(svg.length / 1024).toFixed(1)} KB)
  src/map/locations.json  (${locations.length} locations)

Locations (scale: ${MAP_SCALE}):`);

for (const loc of locations) {
  console.log(
    `  ${loc.id}  ${loc.name.padEnd(18)}` +
    `  left: ${loc.x.toFixed(1).padStart(5)}%  top: ${loc.y.toFixed(1).padStart(5)}%` +
    `  → tx: ${loc.tx.toFixed(1).padStart(6)}  ty: ${loc.ty.toFixed(1).padStart(6)}`,
  );
}
