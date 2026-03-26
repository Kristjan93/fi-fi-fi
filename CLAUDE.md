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
bun run dev        # Start Vite dev server with HMR (opens browser)
bun run build      # Production build → dist/
bun run preview    # Preview production build locally
bun test           # Run tests (bun:test)
bun install        # Install dependencies
```

## Project Structure

```
index.html         # Entry point — Vite uses this as root
src/
  main.ts          # JS entry — hero animation
  style.css        # Global styles + utilities (.sr-only)
  map/
    map.css        # Map zoom component — pure CSS, no JS dependency
docs/              # Reference material + decision records
```

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
