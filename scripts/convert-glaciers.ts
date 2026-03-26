/**
 * Convert OSM glacier data to a single GeoJSON MultiPolygon.
 * Output: data/glaciers.geojson
 *
 * Usage: bun scripts/convert-glaciers.ts <overpass-json-file>
 * Get the file: curl -s "https://overpass-api.de/api/interpreter" \
 *   --data-urlencode 'data=[out:json][timeout:30];(relation["natural"="glacier"](63.3,-24.5,66.5,-13.5);way["natural"="glacier"](63.3,-24.5,66.5,-13.5););out body;>;out skel qt;' \
 *   -o data/raw/iceland-glaciers-overpass.json
 */

const inputFile = process.argv[2] || "data/raw/iceland-glaciers-overpass.json";
const data = await Bun.file(inputFile).json();

type Coord = [number, number];

const nodes = data.elements.filter((e: any) => e.type === "node");
const ways = data.elements.filter((e: any) => e.type === "way");
const rels = data.elements.filter((e: any) => e.type === "relation");

const nodeMap = new Map<number, Coord>(
  nodes.map((n: any) => [n.id, [n.lon, n.lat]]),
);
const wayMap = new Map<number, any>(ways.map((w: any) => [w.id, w]));

// Only the 7 major ice caps — not every tiny glacier tongue
const MAJOR_GLACIERS = [
  "Vatnajökull",
  "Langjökull",
  "Hofsjökull",
  "Mýrdalsjökull",
  "Eyjafjallajökull",
  "Snæfellsjökull",
  "Drangajökull",
];

const polygons: Coord[][] = [];

// Extract outer ways from major glacier relations only
for (const rel of rels) {
  const name = rel.tags?.name || "";
  if (!MAJOR_GLACIERS.includes(name)) continue;

  console.log(`  ${name}: ${rel.members.length} members`);

  const outers = rel.members.filter(
    (m: any) => m.type === "way" && (m.role === "outer" || m.role === ""),
  );

  for (const member of outers) {
    const way = wayMap.get(member.ref);
    if (!way) continue;
    const coords = way.nodes
      ?.map((id: number) => nodeMap.get(id))
      .filter(Boolean) as Coord[];
    if (coords && coords.length >= 4) {
      polygons.push(coords);
    }
  }
}

console.log(`Extracted ${polygons.length} glacier polygons`);

// Build MultiPolygon GeoJSON
const geojson = {
  type: "Feature",
  properties: { name: "Icelandic glaciers", source: "OpenStreetMap" },
  geometry: {
    type: "MultiPolygon",
    coordinates: polygons.map((ring) => [ring]),
  },
};

await Bun.write("data/glaciers.geojson", JSON.stringify(geojson));
const size = Bun.file("data/glaciers.geojson").size;
console.log(`Saved: data/glaciers.geojson (${(size / 1024).toFixed(0)} KB)`);

export {};
