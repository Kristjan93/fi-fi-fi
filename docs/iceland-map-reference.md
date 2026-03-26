# Iceland Interactive Map — Complete Reference

> **Purpose**: Design studio homepage hero element. Not a utility map.
> **Inspiration**: [kettmeir.com/alto-adige](https://www.kettmeir.com/alto-adige/) — zoom-to-location map with CSS transforms.
> **Runtime**: Bun (not Node). See project `CLAUDE.md` for Bun conventions.

---

## 1. Map Data Source

### The GeoJSON

Coastline data from [iceland-geodata](https://github.com/baldurh/iceland-geodata) by Baldur Helgason. Derived from the National Land Survey of Iceland (NLSI). Coordinate system: WGS84 `[longitude, latitude]`.

```
https://raw.githubusercontent.com/baldurh/iceland-geodata/master/country/{level}/iceland.geojson
```

| Level | Vertices | Islands | File size | Notes |
|-------|----------|---------|-----------|-------|
| `/1/` | 266,651 | ~2,800 | 11.4 MB | Scientific. Way too heavy for browser rendering. |
| `/10/` | 97,425 | ~1,200 | 4.2 MB | Detailed but laggy during CSS transform animations. |
| `/100/` | 11,685 | 583 | 516 KB | **Good balance.** Used in the current prototype. |
| `/1000/` | 962 | 10 | 42 KB | Minimal silhouette. Good for a hero element. |

The file is one `FeatureCollection` with one `Feature` containing a `MultiPolygon` (mainland + all islands).

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": { "GAGNAEIGAN": "LMI" },
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [
        [[[lon, lat], [lon, lat], ...]],  // mainland
        [[[lon, lat], ...]],              // island 1
        [[[lon, lat], ...]]               // island 2 ...
      ]
    }
  }]
}
```

### Also available from the same repo

- `regions/{level}/regions.geojson` — administrative regions with boundaries
- `points/towns/towns.geojson` — 114 named settlements, 18 KB
- Every level also available as `.topojson` (smaller, needs d3-topojson or similar to convert)

---

## 2. How D3 Converts GeoJSON to Pixels

This is how the **current prototype** works. D3 runs in the browser at page load.

### The pipeline

```
[lon, lat] → d3.geoMercator() → [pixel_x, pixel_y] → d3.geoPath() → SVG <path d="M...">
```

### Key code

```ts
import * as d3 from 'd3';

// Load GeoJSON
const geojson = await fetch('.../country/100/iceland.geojson').then(r => r.json());

// Fit the projection to the viewport with 80px padding on each side
const projection = d3.geoMercator()
  .fitExtent([[80, 80], [W - 80, H - 80]], geojson);

// Create path generator — converts GeoJSON features to SVG path strings
const path = d3.geoPath().projection(projection);

// Render coastline
svg.selectAll('path')
  .data(geojson.features)
  .enter()
  .append('path')
  .attr('d', path);
```

`fitExtent` auto-calculates `scale` and `translate` so the full geography fills the given bounding box. No manual centering needed.

### Placing markers at geographic coordinates

```ts
const [px, py] = projection([-21.9426, 64.1466]);  // Reykjavík → pixel position
```

The same projection that draws the coastline places the markers. This guarantees accuracy — the dot always sits exactly on the coastline shape.

### The problem

- **d3 bundle**: ~133 KB minified (we import all of d3)
- **GeoJSON fetch**: 516 KB for `/100/` detail level
- **Runtime SVG generation**: hundreds of `<path>` elements generated in JS on every page load
- All of this SVG geometry gets GPU-composited during CSS `transform: scale()` animations. More paths = more lag.

---

## 3. How Zoom Works (The Kettmeir Technique)

### How Kettmeir does it

Their map at `kettmeir.com/alto-adige/` is a **static WebP image** (`map2x.webp`, 5120x2776 natural resolution). They use GSAP for animation. Markers are HTML divs positioned with CSS. No D3. No GeoJSON. No projection math in the browser.

### The three CSS properties

```css
.map {
  overflow: hidden;         /* clips the scaled content to the viewport */
}

.map__image {
  transform: scale(1);           /* 1 = zoomed out, 2.8 = zoomed in */
  transform-origin: 50% 50%;    /* the point that stays pinned during scale */
  transition: transform 1.2s cubic-bezier(0.4, 0, 0.15, 1);
  will-change: transform;        /* pre-allocate GPU compositor layer */
}
```

That's the entire zoom mechanism. No map library. No tile loading. Just CSS scale on a container.

### Zoom in (JS)

```ts
function zoomTo(originX: string, originY: string) {
  // originX/Y = marker's pixel position as a percentage of the container
  mapImage.style.transformOrigin = `${originX}% ${originY}%`;
  mapImage.style.transform = 'scale(2.8)';
}
```

### Zoom out (JS)

```ts
function zoomOut() {
  mapImage.style.transform = 'scale(1)';
  // transform-origin stays where it was — doesn't matter at scale(1)
}
```

### How originX/Y are calculated

```ts
const [px, py] = projection(marker.coords);          // pixel position from D3
const originX = ((px / containerWidth) * 100).toFixed(1);   // as percentage
const originY = ((py / containerHeight) * 100).toFixed(1);
```

### Critical pitfall: NEVER transition transform-origin

```css
/* BAD — causes a swooping arc motion */
transition: transform 1.2s ease, transform-origin 1.2s ease;

/* GOOD — origin snaps instantly, only scale animates */
transition: transform 1.2s cubic-bezier(0.4, 0, 0.15, 1);
```

When both properties transition simultaneously, the browser interpolates each independently. The origin slides from point A to point B while scale changes — the result is a bizarre arc, not a clean zoom.

### User interaction story

1. **Page loads** → map at `scale(1)`, full Iceland visible, all markers shown, "All locations" button active.
2. **Click "Reykjavík"** → `transform-origin` snaps to Reykjavík's percentage position, `transform` transitions from `scale(1)` to `scale(2.8)`. Map smoothly zooms in. Detail panel slides up. Title fades out.
3. **Click "Akureyri" while zoomed** → `transform-origin` snaps to Akureyri. CSS interpolates `transform` from current position. Map slides to new location. No blocking — rapid clicks work fine because CSS transitions are inherently interruptible (the browser interpolates from whatever the current computed value is).
4. **Click "All locations" or "← Back"** → `transform` transitions back to `scale(1)`. Detail panel slides out. Title fades back in.

---

## 4. Layer Architecture

### Current HTML structure

```html
<section id="map" class="map">               <!-- overflow: hidden -->
  <div id="map-image" class="map__image">     <!-- THIS transforms (scale + origin) -->
    <!-- SVG generated by D3 at runtime -->
  </div>

  <div class="map__ui">                       <!-- position: absolute, z-index: 10 -->
    <div class="map__title">                  <!-- pointer-events: auto -->
      <h1 class="map__heading">Iceland</h1>
      <p class="map__sub">Explore the land of fire and ice.</p>
    </div>
    <nav id="map-nav" class="map__nav">       <!-- pointer-events: auto -->
      <a class="map__nav-btn active" data-target="all">All locations</a>
      <!-- marker buttons generated by JS -->
    </nav>
  </div>

  <div id="detail-panel" class="detail-panel"> <!-- position: absolute, z-index: 20 -->
    <button id="back-btn" class="detail-panel__back">← Back</button>
    <div class="detail-panel__content">
      <span id="detail-label" class="detail-panel__label"></span>
      <h2 id="detail-name" class="detail-panel__name"></h2>
      <p id="detail-info" class="detail-panel__info"></p>
      <span id="detail-coords" class="detail-panel__coords"></span>
    </div>
  </div>
</section>
```

### SVG layer order (inside `.map__image`)

```
svg (width/height = viewport)
├── defs > clipPath#iceland-clip     ← coastline shape, used to clip terrain imagery
├── image.terrain-satellite          ← ESRI satellite, clip-path to coastline (currently commented out)
├── image.terrain-hillshade          ← ESRI hillshade, clip-path to coastline (currently commented out)
├── g.glacier-group                  ← 7 glacier polygons (Vatnajökull, Langjökull, etc.)
│   └── path.glacier (×7)
├── g (coastline)                    ← stroke-only paths from GeoJSON
│   └── path.coastline
└── g (markers)                      ← dots + labels at projected positions
    └── g.marker[data-id] (×7)
        ├── circle.marker-ring       ← hover ring (r=12, opacity 0 → 0.6)
        ├── circle.marker-dot        ← filled dot (r=4)
        └── text.marker-label        ← "REYKJAVÍK"
```

**Key principle**: `map__image` transforms. The UI layer (`map__ui`, `detail-panel`) does NOT transform — it stays fixed via `position: absolute` + `z-index`.

---

## 5. Design Tokens & CSS

```css
:root {
  --bg: #ddd8cf;                      /* warm paper */
  --ink: #1a1a5c;                     /* navy blue */
  --ink-light: rgba(26, 26, 92, 0.45);
}
```

Fonts:
- **Headings**: `'Cormorant Garamond'` weight 300 (loaded from Google Fonts)
- **UI / Labels**: `-apple-system, 'Helvetica Neue', sans-serif`

Easing: `cubic-bezier(0.4, 0, 0.15, 1)` — fast start, long gentle deceleration. Feels natural and premium.

---

## 6. Terrain Imagery (ESRI)

ESRI ArcGIS Map Server exports raster tiles at any bounding box and resolution. **Free, no API key, CORS-enabled.**

### Converting D3 bounds to ESRI bbox

D3 uses WGS84 (EPSG:4326). ESRI expects Web Mercator (EPSG:3857).

```ts
function toWebMercator(lon: number, lat: number): [number, number] {
  const x = lon * 20037508.34 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360))
            / (Math.PI / 180) * 20037508.34 / 180;
  return [x, y];
}

const nw = projection.invert!([0, 0])!;       // top-left pixel → [lon, lat]
const se = projection.invert!([W, H])!;       // bottom-right pixel → [lon, lat]
const [x0, y0] = toWebMercator(nw[0], nw[1]);
const [x1, y1] = toWebMercator(se[0], se[1]);
```

### URL pattern

```
https://server.arcgisonline.com/arcgis/rest/services/{SERVICE}/MapServer/export
  ?bbox={x0},{y1},{x1},{y0}
  &bboxSR=3857&size={width},{height}&imageSR=3857&format=png32&transparent=true&f=image
```

### Available services

| Service | URL path | Look |
|---------|----------|------|
| Hillshade | `Elevation/World_Hillshade` | Greyscale elevation shading |
| Satellite | `World_Imagery` | Color aerial photos |
| Shaded Relief | `World_Shaded_Relief` | Terrain with subtle coloring |

### Resolution for zoom

At `scale(2.8)`, each CSS pixel becomes ~8 rendered pixels. Request images at 2-4x viewport size:

```ts
const imgW = Math.round(W * 4);  // 4x = crisp at 2.8x zoom, but ~12MP = heavy GPU
const imgH = Math.round(H * 4);  // 2x = slight blur at max zoom, but much lighter
```

### Clipping imagery to the coastline

Without clipping, the terrain rectangle covers ocean too.

```ts
const clip = defs.append('clipPath').attr('id', 'iceland-clip');
clip.selectAll('path').data(geojson.features).enter().append('path').attr('d', path);

svg.append('image')
  .attr('href', terrainURL)
  .attr('clip-path', 'url(#iceland-clip)');
```

### mix-blend-mode

**Yes, it works.** Apply on the `.map__image` container:

```css
.map__image { mix-blend-mode: multiply; }
```

White terrain areas become the background color (`#ddd8cf`). Dark terrain lines stay dark. This gives a "printed on warm paper" look — same technique Kettmeir uses.

For individual layers inside the SVG:

```css
.terrain-satellite { filter: grayscale(0.85) contrast(1.1); opacity: 0.7; }
.terrain-hillshade { mix-blend-mode: multiply; opacity: 0.6; }
```

---

## 7. Current Marker Data

```ts
const MARKERS = [
  { id: 'rvk', name: 'Reykjavík',       coords: [-21.9426, 64.1466], label: 'Capital' },
  { id: 'tmk', name: 'Þórsmörk',        coords: [-19.52,   63.68],  label: 'Valley' },
  { id: 'jkl', name: 'Jökulsárlón',     coords: [-16.18,   64.08],  label: 'Glacier Lagoon' },
  { id: 'lml', name: 'Landmannalaugar', coords: [-19.07,   63.98],  label: 'Highlands' },
  { id: 'snf', name: 'Snæfellsjökull',  coords: [-23.77,   64.81],  label: 'Glacier Volcano' },
  { id: 'aku', name: 'Akureyri',        coords: [-18.10,   65.68],  label: 'The North' },
  { id: 'myt', name: 'Mývatn',          coords: [-16.96,   65.60],  label: 'Volcanic' },
];
```

### Current glacier polygon data (approximate hand-drawn outlines)

7 glaciers: Vatnajökull, Langjökull, Hofsjökull, Mýrdalsjökull, Eyjafjallajökull, Snæfellsjökull, Drangajökull. Each defined as a `[lon, lat][]` polygon. See `src/main.ts` lines 29-37 for exact coordinates.

---

## 8. GPS Routes

### Yes, this map can display routes

D3's `geoPath` renders any GeoJSON `LineString` using the same projection as the coastline. The route is automatically accurate.

```ts
const route = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [-19.07, 63.98],  // Landmannalaugar (start)
      [-19.15, 63.92],  // waypoint
      [-19.30, 63.85],  // waypoint
      [-19.52, 63.68],  // Þórsmörk (end)
    ]
  }
};

svg.append('path')
  .datum(route)
  .attr('d', path)       // same path generator as coastline
  .attr('fill', 'none')
  .attr('stroke', '#c45a3c')
  .attr('stroke-width', 2)
  .attr('stroke-dasharray', '6 3');
```

### GPX file conversion

GPX → GeoJSON: use [togeojson.mapbox.com](https://mapbox.github.io/togeojson/) or `@mapbox/togeojson` npm package.

### Performance concern

A GPS track can have thousands of coordinate pairs = a complex SVG path. During `transform: scale()` animations, the browser composites all paths. Simplify routes before rendering — Mapshaper can reduce 10,000 points to ~200 with minimal visual difference.

---

## 9. The Recommended Approach: Build-Time SVG

### The idea

Use D3 at **build time only** (a Bun script that runs once). Output a static SVG with everything pre-baked. Ship zero D3 to the browser.

### Why

| | D3 Runtime (current) | Build-Time SVG (proposed) |
|---|---|---|
| JS bundle | ~133 KB (d3) | 0 KB |
| Network | 516 KB GeoJSON fetch | 0 (SVG is in the HTML) |
| Runtime work | Parse JSON, projection math, generate DOM | Zero |
| Zoom perf | Hundreds of SVG paths being GPU-transformed | Same SVG paths, but could use fewer |
| Accuracy | Perfect | Identical — same projection, just pre-computed |

### The build script: `generate-map.ts`

```ts
// Run: bun generate-map.ts
// Outputs: public/assets/iceland.svg + src/marker-positions.json
import * as d3 from 'd3';

const geojson = await Bun.file('data/iceland.geojson').json();

const W = 1000;
const H = 800;
const PADDING = 40;

const projection = d3.geoMercator()
  .fitExtent([[PADDING, PADDING], [W - PADDING, H - PADDING]], geojson);
const path = d3.geoPath().projection(projection);

// Generate coastline path data
const coastlineD = geojson.features.map(f => path(f)).filter(Boolean);

// Generate marker positions as percentages
const MARKERS = [
  { id: 'rvk', name: 'Reykjavík', coords: [-21.9426, 64.1466] },
  // ... all markers
];

const positions = MARKERS.map(m => {
  const [px, py] = projection(m.coords);
  return {
    ...m,
    originX: ((px / W) * 100).toFixed(2),
    originY: ((py / H) * 100).toFixed(2),
    svgX: px.toFixed(1),
    svgY: py.toFixed(1),
  };
});

// Generate route path data (if GPX/GeoJSON routes exist)
// const routeD = path(routeGeoJSON);

// Write static SVG
const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <g id="coastline">
    ${coastlineD.map(d => `<path d="${d}" />`).join('\n    ')}
  </g>
  ${positions.map(m => `
  <g id="loc-${m.id}" class="location" data-origin-x="${m.originX}" data-origin-y="${m.originY}">
    <circle cx="${m.svgX}" cy="${m.svgY}" r="4" class="marker-dot" />
    <circle cx="${m.svgX}" cy="${m.svgY}" r="12" class="marker-ring" />
    <text x="${parseFloat(m.svgX) + 16}" y="${parseFloat(m.svgY) + 4}" class="marker-label">${m.name.toUpperCase()}</text>
  </g>`).join('')}
</svg>`;

await Bun.write('public/assets/iceland.svg', svg);
await Bun.write('src/marker-positions.json', JSON.stringify(positions, null, 2));

console.log('Generated iceland.svg and marker-positions.json');
```

### Grouping by location (recommended)

Instead of separate layers for coastline/markers/routes, group everything by location:

```svg
<svg viewBox="0 0 1000 800">
  <g id="coastline">
    <path d="M..." />
  </g>

  <!-- Each location is self-contained -->
  <g id="loc-laugavegur" class="location"
     data-origin-x="42.1" data-origin-y="72.5">
    <path class="route" d="M... L... L..." />
    <circle cx="410" cy="620" r="4" class="marker-dot" />
    <text x="426" y="624" class="marker-label">LANDMANNALAUGAR</text>
    <circle cx="445" cy="695" r="4" class="marker-dot" />
    <text x="461" y="699" class="marker-label">ÞÓRSMÖRK</text>
  </g>

  <g id="loc-reykjavik" class="location"
     data-origin-x="32.1" data-origin-y="74.2">
    <circle cx="321" cy="594" r="4" class="marker-dot" />
    <text x="337" y="598" class="marker-label">REYKJAVÍK</text>
  </g>
</svg>
```

Benefits:
- Toggle visibility per location with one CSS rule: `.location { opacity: 0.3; } #loc-reykjavik { opacity: 1; }`
- `data-origin-x/y` attributes store zoom targets — JS reads them directly, no lookup needed
- Routes and their markers are one unit

### Adding routes to the build script

```ts
// Convert GPX to GeoJSON first (use @mapbox/togeojson)
import { gpx } from '@mapbox/togeojson';

const gpxFile = await Bun.file('data/laugavegur.gpx').text();
const routeGeoJSON = gpx(new DOMParser().parseFromString(gpxFile, 'text/xml'));

// Simplify (reduce 10,000 points to ~200)
// Use mapshaper CLI: mapshaper route.geojson -simplify 2% -o route-simple.geojson

const routeD = path(routeGeoJSON.features[0]);
// Include routeD as a <path> in the location group
```

### Runtime code (zero D3)

```ts
// No imports needed. SVG is inline in the HTML.
const mapImage = document.getElementById('map-image')!;
const mapSection = document.getElementById('map')!;

// Click handler for location groups
document.querySelectorAll('.location').forEach(loc => {
  loc.addEventListener('click', () => {
    const el = loc as SVGElement;
    mapImage.style.transformOrigin = `${el.dataset.originX}% ${el.dataset.originY}%`;
    mapImage.style.transform = 'scale(2.8)';
    mapSection.classList.add('zoomed');
  });
});
```

### SVG responsiveness

`viewBox="0 0 1000 800"` makes the SVG scale to any container size. All internal coordinates are relative to the viewBox.

For a full-viewport hero, control aspect ratio:

```css
/* Option A: letterbox (default) */
svg { width: 100%; height: 100%; }
/* preserveAspectRatio="xMidYMid meet" is the default — map centers, letterboxes */

/* Option B: fill and crop (more "hero" feeling) */
svg { width: 100%; height: 100%; }
/* Set preserveAspectRatio="xMidYMid slice" on the SVG element */

/* Option C: fixed aspect ratio container */
.map { aspect-ratio: 1000 / 800; width: 100%; }
```

---

## 10. Performance Tricks

- **`will-change: transform`** on the transforming layer — promotes to its own GPU compositor layer
- **Only transition `transform`**, never `transform-origin` — avoids the swooping arc bug
- **`overflow: hidden`** on `.map` — clips scaled content to viewport
- **`pointer-events: none`** on `.map__ui`, `pointer-events: auto` on clickable children — lets clicks pass through to the map layer where needed
- **`mix-blend-mode: multiply`** on `.map__image` — GPU-composited blending for the warm paper effect
- **Terrain images at 2-4x resolution** for crisp zoom, but watch GPU memory (4x = ~12MP per image)
- **Use `/1000/` detail** (42 KB, 962 vertices) unless fjord detail is needed — massively fewer SVG paths to composite
- **Simplify GPS routes** before baking into SVG — 200 points looks identical to 10,000 at hero scale
- **`decoding="async"`** on terrain images — decode off main thread
- **`cubic-bezier(0.4, 0, 0.15, 1)`** — the easing curve. Fast start, long gentle deceleration.
- **Don't block rapid clicks** — CSS transitions are inherently interruptible. No `isAnimating` guards needed. The browser interpolates from the current computed value to the new target.
- **Percentage-based transforms** (`translate(0%, 50%)` not `translate(0px, 32px)`) avoid sub-pixel text blur during animation

---

## 11. Known Issues & Lessons Learned

1. **GeoJSON 404**: The repo URL structure is `country/{level}/iceland.geojson`, not `iceland.geojson` at root.
2. **Container 0×0 at init**: `DOMContentLoaded` fires before CSS is applied in some browsers. Use `window.addEventListener('load', ...)` + `requestAnimationFrame`.
3. **Terrain image covers ocean**: Must use SVG `<clipPath>` from the coastline to mask the terrain rectangle.
4. **Blurry terrain at zoom**: 1x viewport-resolution images look terrible at 2.8x scale. Need 2-4x source resolution.
5. **Transitioning transform-origin**: Causes a bizarre swooping arc. Only transition `transform`.
6. **Blocking clicks with `isAnimating`**: Fights the browser. CSS transitions handle interruption natively. Remove all JS animation guards.
7. **Large GeoJSON = laggy transforms**: `/10/` level (4.2 MB, 97k vertices) creates thousands of SVG path segments. Every one of them is composited during `transform: scale()` transitions. Use `/1000/` or `/100/` and let the SVG be simple.

---

## 12. File URLs

```
# Coastline GeoJSON (pick ONE)
https://raw.githubusercontent.com/baldurh/iceland-geodata/master/country/1000/iceland.geojson   # 42 KB
https://raw.githubusercontent.com/baldurh/iceland-geodata/master/country/100/iceland.geojson    # 516 KB

# Towns
https://raw.githubusercontent.com/baldurh/iceland-geodata/master/points/towns/towns.geojson     # 18 KB

# ESRI terrain (free, no API key, CORS-enabled)
https://server.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/export
https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export
https://server.arcgisonline.com/arcgis/rest/services/World_Shaded_Relief/MapServer/export

# Tools
https://mapshaper.org/                        # GeoJSON → SVG, simplification, merging layers
https://mapbox.github.io/togeojson/           # GPX → GeoJSON conversion
```

---

## 13. Summary for Implementation

**If starting fresh, do this:**

1. Download `/1000/iceland.geojson` (42 KB) locally.
2. Write `generate-map.ts` — a Bun script that uses D3 to project the GeoJSON + markers + routes into a static SVG with `viewBox="0 0 1000 800"`. Group content by location. Store `data-origin-x/y` on each group.
3. Run the script once. Output: `iceland.svg` file.
4. Inline the SVG in your HTML inside a `.map__image` div.
5. Add the nav buttons and detail panel as static HTML (same structure as current prototype).
6. CSS: `overflow: hidden` on `.map`, `transform` + `transition` + `will-change` on `.map__image`. Blend mode if using terrain imagery.
7. JS: ~30 lines. Read `data-origin-x/y` from clicked location group, set `transform-origin` and `transform: scale(2.8)`. Back button sets `scale(1)`.
8. **D3 is a devDependency only. Zero JS shipped to the browser for the map.**
