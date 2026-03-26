// Analyze the OSM trail data for gaps between segments
const data = await Bun.file("/private/tmp/claude-501/laugavegur-full.json").json();
const nodes = data.elements.filter((e: any) => e.type === "node");
const ways = data.elements.filter((e: any) => e.type === "way");
const rel = data.elements.find((e: any) => e.type === "relation");

const nodeMap = new Map(nodes.map((n: any) => [n.id, [n.lon, n.lat]]));
const wayMap = new Map(ways.map((w: any) => [w.id, w]));

let prevEnd: [number, number] | null = null;
let segIdx = 0;

for (const member of rel.members) {
  if (member.type !== "way") continue;
  const way = wayMap.get(member.ref) as any;
  if (!way) continue;

  const first = nodeMap.get(way.nodes[0]) as [number, number];
  const last = nodeMap.get(way.nodes[way.nodes.length - 1]) as [number, number];

  if (prevEnd && first) {
    const dist = Math.hypot(first[0] - prevEnd[0], first[1] - prevEnd[1]);
    if (dist > 0.0001) {
      console.log(`GAP at segment ${segIdx} — ${(dist * 111).toFixed(1)}km`);
      console.log(`  prev end:   [${prevEnd}]`);
      console.log(`  next start: [${first}]`);
    }
  }
  prevEnd = last;
  segIdx++;
}
console.log(`\nTotal segments: ${segIdx}`);

export {};
