# Map Zoom Technique — Complete Reproduction Blueprint

> Reverse-engineered from **https://www.kettmeir.com/alto-adige/** on 2026-03-25.
> All data captured via MutationObserver, rAF polling, and computed style inspection on the live site.

---

## Purpose of This Document

This is a self-contained reference for reproducing the interactive map zoom technique used on the Kettmeir winery website. An AI or developer should be able to build a working version from this document alone, substituting their own map image and location data.

---

## How to Read This Document

1. **Concept** — understand what the user sees
2. **HTML** — the exact DOM structure (copy-paste ready)
3. **CSS** — every rule needed (copy-paste ready)
4. **JavaScript** — the state machine and animation logic (pseudocode + implementation notes)
5. **Data Model** — how locations are defined
6. **Assets** — image requirements and the original URLs
7. **Pitfalls** — what will break and why

---

## 1. Concept

A static map image inside a clipped container. Clicking a location button zooms into that area by CSS-scaling the image from a specific origin point. The UI (buttons, titles, detail panels) never moves — only the map image transforms.

### User Story

**First load:** The map section fills the viewport. The user sees the full map at `scale(1)` with marker dots on each location, a title, a subtitle, and a vertical column of nav buttons. One button ("All locations") is active.

**Click a location button:** The map smoothly zooms in (`scale(1)` → `scale(2.5)`) centered on that location (~900ms, ease-in-out). Marker dots fade out. A detail panel for that location fades in. The clicked button becomes active (filled background).

**Click a different location while zoomed:** The map zooms out to `scale(1)` (~1084ms), pauses (~520ms) while the zoom center invisibly snaps to the new location, then zooms back in to `scale(2.5)` (~1497ms). Old detail fades out, new detail fades in. Total: ~3.1 seconds.

**Click "All locations":** The map zooms out to `scale(1)` (~900ms). Markers fade back in. Detail panel disappears.

---

## 2. HTML Structure

```html
<!--
  The map is a single viewport-filling section.
  Four layers are stacked via position:absolute, but only ONE transforms.
-->
<section class="map">
  <!-- LAYER 1: The map image — THIS IS THE ONLY LAYER THAT TRANSFORMS -->
  <div class="map__image">
    <img class="map-image" src="your-map.webp" alt="Map" />
  </div>

  <!-- LAYER 2: Markers — absolute positioned, z-index above image, NEVER transforms -->
  <div class="map__markers">
    <!-- Each marker is positioned with inline left/top percentages -->
    <!-- These percentages correspond to where the location sits on the map at scale(1) -->
    <div class="marker" data-location="location-1" style="left: 68%; top: 54%;">
      <span class="marker__dot"></span>
      <span class="marker__label">LOCATION NAME</span>
    </div>
    <!-- ... more markers ... -->
  </div>

  <!-- LAYER 3: Detail panels — one per location, toggled via opacity -->
  <div class="map__details">
    <div class="map__detail" data-location="location-1">
      <span class="map__detail-label">REGION</span>
      <h3 class="map__detail-name">Location Name</h3>
      <p class="map__detail-info">Description text about this location.</p>
    </div>
    <!-- ... more details ... -->
  </div>

  <!-- LAYER 4: Static UI — title + nav buttons, NEVER transforms -->
  <div class="map__ui">
    <div class="map__header">
      <h2 class="map__title">EXPLORE<br />THE TERRITORY</h2>
      <p class="map__subtitle">Discover where our story unfolds.</p>
    </div>
    <div class="map__nav">
      <button class="map__nav-btn active" data-location="all">
        All locations
      </button>
      <button class="map__nav-btn" data-location="location-1">
        Location One
      </button>
      <button class="map__nav-btn" data-location="location-2">
        Location Two
      </button>
      <button class="map__nav-btn" data-location="location-3">
        Location Three
      </button>
    </div>
  </div>
</section>
```

### Why this structure

- `map__image` is the ONLY element that receives `transform`. Everything else is static.
- Markers are in a separate layer so they don't scale/move with the image. They align with the map only at `scale(1)`.
- Detail panels replace markers when zoomed — markers fade out, detail fades in.
- The UI layer uses `pointer-events: none` on the container with `pointer-events: auto` on interactive children, so the map image behind it remains clickable if needed.

---

## 3. CSS (Complete)

```css
/* ── Container ──────────────────────────────────────── */
.map {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden; /* CRITICAL: clips the scaled image */
  background-color: #c5bdb9; /* warm paper/stone tone */
}

/* ── Layer 1: Transformable map image ───────────────── */
.map__image {
  position: relative;
  width: 100%;
  height: 100%;
  mix-blend-mode: multiply; /* image blends into background color */
  transform: scale(1);
  transform-origin: 50% 50%; /* default center, overridden by JS */

  /*
   * OPTION A — CSS transition (simpler, no library needed):
   * Only transition 'transform'. NEVER transition 'transform-origin'.
   * Transitioning both simultaneously creates an arc/swing path.
   */
  transition: transform 1s cubic-bezier(0.45, 0, 0.55, 1);
  will-change: transform;

  /*
   * OPTION B — GSAP (what Kettmeir uses):
   * Set transition: none; and animate transform frame-by-frame.
   * This gives precise control over the 3-phase location-to-location sequence.
   */
}

.map__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Layer 2: Markers ───────────────────────────────── */
.map__markers {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none; /* let clicks pass through to buttons */
  transition: opacity 0.5s ease;
}

/* When zoomed, hide all markers */
.map.zoomed .map__markers {
  opacity: 0;
  visibility: hidden;
}

.marker {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
}

.marker__dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
}

.marker__label {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* ── Layer 3: Detail panels ─────────────────────────── */
.map__details {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.map__detail {
  position: absolute;
  bottom: 40px;
  right: 48px;
  width: 360px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(20px);
  transition:
    opacity 0.5s ease 0.4s,
    transform 0.5s ease 0.4s,
    visibility 0s linear 0.9s;
  pointer-events: none;
}

.map__detail.active {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
  transition:
    opacity 0.5s ease 0.4s,
    transform 0.5s ease 0.4s,
    visibility 0s linear 0s;
}

.map__detail-label {
  display: block;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.45;
  margin-bottom: 10px;
}

.map__detail-name {
  font-family: serif;
  font-weight: 300;
  font-size: clamp(32px, 3.5vw, 48px);
  line-height: 1.1;
  margin-bottom: 14px;
}

.map__detail-info {
  font-family: serif;
  font-weight: 300;
  font-style: italic;
  font-size: 16px;
  line-height: 1.6;
  opacity: 0.45;
}

/* ── Layer 4: Static UI ─────────────────────────────── */
.map__ui {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none; /* transparent to clicks */
  padding: 40px 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.map__header {
  pointer-events: auto;
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

/* Fade out title when zoomed */
.map.zoomed .map__header {
  opacity: 0;
  transform: translateY(-20px);
}

.map__title {
  font-family: serif;
  font-weight: 300;
  font-size: clamp(48px, 6vw, 88px);
  line-height: 1;
  text-transform: uppercase;
}

.map__subtitle {
  font-family: serif;
  font-weight: 300;
  font-style: italic;
  font-size: clamp(14px, 1.5vw, 20px);
  opacity: 0.45;
  margin-top: 10px;
}

/* ── Nav buttons ────────────────────────────────────── */
.map__nav {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 220px;
}

.map__nav-btn {
  display: block;
  padding: 9px 20px;
  border: 1.2px solid currentColor;
  border-radius: 28px;
  background: transparent;
  color: inherit;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-align: center;
  cursor: pointer;
  transition:
    background 0.35s ease,
    color 0.35s ease;
}

.map__nav-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.map__nav-btn.active {
  background: currentColor;
  /* Text color inverts — use a CSS variable or explicit color */
}
```

---

## 4. JavaScript Logic

### State Machine

```
States:
  OVERVIEW     → scale(1), markers visible, no detail panel
  ZOOMED(id)   → scale(2.5), markers hidden, detail panel for 'id' visible

Transitions:
  OVERVIEW → ZOOMED(id)       "zoom in"       ~900ms
  ZOOMED(id) → OVERVIEW       "zoom out"      ~900ms
  ZOOMED(a) → ZOOMED(b)       "switch"        ~3100ms (3 phases)
```

### Zoom In (OVERVIEW → ZOOMED)

```
1. Set transform-origin to the location's percentage coordinates
   (This is invisible because scale is still 1)
2. Set transform to scale(2.5)
   (CSS transition or GSAP animates this over ~900ms)
3. Add .zoomed class to .map (fades out markers, title)
4. Add .active class to the matching .map__detail
5. Update nav button active states
```

### Zoom Out (ZOOMED → OVERVIEW)

```
1. Set transform to scale(1)
   (CSS transition animates ~900ms)
   (transform-origin stays — doesn't matter at scale 1)
2. Remove .zoomed class from .map (fades markers back in)
3. Remove .active from all .map__detail elements
4. Set "All locations" button as active
```

### Switch Location (ZOOMED(a) → ZOOMED(b))

This is the hardest part. Two approaches:

#### Approach A — CSS transitions (simpler, slightly different feel)

```
1. Set transform to scale(1)           → CSS animates zoom out
2. Immediately set transform-origin to new location
   (since we never transition origin, it snaps — but scale is
    still animating down, so there may be a slight visual shift)
3. After zoom-out completes (transitionend event):
   Set transform to scale(2.5)         → CSS animates zoom in
4. Swap detail panels and button states
```

#### Approach B — GSAP (what Kettmeir does, smoother)

```
PHASE 1 (0–1084ms):
  Animate scale from 2.5 → 1.0
  Keep transform-origin at OLD location
  Easing: power2.inOut

PHASE 2 (1084–1604ms):
  Hold scale at 1.0
  SNAP transform-origin to NEW location (invisible at scale 1)
  ~520ms pause

PHASE 3 (1604–3100ms):
  Animate scale from 1.0 → 2.5
  Keep transform-origin at NEW location
  Easing: power2.inOut
```

### The Core Rule

> **NEVER CSS-transition `transform-origin`.**
>
> At `scale(1)`, all origins produce the same visual result. Change origin freely at scale 1.
> At `scale(>1)`, changing origin teleports the view. Only change origin while at scale 1.

---

## 5. Data Model

Each location needs:

```typescript
interface Location {
  id: string; // unique identifier
  name: string; // display name
  originX: number; // percentage (0–100) — horizontal position on map
  originY: number; // percentage (0–100) — vertical position on map
  label: string; // category/type label
  info: string; // description text
}
```

`originX` and `originY` define where on the map image to zoom into. They become `transform-origin: {originX}% {originY}%`.

These are also used for marker positioning: `left: {originX}%; top: {originY}%`. This way markers visually sit on top of their zoom target at `scale(1)`.

### Kettmeir's actual location data (extracted from DOM)

```
Pochi di Salorno:         left: 68%    top: 54%     → transform-origin: 72% 55%
Castelvecchio / Caldaro:  left: ~55%   top: ~35%    → transform-origin: 72% 35%
Soprabolzano:             left: ~60%   top: ~25%    → transform-origin: ~65% ~25%
```

Note: marker `left/top` and `transform-origin` are close but not identical. Origin can be tweaked to frame the zoomed view better — the zoom center doesn't have to be exactly on the marker dot.

---

## 6. Assets

### Original Kettmeir assets (for reference only)

```
Desktop map:    https://www.kettmeir.com/dist/assets/map2x.webp       (5120×2776)
Desktop border: https://www.kettmeir.com/dist/assets/map-borders.webp  (2560×1388)
Mobile map:     https://www.kettmeir.com/dist/assets/map-mobile.webp   (1125×1995)
Mobile border:  https://www.kettmeir.com/dist/assets/map-borders-mobile.webp (1125×1995)
```
> **Note:** URLs updated 2026-03-25. Site moved from `/apps/app/dist/images/` to `/dist/assets/`.

### Image requirements for your own version

| Property         | Requirement                                                                                            | Why                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Resolution**   | Width ≥ viewport × scale factor. For 2560px viewport at 2.5× zoom: ≥ 6400px ideal, ≥ 5120px acceptable | Image gets magnified by the scale factor; too small = blurry  |
| **Format**       | WebP preferred, PNG acceptable                                                                         | WebP is ~30% smaller at same quality                          |
| **Style**        | Works best with illustrated/artistic maps. Satellite imagery also works but needs more resolution      | Illustrated styles forgive slight blur at zoom                |
| **Aspect ratio** | Should match or exceed viewport ratio (16:9 or wider)                                                  | `object-fit: cover` handles mismatch but crops content        |
| **Color**        | Greyscale or muted tones work best with `mix-blend-mode: multiply`                                     | Multiply blends the image luminance into the background color |

### The mix-blend-mode: multiply trick

The map image has `mix-blend-mode: multiply` on its container. This means:

- White pixels in the image → show the background color (#c5bdb9)
- Black pixels → stay black
- Grey pixels → darken the background proportionally

This gives a "printed on paper" look. The warm background color bleeds through the lighter parts of the map. No Photoshop needed — the browser does it live.

---

## 7. Animation Timing (Captured Data)

### Easing curve

GSAP `power2.inOut` — CSS equivalent: **`cubic-bezier(0.45, 0, 0.55, 1)`**

Normalized progress (0→1) over time:

```
Time%   Progress   Description
0%      0.000      ┐
5%      0.000      │ slow start
10%     0.002      │
15%     0.004      │
20%     0.009      ┘
25%     0.016      ┐
30%     0.026      │ accelerating
35%     0.043      │
40%     0.066      │
45%     0.098      ┘
50%     0.141      ┐
55%     0.201      │ fastest
60%     0.277      │ (50% progress at ~58% time)
65%     0.377      │
70%     0.500      ┘ ← midpoint
75%     0.623      ┐
80%     0.723      │ decelerating
85%     0.799      │
90%     0.857      │
95%     0.902      ┘
100%    1.000        end
```

### Durations

| Transition                    | Duration | Scale range     |
| ----------------------------- | -------- | --------------- |
| Overview → Location           | ~900ms   | 1.0 → 2.5       |
| Location → Overview           | ~900ms   | 2.5 → 1.0       |
| Location → Location (total)   | ~3100ms  | 2.5 → 1.0 → 2.5 |
| Phase 1: zoom out             | ~1084ms  | 2.5 → 1.0       |
| Phase 2: pause (origin snaps) | ~520ms   | holds ~1.0      |
| Phase 3: zoom in              | ~1497ms  | 1.0 → 2.5       |

Phase 3 is longer than Phase 1 — the zoom-in feels more deliberate/cinematic than the zoom-out.

---

## 8. Pitfalls

### CRITICAL: The transform-origin transition bug

```css
/* BAD — creates an arc/swing path */
.map__image {
  transition:
    transform 1s ease,
    transform-origin 1s ease;
}

/* GOOD — origin snaps, only scale animates */
.map__image {
  transition: transform 1s cubic-bezier(0.45, 0, 0.55, 1);
  /* transform-origin is NOT in the transition list */
}
```

When both properties transition simultaneously, the browser interpolates each independently. The origin slides from A to B while scale changes from 1 to 2.5. The math produces an arc — the zoom center moves during the zoom. It looks broken.

### Markers must NOT be inside the transforming layer

If markers are children of `.map__image`, they scale and translate with the map. A 10px dot becomes 25px. Text becomes huge. Positions shift. Put markers in a sibling layer with `position: absolute` and percentage-based coordinates.

### Image resolution at zoom

At `scale(2.5)` on a 1920px viewport, the browser renders the image at 4800px equivalent. If your source image is only 1920px, every pixel becomes 2.5 pixels — visibly blurry. Minimum: source width = viewport width × 2. Ideal: source width = viewport width × scale factor.

### Location-to-location teleport

Snapping `transform-origin` while at `scale(2.5)` causes the visible region to instantly jump. The 3-phase dance (zoom out → snap origin → zoom in) is mandatory for smooth transitions.

### z-index stacking

The scaled map image can visually overlap UI elements even though they're in a different layer. Ensure the UI layer has a higher `z-index` than the map image layer.

### Browser repaints during scale animation

`transform` is GPU-composited (no repaints). But `mix-blend-mode: multiply` can force the browser to re-composite on every frame. On low-end devices, consider removing blend mode during animation and re-applying after.

---

## 9. Adaptation Notes

To build your own version, you need to provide:

1. **A map image** — illustrated, satellite, or terrain. See image requirements in section 6.
2. **A background color** — chosen to complement the image via `mix-blend-mode: multiply`.
3. **Location data** — an array of `{ id, name, originX, originY, label, info }` objects.
4. **Your own fonts and colors** — the technique is style-agnostic.

The core mechanism (CSS scale + origin on a clipped container) works with any content — it doesn't have to be a map. It could be an architectural drawing, a product photo, an infographic, or any image where "zoom to point of interest" makes sense.
