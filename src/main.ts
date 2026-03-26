import gsap from "gsap";
import { MapZoomCSS } from "./map/map-zoom-css";
import { locations } from "./map/locations";

// ── Hero animation ─────────────────────────────────────

const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

tl.to(".hero-title", {
  opacity: 1,
  y: 0,
  duration: 1.2,
  delay: 0.3,
})
  .from(".hero-title", { y: 40, duration: 1.2 }, "<")
  .to(
    ".hero-subtitle",
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
    },
    "-=0.6",
  )
  .from(".hero-subtitle", { y: 20, duration: 0.8 }, "<");

// ── Map zoom (CSS transitions — no GSAP) ──────────────

const mapEl = document.querySelector<HTMLElement>("#map");
if (mapEl) {
  new MapZoomCSS(mapEl, locations);
}
