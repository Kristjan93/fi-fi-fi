# Iceland Interactive Map — Implementation Spec

> This document is the single source of truth for building the map feature.
> A new Claude Code instance should be able to execute any phase from this spec alone.
> Read `/map-workflow` skill and `docs/iceland-map-reference.md` first for full context.

---

## What this is

A design-studio homepage hero element. An interactive map of Iceland that zooms to locations when clicked. Shows terrain (hillshade), hiking route overlays, and location markers. Primary audience: iPad users. Also phones and desktop.

**Inspiration:** [kettmeir.com/alto-adige](https://www.kettmeir.com/alto-adige/)

**Stack:** Vanilla CSS + thin JS controller. No framework. GSAP for hero animation only.

---

## Phase 1: Layout & Container — "Make it fit every screen"

### Problem
Map is locked to 16:9 (`aspect-ratio: 1920/1080`). On iPad (4:3), it's a strip. On phones, unusable.

### Tasks

**1.1 — Regenerate terrain at 4:3**
In `scripts/generate-map.ts`:
- ViewBox: `1440×1080` (4:3) — matches iPad
- Padding: 25px (was 50px — Iceland fills the frame, not floating in ocean)
- Re-fetch ESRI terrain at new bbox
- Regenerate route overlays at new dimensions
- Update all computed positions (locations.json)

**1.2 — Responsive container**
```css
.map { height: 100dvh; overflow: hidden; display: flex; align-items: center; }
.map__inner { width: 100%; aspect-ratio: 4/3; max-height: 100%; position: relative; }
```
- iPad landscape (4:3): fills viewport exactly
- Desktop (16:9): map fills height, warm paper on sides
- iPad portrait (3:4): map fills width, warm paper above/below

**1.3 — Drop `<picture>`, use AVIF directly**
Replace `<picture><source><img></picture>` with `<img src="*.avif">`. AVIF has 97%+ support (Safari since iOS 16, 2022). Simpler HTML.

**1.4 — Move location data to `data/locations.json`**
Currently hardcoded in `generate-map.ts`. Move to its own file as the single source of truth. Build script reads from there.

**1.5 — Generate `src/map/locations.css`**
Build script outputs all per-location `:has()` rules:
- Transform values (--map-scale, --map-tx, --map-ty)
- Detail panel visibility
- Active button state
Never hand-write location-specific CSS again.

**1.6 — Marker touch targets**
Marker dots are 10px — way below the 44px Apple HIG minimum. The `<label>` wrapper needs `min-width: 44px; min-height: 44px` with the dot centered inside. Visible dot stays 10px, tappable area is 44px.

### Verify
- [ ] iPad landscape: map fills viewport, markers on correct locations
- [ ] Desktop 16:9: map centered, warm paper on sides
- [ ] iPad portrait: map visible, not a tiny strip
- [ ] All markers align with terrain features
- [ ] Route overlay aligns with markers and terrain

---

## Phase 2: Animation & Transitions — "Make it feel intentional"

### Animation Philosophy

**Every motion has purpose.** Nothing moves without a reason.

**Stagger, don't stack.** The eye tracks one thing at a time. Lead with the zoom, follow with supporting elements.

**Match the content.** Iceland is vast, geological, slow. Easing feels heavy and deliberate. Think glacier, not pinball.

### CSS Techniques

**`@property` for animatable custom properties** (already in use)
```css
@property --map-scale { syntax: '<number>'; inherits: false; initial-value: 1; }
```

**`transition-delay` for sequenced choreography**
```
ZOOM IN (location selected):
t=0ms      Zoom begins (--map-scale, --map-tx, --map-ty)
t=0ms      Markers fade out (opacity 0.5s)
t=0ms      Title fades out (opacity 0.4s)
t=400ms    Route overlay fades in (opacity 0.6s, delay 400ms)
t=600ms    Detail panel slides up (opacity + translateY 0.5s, delay 600ms)

ZOOM OUT (return to overview):
t=0ms      Detail panel slides down (0.4s)
t=0ms      Route fades out (0.4s)
t=200ms    Zoom to scale(1) begins (delay 200ms)
t=400ms    Markers fade in (delay 400ms, 0.5s)
t=500ms    Title fades in (delay 500ms, 0.4s)
```

**`@starting-style` + `transition-behavior: allow-discrete`**
Replace the `visibility 0s linear` hack with modern entry/exit:
```css
.map__detail {
  display: none;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease 0.6s,
              transform 0.5s ease 0.6s,
              display 0.5s allow-discrete;
}
.map:has(#map-rvk:checked) .map__detail[data-location="rvk"] {
  display: block;
  opacity: 1;
  transform: translateY(0);
  @starting-style { opacity: 0; transform: translateY(20px); }
}
```

**Easing tokens**
```css
.map {
  --ease-map: cubic-bezier(0.4, 0, 0.15, 1);   /* heavy, deliberate zoom */
  --ease-ui: cubic-bezier(0.25, 0.1, 0.25, 1);  /* responsive UI elements */
  --dur-zoom: 900ms;
  --delay-route: 400ms;
  --delay-detail: 600ms;
}
```

**`linear()` for subtle spring settle** (Chrome, Firefox, Edge, Safari 17.4+)
```css
--ease-zoom-spring: linear(0, 0.006, 0.024, 0.054, 0.096, 0.15, 0.216,
  0.294, 0.384, 0.486, 0.6, 0.726, 0.852, 0.966, 1.044, 1.086,
  1.098, 1.092, 1.074, 1.05, 1.026, 1.008, 0.996, 0.99, 0.988,
  0.99, 0.994, 0.998, 1);
```
Slight overshoot then settle — gives the zoom a physical quality. Falls back to `--ease-map` via `@supports`.

**Hover states** (desktop only)
```css
@media (hover: hover) {
  .marker__dot { transition: transform 0.2s var(--ease-ui); }
  .marker:hover .marker__dot { transform: scale(1.4); }
}
```

### Tasks

**2.1** — Define timing constants as CSS custom properties on `.map`
**2.2** — Implement staggered entrance/exit sequences with `transition-delay`
**2.3** — Replace `visibility` hack with `@starting-style` + `transition-behavior`
**2.4** — Add hover states on markers (gated behind `@media (hover: hover)`)
**2.5** — Add `prefers-reduced-motion` — all transitions instant, no delays
**2.6** — Route visibility tied to location: hide by default, show via `:has()` when associated location checked

### Verify
- [ ] Selecting a location → staggered entrance sequence
- [ ] Returning to overview → reverse sequence
- [ ] Switching locations → smooth pan + content swap
- [ ] Hover on desktop, no hover effect on touch
- [ ] `prefers-reduced-motion` → all instant
- [ ] Route only visible when relevant location active
- [ ] Tested in Chrome, Firefox, Safari

---

## Phase 3: JS Controller — "Handle what CSS can't"

### What JS does
Thin orchestration (~50 lines). CSS does all visuals. JS handles input that CSS cannot.

### Tasks

**3.1 — MapController class**
```ts
class MapController {
  constructor(container: HTMLElement) {
    document.addEventListener('keydown', this.onKey.bind(this));
  }
  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') this.selectAll();
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft') this.prev();
  }
  private selectAll() { /* check #map-all radio */ }
  private next() { /* cycle forward through locations */ }
  private prev() { /* cycle backward */ }
}
```

**3.2 — Prevent double-tap zoom on map section**
```css
.map { touch-action: manipulation; }
```

**3.3 — iPad touch target testing**
Verify all labels have ≥44px hit area. Test marker taps at overview and at zoom.

### Verify
- [ ] Escape returns to overview from any state
- [ ] Arrow keys cycle locations
- [ ] No double-tap zoom on map
- [ ] Touch targets ≥44px on iPad

---

## Phase 4: Device Adaptation — "Respect the screen"

### Tasks

**4.1 — Tablet portrait**
- Nav buttons move to bottom (thumb reach)
- Detail panel as bottom sheet overlay (not fixed bottom-right)
- Consider reduced zoom scale (2.8 → 2.0) to reduce clipping

**4.2 — Phone portrait (<640px width)**
Don't force interactive map. Instead:
- Static map image as a compact header
- Scrollable location cards below
- Each card: name, label, description
- The cards ARE the experience on phone

**4.3 — Large desktop (>1920px)**
- `max-width` on `.map__inner` so it doesn't grow absurdly
- UI elements cap at comfortable maximum sizes

### Verify
- [ ] iPad portrait: bottom nav, bottom sheet detail
- [ ] Phone: card list, no interactive zoom
- [ ] Ultrawide desktop: map centered, reasonable size

---

## Phase 5: Polish — "Leave nothing to chance"

**5.1** — Focus states on all interactive elements (`:focus-visible`)
**5.2** — Loading: warm paper bg shows instantly, terrain loads lazily
**5.3** — Performance: test on real iPad, measure zoom animation FPS
**5.4** — Accessibility: `aria-live` on location changes, keyboard-navigable, color contrast audit
**5.5** — `will-change: transform` only during animation (not permanent)

---

## References

| Document | Purpose |
|---|---|
| `docs/iceland-map-reference.md` | Full technical reference (D3, GeoJSON, ESRI, projection, layer architecture) |
| `docs/kettmeir-map-technique.md` | Reverse-engineered Kettmeir zoom blueprint |
| `docs/map-workflow.md` | Build pipeline workflow |
| `.claude/skills/map-workflow/` | Claude Code skill — invoke with `/map-workflow` |
| `CLAUDE.md` → "Iceland Map" section | Quick reference for commands, settings, alignment contract |
