# Map Zoom — Feature Decisions

> Documented 2026-03-26. Reference for the larger build.

---

## Goal

An interactive map section where clicking a location button zooms into that area of a map image. Clicking a different location pans to it. Clicking "All locations" zooms back out. The original inspiration is the Kettmeir winery site (see `kettmeir-map-technique.md`).

---

## Approaches Tried

### 1. GSAP (`map-zoom.ts`) — original

Used GSAP timelines to animate `transform: scale()` on `.map__image`, with `transform-origin` set per location. JS managed all state (active buttons, detail panels, marker visibility) via class toggles.

**Worked well:** Full control over timing, interruptible mid-animation, 3-phase location-to-location switching (zoom out → snap origin at scale 1 → zoom in). Transform-origin is invisible at scale(1), making the snap seamless.

**Downside:** Entirely JS-dependent. Map is inert without JavaScript.

### 2. CSS Transitions + JS (`map-zoom-css.ts`)

Replaced GSAP with native CSS transitions on `transform`. JS still managed state and used `transitionend` events to sequence the 3-phase switch.

**Worked well:** Simpler than GSAP, same visual result.

**Downside:** Still fully JS-dependent. Same architecture, different animation driver.

### 3. Pure CSS (final choice)

Radio buttons for state, `:has()` selectors to drive all visual changes, `@property` registered custom properties for animatable values. Zero JavaScript for the map.

**Location-to-location** is a smooth pan (translate interpolation at constant zoom) instead of the 3-phase zoom-out/zoom-in. This is a different feel from Kettmeir but works well.

---

## The translate+scale Technique

### Why not transform-origin?

With `transform-origin`, each location sets the zoom center:
```css
transform-origin: 72% 55%;
transform: scale(2.5);
```

This works perfectly with JS (snap origin at scale 1, it's invisible). But in pure CSS, switching `:has()` rules changes both `transform-origin` and `scale` simultaneously. CSS can't sequence "zoom out → snap origin → zoom in" — it would transition both properties at once, creating an arc/swing path.

### The alternative: fixed origin + translate

Keep `transform-origin: 50% 50%` (always center). Achieve the zoom offset with `translate()`:

```
tx = (1 - scale) * (originX - 50)%
ty = (1 - scale) * (originY - 50)%
transform: translate(tx, ty) scale(S)
```

At scale(1): tx=0, ty=0 for all locations (correct overview). At scale(2.5): each location has unique tx/ty values that produce the same visual as `transform-origin`.

The math works because tx is a **linear function of scale**. Interpolating both simultaneously via CSS transitions produces correct intermediate frames — the zoom path is mathematically identical to the transform-origin approach.

### Precalculated values

| Location      | originX | originY | tx (at 2.5) | ty (at 2.5) |
|--------------|---------|---------|-------------|-------------|
| pochi        | 72%     | 55%     | -33         | -7.5        |
| caldaro      | 72%     | 35%     | -33         | 22.5        |
| soprabolzano | 65%     | 25%     | -22.5       | 37.5        |

---

## State Management: Radio + `:has()` + `@property`

### How it works

Hidden radio inputs inside `.map__nav`. Labels styled as buttons. When a radio is checked, `:has(#map-pochi:checked)` matches on the `.map` ancestor and drives all state changes:

- **Map zoom:** Sets `--map-scale`, `--map-tx`, `--map-ty` on `.map__image`
- **Markers:** Hidden via `opacity: 0; visibility: hidden`
- **Title:** Faded out with `translateY(-20px)`
- **Detail panels:** Shown per-location
- **Active button:** Background fill

### Why `@property`?

CSS custom properties are normally not animatable — they change instantly. `@property` registers them with a type (`<number>`), enabling CSS transitions to interpolate between values. This is the core enabler of the entire pure-CSS approach.

```css
@property --map-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}
```

---

## Key Discoveries

### `transitionend` does NOT fire for `@property` custom properties

Tested in Chrome 2026. Setting `transition: --map-scale 200ms ease` and changing the value produces a smooth visual transition, but the `transitionend` event never fires. This means any JS sequencing based on `transitionend` for `@property` values is broken.

**Workaround:** Use `setTimeout` with the known duration. This is reliable but less precise (no compensation for frame timing or mid-animation interruption).

**Impact on this project:** This killed the JS progressive enhancement approach. The 3-phase zoom-out/zoom-in required sequencing two transitions, which needed `transitionend`. Without it, the JS enhancement couldn't work reliably.

### translate values are visible at scale(1)

With `transform-origin`, all origin values produce the same visual at `scale(1)` — the origin only matters when scaled. This makes the 3-phase "snap at scale 1" approach seamless.

With `translate + scale`, the translate values are **always visible**. `translate(-33%, -7.5%) scale(1)` shifts the map off-center. This means you can't "snap translate while at scale 1" like you can snap origin — the user would see the image jump.

**Consequence:** The JS 3-phase approach required transitioning translate to (0, 0) during zoom-out (not just holding it at the old value), then transitioning from (0, 0) to new values during zoom-in.

### Focus-scroll on hidden radio inputs

Clicking a `<label>` focuses its associated radio input. The browser scrolls to make the focused element visible. If the radio is positioned at the top of the section (via `.sr-only` with `position: absolute`), the page scrolls up on every click.

**Fix:** Place radio inputs physically inside `.map__nav` (adjacent to their labels). When the browser scrolls to focus them, it scrolls to the nav area, which is already in view.

### `getComputedStyle` timing in `change` handlers

When a radio `change` event fires, CSS `:has()` has already applied the new values. Calling `getComputedStyle` in the handler returns the **target** values, not the pre-change values. This broke proportional duration calculations (`proportionalDuration(2.5, 2.5) = 0ms`).

**Workaround:** Track values in JS variables (`lastScale`, `lastTx`, `lastTy`) instead of reading computed styles at change time.

---

## Accessibility Decisions

- **`prefers-reduced-motion: reduce`** — All transitions set to `transition: none`. Single grouped rule.
- **`input:focus-visible + .map__nav-btn`** — Keyboard focus ring on the label when radio is focused via Tab/arrow keys.
- **`role="radiogroup" aria-label="Select a location"`** — On `.map__nav` so screen readers understand the control group.
- **`aria-live="polite"`** — On `.map__details` container so screen readers announce location changes.
- **`aria-hidden="true"`** — On `.map__markers` because the markers are visual duplicates of the nav buttons (same radio targets). Avoids screen reader duplication. Pointer events still work (aria-hidden doesn't affect clicks).
- **`.sr-only`** — Visually hidden class for radio inputs. Uses `clip` + 1px sizing, NOT `display: none` (which removes from a11y tree). Defined in `style.css` as a global utility.
- **`draggable="false"` + `user-select: none` + `-webkit-user-drag: none`** — Prevents dragging the map image. `draggable` is the standard HTML attribute; `-webkit-user-drag` is still the only CSS-level mechanism in 2026 (no standard `user-drag` property exists).

---

## Final Architecture

```
No JS needed:
  radio :checked → :has() sets --map-scale/tx/ty → @property transition animates
  Location → Location = smooth pan (scale stays 2.5, translate interpolates)

Files:
  index.html         Radio inputs + labels + map layers
  src/map/map.css    @property, :has() rules, transitions, a11y
  src/style.css      .sr-only utility
  src/main.ts        Hero animation only (GSAP)
```

### What we gave up

The 3-phase zoom-out/zoom-in for location-to-location switches. Pure CSS can only do a smooth pan between zoomed locations. The 3-phase requires JS sequencing, but `transitionend` doesn't fire for `@property` values, and `setTimeout`-based sequencing was unreliable and felt wrong.

### What we gained

- Works without JavaScript
- ~0 KB JS for the map (hero GSAP is the only JS)
- Natively accessible (radio groups, keyboard nav, screen reader support)
- Reduced motion support
- No event listeners to clean up, no state to manage, no animation library
