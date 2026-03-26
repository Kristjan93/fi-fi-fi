# fi-website

Static landing page / experimental concept site. Vanilla TypeScript, CSS-first interactions. No framework.

## Stack

- **Bundler/Dev server:** Vite 8 (NOT Bun.serve — this is a static site, not a server app)
- **Runtime:** Bun 1.x (use `bun` for all package/script commands)
- **Language:** TypeScript (strict mode, ESNext target)
- **Animation:** GSAP 3.x (hero only). Prefer CSS transitions for stateful UI.
- **Styling:** Plain CSS with custom properties. No preprocessor, no Tailwind.
- **Fonts:** `--font-sans` and `--font-serif` custom properties in `:root`.

## Commands

```sh
bun run dev            # Start Vite dev server with HMR (opens browser)
bun run build          # Production build → dist/
bun run preview        # Preview production build locally
bun test               # Run tests (bun:test)
bun install            # Install dependencies
bun run generate-map   # D3 → SVG + locations.json + route images + raw terrain
bun scripts/seed-db.ts # Rebuild data/map.db (SQLite) from seed data
uv run scripts/process-terrain.py  # Python/Pillow → processed terrain AVIF
```

## Project Structure

```
index.html         # Entry point — Vite uses this as root
src/
  main.ts          # JS entry — hero animation
  style.css        # Global styles + utilities (.sr-only)
  map/
    map.css        # Map zoom — pure CSS (@property + :has() + radio buttons)
data/              # GeoJSON routes + map.db (SQLite, gitignored — rebuild via seed-db.ts)
scripts/           # Build-time scripts (D3 projection, terrain processing)
docs/              # Reference material + decision records
public/assets/     # Final images only (terrain AVIF, route WebP)
.build-cache/      # Intermediate raw PNGs (gitignored, NOT shipped to prod)
```

## Iceland Map

**Key docs — read these before touching the map:**
- `docs/iceland-map-reference.md` — full technical reference (D3, GeoJSON, ESRI, zoom mechanics)
- `docs/iceland-map-implementation-spec.md` — phased implementation plan (layout, animation, devices)
- `docs/kettmeir-map-technique.md` — reverse-engineered Kettmeir zoom blueprint
- `docs/map-zoom-decisions.md` — CSS-transition approach decision record
- `.claude/skills/map-workflow/` — skill for adding locations/routes (invoke `/map-workflow`)

**Terrain processing** (in `scripts/process-terrain.py`):
- Source: ESRI World Hillshade (free, no API key, cached in `.build-cache/`)
- Approach: hillshade only (no shaded relief composite — tested, looked worse)
- Settings: `max_dark=0.50`, S-curve `strength=0.7`, white background
- Output: AVIF only (no WebP fallback needed — AVIF supported in all evergreen browsers since 2022)

**Alignment contract:**
All layers share the same coordinate space via a locked aspect-ratio container.
Terrain image, route overlays, and HTML markers all use positions from the same D3 projection.
Markers use `transform: translate(-5px, -5px)` to center the dot on the geographic point (not top-left).
Breaking this (adding `object-fit: cover`, changing aspect ratio, or removing the translate) causes drift.

## Rules

- Keep it vanilla. No React, no UI framework. DOM + CSS.
- Prefer pure CSS for interactive state changes when possible and sensible.
- CSS: use custom properties for theming (`--color-bg`, `--color-text`, `--color-accent`).
- Performance first: no layout thrashing, prefer `transform`/`opacity` for animations.
- Browser support: all modern evergreen browsers. Use `dvh` units, `clamp()`, etc.
- Accessibility is structural, not polish. Follow WCAG 2.2 AA. Every interactive component ships with: `prefers-reduced-motion`, keyboard `focus-visible` styles, appropriate ARIA. This is part of the definition of done.
- Test visual behavior in the browser before claiming it works. Use browser automation tools to verify.
- Write Icelandic for any user-facing text unless otherwise specified.
- `docs/` contains both reference material and decision records — read before implementing related features.
