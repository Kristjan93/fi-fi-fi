/**
 * generate-map.ts — Build-time SVG generator.
 *
 * Reads GeoJSON coastline data, projects it with D3, and outputs:
 *   1. src/map/iceland.svg   — static SVG coastline + routes + markers (dev preview)
 *   2. src/map/locations.json — location data with computed x/y/tx/ty values
 *   3. public/assets/route-*.webp — transparent route overlay images
 *
 * Run: bun scripts/generate-map.ts
 * D3 is a devDependency — nothing here ships to the browser.
 */

import { geoMercator, geoPath } from "d3-geo";
import { line, curveCatmullRom } from "d3-shape";
import sharp from "sharp";
import type { FeatureCollection } from "geojson";

// ── Config ──────────────────────────────────────────────

const W = 1440; // 4:3 for iPad landscape (was 1920)
const H = 1080;
const PADDING = 25; // Iceland fills the frame (was 50)

// Huts from SQLite — single source of truth
import { openMapDb, getHuts, getTrailsForHut, getAttractionsForHut } from "./map-data";

const db = openMapDb();
const huts = getHuts(db);

const MARKERS = huts.map((h) => ({
  id: h.id,
  name: h.name,
  coords: [h.lon, h.lat] as [number, number],
  label: h.label,
  info: h.info,
  beds: h.beds,
  elevation: h.elevation,
  open: h.open,
  source: h.source,
  trails: getTrailsForHut(db, h.id),
  attractions: getAttractionsForHut(db, h.id),
}));

db.close();

// Routes — loaded from GeoJSON files in data/
// Generated from OSM via scripts/convert-trail.ts, simplified with Douglas-Peucker
const ROUTES: { id: string; name: string; file: string }[] = [
  { id: "laugavegur", name: "Laugavegurinn", file: "data/laugavegur.geojson" },
];

// ── Load GeoJSON ────────────────────────────────────────

const geojson: FeatureCollection = await Bun.file(
  "data/iceland.geojson",
).json();

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

// Only fetch if cache doesn't exist (terrain is deterministic for fixed config)
const cacheExists = await Bun.file(".build-cache/raw-hillshade.png").exists();

let hillshadeBuffer: Buffer;
if (cacheExists && !process.argv.includes("--force")) {
  console.log("Using cached terrain (pass --force to re-fetch)");
  hillshadeBuffer = Buffer.from(await Bun.file(".build-cache/raw-hillshade.png").arrayBuffer());
} else {
  console.log("Fetching ESRI hillshade terrain...");
  const hillshadeRes = await fetch(hillshadeUrl);
  hillshadeBuffer = Buffer.from(await hillshadeRes.arrayBuffer());
  console.log(`Hillshade: ${(hillshadeBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
}

// Coastline mask — white land, transparent ocean
const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${terrainW}" height="${terrainH}" viewBox="0 0 ${W} ${H}">` +
  `<path d="${coastlineD}" fill="white"/>` +
  `</svg>`,
);
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

// Save raw layers to .build-cache/ (NOT public/ — avoids shipping to prod)
await sharp(hillshadeBuffer).resize(terrainW, terrainH).png().toFile(".build-cache/raw-hillshade.png");
await sharp(maskSvg).resize(terrainW, terrainH).png().toFile(".build-cache/raw-mask.png");
if (glacierMaskSvg) {
  await sharp(Buffer.from(glacierMaskSvg)).resize(terrainW, terrainH).png().toFile(".build-cache/raw-glaciers.png");
}
console.log("Raw layers saved → .build-cache/");
console.log("Run: uv run scripts/process-terrain.py");

// ── Generate SVG ────────────────────────────────────────

// Build route paths — project to pixels, then smooth with Catmull-Rom curves
const smoothLine = line<[number, number]>()
  .x((d) => d[0])
  .y((d) => d[1])
  .curve(curveCatmullRom.alpha(0.5));

// Project + smooth each route once — reused for SVG preview AND route image rendering
const routePaths = await Promise.all(
  ROUTES.map(async (route) => {
    const routeGeoJSON = await Bun.file(route.file).json();
    const coords: [number, number][] = routeGeoJSON.geometry.coordinates;
    const pixels = coords
      .map((c) => projection(c))
      .filter(Boolean) as [number, number][];
    const d = smoothLine(pixels);
    return { ...route, d };
  }),
);

const routesSvg = routePaths
  .filter((r) => r.d)
  .map(
    (r) => `  <path d="${r.d}" class="route" data-route="${r.id}"
        fill="none" stroke="currentColor" stroke-width="2"
        opacity="0.5" />`,
  )
  .join("\n");

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

// ── Compute positions + per-hut zoom scale ──────────────
// Formula: tx = -(x - 50) * (scale - 1), ty = -(y - 50) * (scale - 1)
// This centers the target point in the viewport when scaled.
//
// Adaptive zoom: huts in dense clusters (Laugavegur) get higher zoom
// so each hut has visual space. Isolated huts get the base scale.

const BASE_SCALE = 2.8;
const MAX_SCALE = 5.0;
const DENSE_THRESHOLD = 5; // % distance — huts closer than this get boosted

// First pass: project all huts to get coordinates
const projected = MARKERS.map((m) => {
  const p = projection(m.coords);
  if (!p) {
    console.error(`Failed to project ${m.name} at ${m.coords}`);
    process.exit(1);
  }
  const x = +((p[0] / W) * 100).toFixed(2);
  const y = +((p[1] / H) * 100).toFixed(2);
  return { ...m, x, y };
});

// Second pass: compute nearest-neighbor distance and adaptive scale
const locations = projected.map((loc, i) => {
  let minDist = Infinity;
  for (let j = 0; j < projected.length; j++) {
    if (i === j) continue;
    const dx = loc.x - projected[j].x;
    const dy = loc.y - projected[j].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) minDist = dist;
  }

  // Scale: dense clusters get higher zoom, isolated huts stay at base
  let scale: number;
  if (minDist < DENSE_THRESHOLD / 2) scale = MAX_SCALE;
  else if (minDist < DENSE_THRESHOLD) scale = 4.0;
  else scale = BASE_SCALE;

  const tx = +(-(loc.x - 50) * (scale - 1)).toFixed(1);
  const ty = +(-(loc.y - 50) * (scale - 1)).toFixed(1);

  return { ...loc, scale, tx, ty };
});

// ── Compute clusters ────────────────────────────────────
// Groups of nearby huts. Geometry: bounding circle + radial label positions.
// Standalone huts (not in any cluster) get direct labels.

const CLUSTER_DEFS = [
  { id: "laugavegur", name: "Laugavegurinn", huts: ["lml-hut", "hrf", "alf", "hvg", "ems", "tmk-hut", "fmv"] },
  { id: "kjolur", name: "Kjölur", huts: ["hvt", "tvb", "tjd"] },
  { id: "langjokull", name: "Langjökull", huts: ["hgv", "hld"] },
  { id: "hornstrandir", name: "Hornstrandir", huts: ["hrn", "nfj"] },
];

const clusteredHutIds = new Set(CLUSTER_DEFS.flatMap((c) => c.huts));
const standaloneHuts = locations.filter((l) => !clusteredHutIds.has(l.id));

const clusters = CLUSTER_DEFS.map((def) => {
  const members = def.huts.map((id) => locations.find((l) => l.id === id)!);

  // Bounding circle: centroid + radius
  const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
  let cy = members.reduce((s, m) => s + m.y, 0) / members.length;
  const maxDist = Math.max(...members.map((m) => Math.sqrt((m.x - cx) ** 2 + (m.y - cy) ** 2)));
  const radius = maxDist + 7; // padding in % units — room for bigger text rings

  // Radial labels: angle from centroid to each hut, label placed on circle edge
  const labels = members.map((m) => {
    const angle = Math.atan2(m.y - cy, m.x - cx);
    // Label position: on the circle edge + offset outward
    const labelDist = radius + 1.5;
    const lx = +(cx + Math.cos(angle) * labelDist).toFixed(2);
    const ly = +(cy + Math.sin(angle) * labelDist).toFixed(2);
    // Text anchor: left of center → right-align, right → left-align
    const anchor = Math.cos(angle) < -0.1 ? "end" : Math.cos(angle) > 0.1 ? "start" : "middle";
    return { hutId: m.id, name: m.name, x: m.x, y: m.y, lx, ly, angle: +(angle * 180 / Math.PI).toFixed(1), anchor };
  });

  // Zoom for cluster view
  const clusterScale = 3.5;
  // Shift camera slightly toward the center of the hut spread for better framing
  const ySpread = Math.max(...members.map(m => m.y)) - Math.min(...members.map(m => m.y));
  // Nudge centroid down by 20% of the spread so top huts aren't clipped
  cy = +(cy + ySpread * 0.15).toFixed(2);

  return {
    id: def.id,
    name: def.name,
    cx: +cx.toFixed(2),
    cy: +cy.toFixed(2),
    radius: +radius.toFixed(2),
    scale: clusterScale,
    labels,
    hutIds: def.huts,
  };
});

// ── Generate cluster SVG ────────────────────────────────
// Dashed circle boundary + concentric text rings (one per hut name).
// Each ring rotates around the cluster center. Alternating directions.

function clusterSvg(cluster: typeof clusters[0]): string {
  const cxPx = (cluster.cx / 100) * W;
  const cyPx = (cluster.cy / 100) * H;
  const rPx = (cluster.radius / 100) * Math.min(W, H);

  // Group names onto rings — 3 per ring for big clusters, last ring gets remainder
  const groups: typeof cluster.labels[] = [];
  const labels = [...cluster.labels];
  while (labels.length > 0) {
    const take = labels.length >= 4 ? 3 : labels.length;
    groups.push(labels.splice(0, take));
  }

  // Baseline at rPx-20. Letters extend ~14px outward → tops at rPx-6 (inside boundary).
  const outerStart = rPx - 22;
  const ringSpacing = 24; // consistent px between each ring
  const minRadius = 20;

  const rings = groups.map((group, i) => {
    const r = Math.max(minRadius, outerStart - i * ringSpacing);
    const pathId = `${cluster.id}-r${i}`;
    const d = `M ${(cxPx - r).toFixed(1)},${cyPx.toFixed(1)} a ${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${(r * 2).toFixed(1)},0 a ${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${(-r * 2).toFixed(1)},0`;

    const dir = i % 2 === 0 ? "cw" : "ccw";

    // Distribute names around the circle, accounting for word length
    const names = group.map((l) => l.name.split(" / ")[0].toUpperCase());
    const totalChars = names.reduce((s, n) => s + n.length, 0);
    const circumference = 2 * Math.PI * r;
    const charWidth = 15; // measured average px per char at 18px font-weight:700 uppercase
    const textPortion = (totalChars * charWidth) / circumference; // fraction of circle used by text
    const gapPortion = 1 - textPortion; // fraction left for gaps
    const gapEach = gapPortion / group.length; // equal gap between each name

    let offset = 2; // start offset in %
    const texts = group.map((label, j) => {
      const name = names[j];
      const thisOffset = `${Math.round(offset)}%`;
      // Advance by this name's portion + one gap
      const namePortion = (name.length * charWidth) / circumference;
      offset += (namePortion + gapEach) * 100;
      return `      <text class="cluster__ring-text" data-hut="${label.hutId}"><textPath href="#${pathId}" startOffset="${thisOffset}">${name}</textPath></text>`;
    });

    const hutIds = group.map((l) => l.hutId).join(",");

    return `    <path id="${pathId}" d="${d}" fill="none" stroke="none" />
    <g class="cluster__ring cluster__ring--${dir}" data-huts="${hutIds}" style="transform-origin: ${cxPx.toFixed(1)}px ${cyPx.toFixed(1)}px">
${texts.join("\n")}
    </g>`;
  });

  return `  <g class="cluster-group" data-cluster="${cluster.id}">
    <circle cx="${cxPx.toFixed(1)}" cy="${cyPx.toFixed(1)}" r="${rPx.toFixed(1)}" class="cluster__circle" />
    <text x="${cxPx.toFixed(1)}" y="${(cyPx + 5).toFixed(1)}" class="cluster__name" text-anchor="middle">${cluster.name}</text>
${rings.join("\n")}
  </g>`;
}

const clustersSvg = `<svg class="map__clusters" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
${clusters.map(clusterSvg).join("\n")}
</svg>`;

await Bun.write("src/map/clusters.svg", clustersSvg);
console.log(`  src/map/clusters.svg  (${clusters.length} clusters)`);

// ── Generate locations.json ─────────────────────────────
// Full hut data + cluster data — used for HTML generation and MapController.

const locationsJson = locations.map(({ coords, ...rest }) => rest);
const outputData = {
  huts: locationsJson,
  clusters,
  standalone: standaloneHuts.map((h) => ({ id: h.id, name: h.name, x: h.x, y: h.y })),
};
await Bun.write("src/map/locations.json", JSON.stringify(outputData, null, 2));

// ── Generate locations.css ──────────────────────────────
// Detail panel visibility only. Transforms are handled by MapController (JS).
// Generic rules (marker hide, header hide) stay in hand-written map.css.

const locationsCss = [
  `/* Auto-generated by generate-map.ts — do not edit */\n`,
  ...locations.map((loc) => {
    const id = loc.id;
    return `.map:has(#map-${id}:checked) .map__detail[data-location="${id}"] {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
  transition:
    opacity 0.5s ease 0.4s,
    transform 0.5s ease 0.4s,
    visibility 0s linear 0s;
}
`;
  }),
].join("\n");

await Bun.write("src/map/locations.css", locationsCss);

// ── Render route overlay images ─────────────────────────
// Reuses pre-computed paths from above. Sharp renders SVG → WebP.

for (const route of routePaths) {
  if (!route.d) continue;

  const routeSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${terrainW}" height="${terrainH}">` +
    `<path d="${route.d}" fill="none" stroke="#1a1a5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`,
  );

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
  src/map/locations.json  (${locations.length} huts)
  src/map/locations.css   (per-hut CSS rules)

Huts (adaptive zoom ${BASE_SCALE}–${MAX_SCALE}):`);

for (const loc of locations) {
  console.log(
    `  ${loc.id.padEnd(10)}  ${loc.name.padEnd(28)}` +
    `  left: ${loc.x.toFixed(1).padStart(5)}%  top: ${loc.y.toFixed(1).padStart(5)}%` +
    `  scale: ${loc.scale.toFixed(1)}` +
    `  → tx: ${loc.tx.toFixed(1).padStart(6)}  ty: ${loc.ty.toFixed(1).padStart(6)}`,
  );
}
