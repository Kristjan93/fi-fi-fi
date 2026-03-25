# fi-website

Static landing page / experimental concept site. Vanilla TypeScript + GSAP animations. No framework.

## Stack

- **Bundler/Dev server:** Vite 8 (NOT Bun.serve — this is a static site, not a server app)
- **Runtime:** Bun 1.x (use `bun` for all package/script commands)
- **Language:** TypeScript (strict mode, ESNext target)
- **Animation:** GSAP 3.x
- **Styling:** Plain CSS with custom properties. No preprocessor, no Tailwind.

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
  main.ts          # JS entry — GSAP animation setup
  style.css        # All styles — CSS custom properties in :root
docs/              # Reference materials for upcoming features
```

## Rules

- Keep it vanilla. No React, no UI framework. DOM + CSS + GSAP.
- CSS: use custom properties for theming (`--color-bg`, `--color-text`, `--color-accent`).
- Animations: use GSAP timelines. Keep animation logic in dedicated modules, not inline.
- Performance first: no layout thrashing, prefer `transform`/`opacity` for animations.
- Browser support: all modern evergreen browsers. Use `dvh` units, `clamp()`, etc.
- Write Icelandic for any user-facing text unless otherwise specified.
- `docs/` contains reverse-engineered reference material — read before implementing related features.
