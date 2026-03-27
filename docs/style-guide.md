# fi-website Style Guide

> Comprehensive visual and brand style guide, heavily inspired by [Kettmeir Alto Adige](https://www.kettmeir.com/alto-adige/).
> Extracted and adapted 2026-03-26.
>
> **Active development:** This project is evolving. Tokens, values, and patterns described here
> may change as features are built. Treat this document as a living reference, not a frozen spec.

---

## 1. Design Philosophy

The design language is rooted in **restraint, materiality, and editorial craft**. Every choice serves a single goal: make the content feel *printed on fine paper* rather than rendered on a screen.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Monochrome warmth** | A two-color system (dark text on warm stone) creates cohesion and luxury without relying on vibrant color |
| **Serif-first typography** | Serif faces carry all heading and body text, creating an editorial/literary feel |
| **Generous whitespace** | Sections breathe with large vertical padding; content never feels crowded |
| **CSS-first interaction** | Animations use CSS transitions and `@property`. No JS animation libraries. |
| **Material honesty** | `mix-blend-mode: multiply` makes images feel like inkprints on the background, not floating cards |

---

## 2. Color Palette

### Primary Colors

The Kettmeir reference uses a navy-on-stone palette. The fi-website currently uses dark brown on stone for the map section, while the global styles still use a dark-theme placeholder. The final palette should converge on one of these directions.

**Kettmeir reference values (navy):**

| Token | Hex | RGB | Role |
|-------|-----|-----|------|
| `--color-navy` | `#00205B` | `rgb(0, 32, 91)` | Primary text, headings, borders, UI |
| `--color-stone` | `#C5BDB9` | `rgb(197, 189, 185)` | Primary background — warm paper/sandstone |
| `--color-stone-light` | `#DFD9D2` | `rgb(223, 217, 210)` | Secondary background — lighter warm tone |

**Current fi-website map values (dark brown):**

| Token | Hex | Role |
|-------|-----|------|
| `--map-bg` | `#C5BDB9` | Map background (matches Kettmeir stone) |
| `--map-text` | `#2A2520` | Map text/UI — warm dark brown |

**Current fi-website global values (dark theme placeholder):**

| Token | Hex | Role |
|-------|-----|------|
| `--color-bg` | `#0A0A0A` | Global background — dark |
| `--color-text` | `#F0F0F0` | Global text — light |
| `--color-accent` | `#646CFF` | Accent — placeholder blue |

> **Decision needed:** Should the global palette shift to the warm stone (Kettmeir-inspired) or retain a darker direction? The map section is already stone-based.

### Accent Colors

| Token | Hex | RGB | Role |
|-------|-----|-----|------|
| `--color-gold` | `#DFB977` | `rgba(223, 185, 119, 0.8)` | Accent — warm gold for highlights and active states |
| `--color-overlay-dark` | — | `rgba(36, 35, 32, 0.6)` | Dark overlay for images and modals |
| `--color-overlay-stone` | — | `rgba(197, 189, 185, 0.95)` | Semi-transparent stone for panels over content |

### Usage Rules

- **Text** should be the primary dark color on light backgrounds. Never use pure black (`#000`).
- **Backgrounds** alternate between stone and stone-light to create subtle section separation.
- **Borders** use the primary text color at 1px weight. No grey borders.
- **Active/filled states** invert: dark background, light text (as seen in `.map__nav-btn` active state).
- The palette is intentionally limited. Do not introduce new colors without strong justification.

### The Multiply Trick

Images use `mix-blend-mode: multiply` on their container (already implemented in `.map__image`). This means:
- White pixels in the image show the background color
- Dark pixels darken the background proportionally
- The result looks like a print on textured paper

---

## 3. Typography

### Font Stack

**Kettmeir reference:**

| Role | Family | Weights | Style |
|------|--------|---------|-------|
| **Display** | Flecha Bronzea M | 400 | Normal |
| **Text** | Flecha M | 300, 400 | Normal, Italic |
| **UI/Label** | Verlag | 300 (Book), 700 (Bold) | Normal |

**Adaptation for fi-website:** Flecha and Verlag are commercial typefaces. Use the project's existing `--font-serif` and `--font-sans` custom properties. Suitable open-source alternatives:

| Original | Alternative |
|----------|------------|
| Flecha Bronzea M (display) | Playfair Display, Cormorant Garamond, or Lora |
| Flecha M (text) | Source Serif 4, Crimson Pro, or Libre Baskerville |
| Verlag (labels) | Inter, DM Sans, or the system font stack |

**Current fi-website values:**
- `--font-sans`: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- `--font-serif`: Georgia, "Times New Roman", serif

### Type Scale

All sizes use `clamp()` for fluid responsiveness. The scale is derived from observed Kettmeir values at a 1536px viewport.

| Token | Min | Preferred | Max | Used For |
|-------|-----|-----------|-----|----------|
| `--text-display` | 3rem | 9.5vw | 9.1rem | Page title (h1) |
| `--text-section` | 2.5rem | 8vw | 7.6rem | Section headings (h2) |
| `--text-subsection` | 1.8rem | 5.5vw | 5.3rem | Secondary headings (h2/h3) |
| `--text-feature` | 1.4rem | 3.75vw | 3.6rem | Feature headings (h4) |
| `--text-lead` | 1.1rem | 1.65vw | 1.6rem | Lead paragraphs, large body |
| `--text-body` | 0.9rem | 1.1vw | 1.05rem | Body text |
| `--text-nav` | 0.85rem | 1vw | 1rem | Navigation links |
| `--text-small` | 0.7rem | 0.82vw | 0.79rem | Labels, footer, metadata |
| `--text-tiny` | 0.45rem | 0.55vw | 0.53rem | Legal text, fine print |

**Existing map typography** (already implemented):
- `.map__title`: `clamp(48px, 6vw, 88px)`, serif, weight 300, uppercase
- `.map__detail-name`: `clamp(32px, 3.5vw, 48px)`, serif, weight 300
- `.map__nav-btn`: 10.5px, weight 500, letter-spacing 0.16em, uppercase
- `.marker__label`: 9px, weight 600, letter-spacing 0.2em, uppercase

### Type Treatment

| Element | Font | Weight | Case | Letter Spacing | Line Height |
|---------|------|--------|------|----------------|-------------|
| h1 (page title) | Display serif | 400 | UPPERCASE | -0.015em | 0.78 |
| h2 (section) | Display serif | 400 | UPPERCASE | -0.015em | 0.85 |
| h3 (subsection) | Display serif | 400 | UPPERCASE | -0.015em | 1.0 |
| h4 (feature) | Text serif | 400 | UPPERCASE | normal | 1.1 |
| Body (lead) | Text serif | 400 | Sentence | normal | 1.08 |
| Body (standard) | Text serif | 300-400 | Sentence | normal | 1.28 |
| Body (italic) | Text serif | 300 italic | Sentence | normal | 1.28 |
| Nav links | Text serif | 400 | UPPERCASE | normal | 1.0 |
| Labels | Sans-serif | 300 | UPPERCASE | -0.028em | 1.0 |
| Footer links | Sans-serif | 300 | UPPERCASE | -0.028em | 1.22 |

### Key Typographic Rules

1. **Negative tracking on display type.** Large headings (h1-h3) use tight letter-spacing (`-0.015em`). Creates a compressed, architectural quality.
2. **All headings are uppercase.** No exceptions. Defining characteristic of the brand.
3. **Body text is never uppercase.** The contrast between uppercase headings and sentence-case body creates clear hierarchy.
4. **Italic for emphasis and subtlety.** Light italic (weight 300) for subtitles and secondary information.
5. **No bold in body text.** Use italic, color, or larger size instead.
6. **Line-height compresses at larger sizes.** Display headings use 0.78-0.85, body uses 1.08-1.28.

---

## 4. Spacing System

### Section Spacing

Sections use generous vertical padding to create a breathing, editorial rhythm.

| Token | Value | Used For |
|-------|-------|----------|
| `--space-section-top` | `clamp(6rem, 13vw, 12.4rem)` | Top padding of major sections |
| `--space-section-bottom` | `clamp(5rem, 9.5vw, 9.2rem)` | Bottom padding of major sections |
| `--space-content-gap` | `clamp(2rem, 4vw, 3.5rem)` | Gap between content blocks within a section |
| `--space-gutter` | `clamp(1.5rem, 3vw, 3rem)` | Horizontal page gutter / edge padding |

**Existing map spacing:** `.map__ui` uses `padding: 40px 48px` (desktop), `24px 20px` (mobile at 480px).

### Component Spacing

| Token | Value | Used For |
|-------|-------|----------|
| `--space-xs` | `0.25rem` | Tight gaps (icon + text) |
| `--space-sm` | `0.5rem` | Within-component gaps |
| `--space-md` | `1rem` | Standard element spacing |
| `--space-lg` | `2rem` | Between related elements |
| `--space-xl` | `4rem` | Between distinct content groups |

### Layout Rules

- **Full-viewport sections.** Hero and map sections use `100dvh`. This viewport unit can be swapped to `100vh`, `100svh`, or `100lvh` depending on desired mobile behavior — `dvh` is the current default but is configurable per section.
- **Alternating layouts.** Image-text pairs alternate direction: image-left/text-right, then text-left/image-right.
- **No grid framework.** Layouts use flexbox for alignment and percentage widths for columns.
- **Horizontal gutter:** 48px at desktop, scales down via clamp.

---

## 5. Component Patterns

### Navigation (Header)

- Horizontal bar, flex with `justify-content: space-between`
- Logo left, links right
- Links: serif font, uppercase, no underline
- Current page indicated by visual weight or underline (not color change)
- No hamburger on desktop; collapses to mobile menu at narrow viewports

### Pill Buttons (Map Navigation)

Already implemented in `.map__nav-btn`. The pattern:

```css
.pill-btn {
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

.pill-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.pill-btn.active {
  background: var(--map-text);
  color: var(--map-bg);
}
```

### Detail Panels

Already implemented in `.map__detail`. Key characteristics:

- Positioned absolute, bottom-right (`bottom: 40px; right: 48px`)
- Max width 360px
- Entry: fade in + translateY(20px) over 500ms with 400ms delay
- Label: 10px, uppercase, 45% opacity, 0.25em tracking
- Title: serif, clamp(32px, 3.5vw, 48px), weight 300
- Description: serif, italic, 16px, 45% opacity

### Full-Width Images

Hero and section divider images:
- Fill viewport width
- Use `object-fit: cover` for aspect-ratio adaptation
- Apply `mix-blend-mode: multiply` container for the "printed" effect
- Alt text always provided

### Map Section

The map uses a pure CSS zoom system with `@property` registered custom properties (`--map-scale`, `--map-tx`, `--map-ty`). Key architectural details:

- Outer `.map` container fills viewport, centers a 16:9 inner
- `.map__inner` locks aspect ratio (`1920 / 1080`) as the coordinate space
- Zoom uses `translate()` + `scale()` instead of `transform-origin` (avoids the arc/swing bug)
- All layers (terrain, routes, markers, UI) share the same coordinate space
- Radio buttons + `:has()` drive state — no JavaScript for zoom
- See `docs/kettmeir-map-technique.md` for the reverse-engineered blueprint

### Footer

- Three-column layout: links, address, newsletter signup
- Links in two sub-columns
- Language switcher (adapt to is/en)
- Newsletter: single text input + arrow submit icon
- Social icons row
- Legal text at bottom, tiny size

---

## 6. Animation & Interaction

### Easing Curves

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-standard` | `cubic-bezier(0.445, 0.05, 0.55, 0.95)` | General UI transitions (ease-in-out-sine) |
| `--ease-smooth` | `cubic-bezier(0.45, 0, 0.55, 1)` | Map zoom, major CSS transitions |
| `--ease-snappy` | `cubic-bezier(0.25, 1, 0.5, 1)` | Quick state changes (opacity, color) |

**Existing map easing:** `cubic-bezier(0.45, 0, 0.55, 1)` on `@property` transitions (900ms).

### Transition Durations

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `0.15s` | Micro-interactions (hover color) |
| `--duration-normal` | `0.3s` | Standard transitions (opacity, movement) |
| `--duration-medium` | `0.45s` | Content reveals, panel transitions |
| `--duration-slow` | `0.65s` | Section-level animations |
| `--duration-zoom` | `900ms` | Map zoom in/out (CSS `@property` transition) |

### Transition Rules

- **Always animate:** `transform`, `opacity`, `background-color`, `color`, `border-color`
- **Never animate:** `width`, `height`, `top`, `left`, `margin`, `padding` (causes layout thrashing)
- **Never transition:** `transform-origin` (causes arc/swing path — see map reference doc)

### Scroll Reveals (CSS-only)

Content fades in as it enters the viewport. Use `IntersectionObserver` to toggle a class:

- Initial state: `opacity: 0; transform: translateY(20px)`
- Final state: `opacity: 1; transform: translateY(0)`
- Duration: 500ms with `--ease-standard`
- Triggered once per element (no re-hiding on scroll up)

### Noise Texture

A subtle noise animation for background surfaces:
- `animation: noise 1.2s steps(3) infinite`
- Creates a paper grain effect
- Use sparingly — primary background surfaces only

### `prefers-reduced-motion`

Already implemented for the map section. All animations must respect this:

```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    transition: none;
  }
}
```

---

## 7. Photography & Imagery

### Style

- **Landscape-forward.** Most images are wide landscape shots of terrain, mountains, nature.
- **Natural light.** Warm, golden-hour tones. No studio-lit or flash photography.
- **Muted color palette.** Images lean warm and slightly desaturated — complementing the stone background.
- **People are secondary.** When present, they're in context (exploring, working), never staged portraits.

### Technical Requirements

| Property | Requirement |
|----------|-------------|
| Format | AVIF preferred, WebP fallback (per CLAUDE.md — AVIF supported in all evergreen browsers since 2022) |
| Resolution | Width >= viewport x scale factor for zoomed content |
| Aspect ratio | 16:9 or wider for hero/section images |
| Color profile | sRGB |
| Optimization | Compressed to < 200KB for hero images where possible |

### Image Treatment

- Full-width images: no border, no shadow, no border-radius
- Map images: `mix-blend-mode: multiply` on container (mandatory — already in `.map__image`)
- Never use `border-radius` on photographs
- Never use `box-shadow` on photographs

---

## 8. Brand Voice

### Tone

| Attribute | Description |
|-----------|-------------|
| **Elevated** | Language is literary, not conversational. Like reading a well-crafted essay. |
| **Rooted** | Every statement connects back to place, tradition, or craft. Abstract claims are grounded in specifics. |
| **Restrained** | Power comes from what is *not* said. Short, confident statements. No exclamation marks. |
| **Poetic** | Descriptions use rhythm and imagery. Sentences have musical cadence. |

### Writing Patterns

1. **Short + long rhythm.** Open with a brief declarative sentence, follow with a flowing descriptive passage.
   > "Un patto di responsabilita." followed by "Nel corso degli anni, abbiamo instaurato con i nostri 70 fedeli viticoltori..."

2. **Uppercase headings as statements.** Headings are not labels — they're declarations.
   > "SFUMATURE DI UNA SOLA IDENTITA" (Shades of a single identity)

3. **Territory as protagonist.** The land is the subject, not the brand. The brand is the custodian.

4. **Italics for softness.** Subtitles and descriptive asides use italic to signal a gentler, more personal register.

### Adaptation for fi-website

- All user-facing text in **Icelandic** (per project rules)
- Same elevated, restrained tone — adapted to Icelandic literary tradition
- Headings: short, declarative, uppercase
- Body: flowing, descriptive, connects to landscape and place
- No marketing jargon, no calls-to-action phrasing

---

## 9. Accessibility

### Requirements (WCAG 2.2 AA)

| Check | Standard | Notes |
|-------|----------|-------|
| Color contrast | 4.5:1 minimum (normal text) | Navy on stone passes (~7.2:1). Brown on stone — verify. |
| Color contrast | 3:1 minimum (large text) | Both palette options pass |
| Focus indicators | Visible `focus-visible` on all interactive elements | Already implemented for map radio buttons |
| Reduced motion | All animations disabled with `prefers-reduced-motion: reduce` | Already implemented in map.css |
| Keyboard navigation | Full tab navigation, logical focus order | Map uses radio buttons for native keyboard support |
| Screen reader text | `.sr-only` class for visually hidden labels | Already in style.css |
| Alt text | All images have descriptive alt text | |
| Touch targets | Minimum 44x44px for interactive elements | |

### Focus Style

Already implemented for map controls:

```css
input.sr-only:focus-visible + .map__nav-btn {
  outline: 2px solid var(--map-text);
  outline-offset: 2px;
}
```

Generalize for all interactive elements:

```css
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
```

---

## 10. Responsive Behavior

### Viewport Units

The project currently uses `dvh` (dynamic viewport height) for full-screen sections. This is configurable:

| Unit | Behavior | When to use |
|------|----------|-------------|
| `dvh` | Updates as browser chrome shows/hides | Default — best for most cases |
| `svh` | Uses smallest possible viewport (chrome visible) | When content must never be hidden behind chrome |
| `lvh` | Uses largest possible viewport (chrome hidden) | When you want maximum immersion |
| `vh` | Legacy — may cause content to be hidden on mobile | Avoid unless targeting older browsers |

Change per section as needed. The hero and map sections may benefit from different choices.

### Breakpoints

The design is fluid-first using `clamp()`. Breakpoints are used only for layout shifts:

| Token | Value | Purpose |
|-------|-------|---------|
| `--bp-mobile` | `30em` (480px) | Current map mobile breakpoint |
| `--bp-tablet` | `60em` (960px) | Two-column layouts |
| `--bp-desktop` | `80em` (1280px) | Full desktop layout |

### What Changes

| Viewport | Layout | Typography | Spacing |
|----------|--------|------------|---------|
| < 480px | Single column, stacked content | Display at min clamp values | Map UI: 24px 20px padding |
| 480-960px | Two-column where applicable | Mid-range fluid | Medium spacing |
| > 960px | Full layout with alternating image-text | Full fluid range | Map UI: 40px 48px padding |

### What Stays Constant

- Color palette
- Font families
- Uppercase heading treatment
- Full-width hero images
- Pill button shape
- Mix-blend-mode: multiply on map

---

## 11. Reference Documents

| Document | Purpose |
|----------|---------|
| `docs/style-guide.md` | This document — visual and brand reference |
| `docs/kettmeir-map-technique.md` | Reverse-engineered map zoom blueprint |
| `docs/iceland-map-reference.md` | D3, GeoJSON, ESRI technical reference |
| `docs/iceland-map-implementation-spec.md` | Phased implementation plan |
| `docs/map-zoom-decisions.md` | CSS-transition approach decision record |
| `src/style.css` | Global styles + design tokens as custom properties |
| `src/map/map.css` | Map-specific styles (pure CSS zoom via @property) |
