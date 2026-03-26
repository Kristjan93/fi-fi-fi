# Map Workflow — Adding Locations & Routes

## Architecture

```
DATA (you edit)                    GENERATED (don't edit)              MANUAL (you edit)
─────────────────                  ─────────────────────              ────────────────────
data/locations.json                src/map/locations.css  ←────────── @import in map.css
data/routes/laugavegur.geojson     src/map/locations.json
                                   public/assets/iceland-map.webp
scripts/generate-map.ts            public/assets/route-*.webp
scripts/process-terrain.py
                                                                      index.html (structure)
                                                                      src/map/map.css (base styles)
```

## Single Source of Truth

All location data lives in ONE file: `data/locations.json`

```json
[
  {
    "id": "rvk",
    "name": "Reykjavík",
    "coords": [-21.9426, 64.1466],
    "label": "Höfuðborg",
    "info": "Norðurljós borgarinnar...",
    "routes": []
  },
  {
    "id": "tmk",
    "name": "Þórsmörk",
    "coords": [-19.52, 63.68],
    "label": "Dalur",
    "info": "Falinn dalur milli jökla...",
    "routes": ["laugavegur"]
  }
]
```

Route data lives in `data/routes/{id}.geojson` — one file per route.

---

## Adding a Location

1. Edit `data/locations.json` — add your entry
2. Run `bun run generate-map`
3. Done.

The build script:
- Computes x/y positions and tx/ty transform values
- Generates `src/map/locations.css` (all `:has()` rules)
- Generates HTML fragments in `src/map/fragments/` for copy-paste if structure changes
- Outputs `src/map/locations.json` (computed positions for reference)

## Adding a Route

1. Get GeoJSON — from OSM, GPX conversion, or manual coordinates
2. Save to `data/routes/{id}.geojson`
3. Link it in `data/locations.json` on the relevant location(s): `"routes": ["laugavegur"]`
4. Run `bun run generate-map`
5. Done — route image generated at `public/assets/route-{id}.webp`

## What `bun run generate-map` Produces

| Output | Purpose |
|--------|---------|
| `src/map/locations.json` | Computed x/y/tx/ty values |
| `src/map/locations.css` | All `:has()` CSS rules (transform values, detail panels, active buttons) |
| `public/assets/iceland-map.webp` | Terrain image (only if raw layers exist) |
| `public/assets/route-{id}.webp` | One transparent overlay per route |
| `src/map/iceland.svg` | Development preview SVG |
| Console output | HTML fragments for markers, details, nav |

## What You Still Edit Manually

- `index.html` — only when adding/removing locations (paste generated fragments)
- `src/map/map.css` — base styles only, never location-specific rules (those are in locations.css)

## File Structure

```
data/
  locations.json          ← THE source of truth for all locations
  iceland.geojson         ← coastline GeoJSON
  routes/
    laugavegur.geojson    ← one file per route
    fimmvorduhals.geojson

scripts/
  generate-map.ts         ← main build script
  convert-trail.ts        ← OSM → clean GeoJSON helper
  process-terrain.py      ← terrain image processing

src/map/
  map.css                 ← base map styles (layout, layers, transitions)
  locations.css           ← GENERATED — per-location CSS rules
  locations.json          ← GENERATED — computed positions
  iceland.svg             ← GENERATED — dev preview

public/assets/
  iceland-map.webp        ← terrain image
  iceland-map.avif        ← terrain AVIF
  route-laugavegur.webp   ← route overlay images
```
