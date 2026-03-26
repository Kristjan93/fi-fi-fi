/**
 * Convert OSM Overpass trail data to a clean single-path GeoJSON.
 *
 * The OSM relation has parallel alternatives at every fork. Instead of
 * naively stitching, this script builds a node graph from all ways and
 * finds the shortest path from the southernmost to northernmost point
 * (Þórsmörk → Landmannalaugar). Result is one clean, non-backtracking line.
 *
 * Simplification tolerance (TOLERANCE) controls smoothness:
 *   0.0002 ≈ 20m  — very smooth, ~300+ points
 *   0.0004 ≈ 40m  — smooth, ~180 points
 *   0.001  ≈ 100m — balanced, ~80 points
 *
 * Run: bun scripts/convert-trail.ts
 */

export {};

const TOLERANCE = 0.0004;

// ── Load ────────────────────────────────────────────────
// Usage: bun scripts/convert-trail.ts <overpass-json-file>
// Get the file: curl -s "https://overpass-api.de/api/interpreter" \
//   --data-urlencode 'data=[out:json];relation(1225037);(._;>;);out body;' \
//   -o data/raw/laugavegur-overpass.json

const inputFile = process.argv[2] || "data/raw/laugavegur-overpass.json";
const data = await Bun.file(inputFile).json();
const nodes = data.elements.filter((e: any) => e.type === "node");
const ways = data.elements.filter((e: any) => e.type === "way");
const rel = data.elements.find((e: any) => e.type === "relation");

type Coord = [number, number];
const nodeMap = new Map<number, Coord>(
  nodes.map((n: any) => [n.id, [n.lon, n.lat]]),
);
const wayMap = new Map(ways.map((w: any) => [w.id, w]));

// ── Build graph ─────────────────────────────────────────
// Each node connects to its neighbors in each way segment.
// Edge weight = geographic distance between nodes.

type Edge = { to: number; dist: number };
const graph = new Map<number, Edge[]>();

function addEdge(a: number, b: number) {
  const ca = nodeMap.get(a);
  const cb = nodeMap.get(b);
  if (!ca || !cb) return;
  const d = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]);
  if (!graph.has(a)) graph.set(a, []);
  if (!graph.has(b)) graph.set(b, []);
  graph.get(a)!.push({ to: b, dist: d });
  graph.get(b)!.push({ to: a, dist: d });
}

for (const member of rel.members) {
  if (member.type !== "way") continue;
  const way = wayMap.get(member.ref) as any;
  if (!way) continue;
  for (let i = 0; i < way.nodes.length - 1; i++) {
    addEdge(way.nodes[i], way.nodes[i + 1]);
  }
}

// Bridge gaps — connect way endpoints that are geographically close
// but don't share a node ID (OSM mapping artifacts)
const BRIDGE_THRESHOLD = 0.008; // ~800m
const wayEndpoints: { id: number; coord: Coord }[] = [];

for (const member of rel.members) {
  if (member.type !== "way") continue;
  const way = wayMap.get(member.ref) as any;
  if (!way) continue;
  const first = way.nodes[0];
  const last = way.nodes[way.nodes.length - 1];
  if (nodeMap.has(first)) wayEndpoints.push({ id: first, coord: nodeMap.get(first)! });
  if (nodeMap.has(last)) wayEndpoints.push({ id: last, coord: nodeMap.get(last)! });
}

let bridgeCount = 0;
for (let i = 0; i < wayEndpoints.length; i++) {
  for (let j = i + 1; j < wayEndpoints.length; j++) {
    const a = wayEndpoints[i]!;
    const b = wayEndpoints[j]!;
    if (a.id === b.id) continue;
    const d = Math.hypot(a.coord[0] - b.coord[0], a.coord[1] - b.coord[1]);
    if (d < BRIDGE_THRESHOLD) {
      addEdge(a.id, b.id);
      bridgeCount++;
    }
  }
}

console.log(`Graph: ${graph.size} nodes, bridged ${bridgeCount} gaps`);

// ── Find start and end nodes ────────────────────────────
// Southernmost node = Þórsmörk, northernmost = Landmannalaugar

let startId = 0, endId = 0;
let minLat = Infinity, maxLat = -Infinity;

for (const [id] of graph) {
  const coord = nodeMap.get(id);
  if (!coord) continue;
  if (coord[1] < minLat) { minLat = coord[1]; startId = id; }
  if (coord[1] > maxLat) { maxLat = coord[1]; endId = id; }
}

console.log(`Start (south): node ${startId} at ${nodeMap.get(startId)}`);
console.log(`End (north):   node ${endId} at ${nodeMap.get(endId)}`);

// ── Dijkstra's shortest path ────────────────────────────

const dist = new Map<number, number>();
const prev = new Map<number, number>();
const visited = new Set<number>();

dist.set(startId, 0);

// Simple priority queue (fine for <3000 nodes)
while (true) {
  let u = -1;
  let minD = Infinity;
  for (const [id, d] of dist) {
    if (!visited.has(id) && d < minD) {
      minD = d;
      u = id;
    }
  }
  if (u === -1 || u === endId) break;
  visited.add(u);

  for (const edge of graph.get(u) || []) {
    if (visited.has(edge.to)) continue;
    const newDist = minD + edge.dist;
    if (!dist.has(edge.to) || newDist < dist.get(edge.to)!) {
      dist.set(edge.to, newDist);
      prev.set(edge.to, u);
    }
  }
}

// Reconstruct path
const path: number[] = [];
let current = endId;
while (current !== startId) {
  path.unshift(current);
  const p = prev.get(current);
  if (p === undefined) {
    console.error("No path found!");
    process.exit(1);
  }
  current = p;
}
path.unshift(startId);

const coords: Coord[] = path.map((id) => nodeMap.get(id)!);
console.log(`Shortest path: ${coords.length} points`);

// ── Simplify ────────────────────────────────────────────

function simplify(pts: Coord[], tol: number): Coord[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let maxIdx = 0;
  const [sx, sy] = pts[0]!;
  const [ex, ey] = pts[pts.length - 1]!;

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]!;
    const dx = ex - sx;
    const dy = ey - sy;
    const len2 = dx * dx + dy * dy;
    const d =
      len2 === 0
        ? Math.hypot(px - sx, py - sy)
        : Math.abs(dy * px - dx * py + ex * sy - ey * sx) / Math.sqrt(len2);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tol) {
    const left = simplify(pts.slice(0, maxIdx + 1), tol);
    const right = simplify(pts.slice(maxIdx), tol);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0]!, pts[pts.length - 1]!];
}

const simplified = simplify(coords, TOLERANCE);
console.log(`Simplified: ${simplified.length} points (tolerance: ${TOLERANCE}°)`);

// Verify no backtracking
let reversals = 0;
for (let i = 2; i < simplified.length; i++) {
  const prevDir = simplified[i - 1]![1] - simplified[i - 2]![1];
  const currDir = simplified[i]![1] - simplified[i - 1]![1];
  if (prevDir * currDir < 0 && Math.abs(currDir) > 0.002) reversals++;
}
console.log(`Direction reversals: ${reversals} (should be low)`);

// ── Save ────────────────────────────────────────────────

const geojson = {
  type: "Feature",
  properties: { name: "Laugavegur", distance: "54km" },
  geometry: { type: "LineString", coordinates: simplified },
};

await Bun.write("data/laugavegur.geojson", JSON.stringify(geojson, null, 2));
console.log("Saved: data/laugavegur.geojson");
