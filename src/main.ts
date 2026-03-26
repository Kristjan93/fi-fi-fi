import gsap from "gsap";

// ── Hero animation ─────────────────────────────────────

const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const tl = gsap.timeline({
  defaults: {
    ease: "power3.out",
    duration: prefersReducedMotion ? 0 : undefined,
  },
});

tl.to(".hero-title", {
  opacity: 1,
  y: 0,
  duration: prefersReducedMotion ? 0 : 1.2,
  delay: prefersReducedMotion ? 0 : 0.3,
})
  .from(".hero-title", { y: 40 }, "<")
  .to(
    ".hero-subtitle",
    { opacity: 1, y: 0 },
    prefersReducedMotion ? "<" : "-=0.6",
  )
  .from(".hero-subtitle", { y: 20 }, "<");

// ── Map zoom is pure CSS — no JS needed ────────────────
