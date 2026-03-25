/**
 * MapZoom — Reusable map zoom engine.
 *
 * Drives a CSS-scale zoom on a clipped container, with GSAP for animation.
 * The engine attaches to existing DOM — it doesn't generate HTML.
 *
 * DOM contract (query from container):
 *   .map__image        — the element that receives transform: scale()
 *   .map__detail       — detail panels, toggled via .active class
 *   .map__nav-btn      — nav buttons, toggled via .active class
 *   [data-location]    — any clickable element (buttons, markers)
 *
 * Interruptible: any click mid-animation kills the current timeline and
 * starts a new one from wherever the scale currently is. Durations scale
 * proportionally so short distances = fast transitions.
 *
 * Key rule: never CSS-transition transform-origin.
 * At scale(1) all origins look identical — snap origin freely there.
 * At scale(>1) snapping origin teleports the view.
 */

import gsap from "gsap";

export interface MapLocation {
  id: string;
  name: string;
  x: number; // marker position (%)
  y: number;
  originX?: number; // zoom center override (defaults to x)
  originY?: number; // zoom center override (defaults to y)
  label: string;
  info: string;
}

export interface MapZoomConfig {
  /** Zoom scale factor. Default: 2.5 */
  scale?: number;
  /** Base duration for a full zoom in/out (seconds). Default: 0.9 */
  zoomDuration?: number;
  /** GSAP easing. Default: "power2.inOut" */
  ease?: string;
}

const DEFAULTS: Required<MapZoomConfig> = {
  scale: 2.5,
  zoomDuration: 0.9,
  ease: "power2.inOut",
};

// Below this scale, we consider the map "at overview" — safe to snap origin
const SNAP_THRESHOLD = 1.02;

export class MapZoom {
  private container: HTMLElement;
  private imageEl: HTMLElement;
  private locations: MapLocation[];
  private config: Required<MapZoomConfig>;

  private currentId: string | null = null; // committed after animation completes
  private targetId: string | null = null; // what we're heading toward right now
  private tl: gsap.core.Timeline | null = null;

  private boundClick: (e: Event) => void;

  constructor(
    container: HTMLElement,
    locations: MapLocation[],
    config?: MapZoomConfig,
  ) {
    this.container = container;
    this.locations = locations;
    this.config = { ...DEFAULTS, ...config };

    const imageEl = container.querySelector<HTMLElement>(".map__image");
    if (!imageEl) throw new Error("MapZoom: .map__image not found");
    this.imageEl = imageEl;

    this.boundClick = this.onClick.bind(this);
    container.addEventListener("click", this.boundClick);
  }

  // ── Public API ───────────────────────────────────────

  zoomTo(id: string): void {
    const loc = this.locations.find((l) => l.id === id);
    if (!loc) return;
    if (this.targetId === id) return; // already heading there
    this.transitionTo(loc);
  }

  zoomOut(): void {
    if (this.targetId === null && !this.tl) return; // already at rest in overview
    this.transitionTo(null);
  }

  destroy(): void {
    this.container.removeEventListener("click", this.boundClick);
    this.tl?.kill();
    this.tl = null;
    this.currentId = null;
    this.targetId = null;
    this.imageEl.style.transform = "";
    this.imageEl.style.transformOrigin = "";
    this.container.classList.remove("zoomed");
    this.clearDetails();
    this.setActiveBtn("all");
  }

  // ── Core transition ──────────────────────────────────
  //
  // Every action funnels through here. Kill whatever is running,
  // read the current scale, build a new timeline from that point.

  private transitionTo(loc: MapLocation | null): void {
    const currentScale = this.interrupt();
    const { scale: maxScale, ease } = this.config;

    this.targetId = loc?.id ?? null;
    this.tl = gsap.timeline({
      onComplete: () => {
        this.currentId = this.targetId;
        this.tl = null;
      },
    });

    if (loc) {
      // ── Going to a location ────────────────────────
      if (currentScale < SNAP_THRESHOLD) {
        // Near scale(1) — snap origin and zoom straight in
        this.setOrigin(loc);
        this.tl.to(this.imageEl, {
          scale: maxScale,
          duration: this.duration(currentScale, maxScale),
          ease,
        });
      } else {
        // Mid-zoom — animate down to 1, snap origin, zoom back up
        this.tl.to(this.imageEl, {
          scale: 1,
          duration: this.duration(currentScale, 1),
          ease,
        });
        this.tl.call(() => this.setOrigin(loc));
        this.tl.to(this.imageEl, {
          scale: maxScale,
          duration: this.config.zoomDuration,
          ease,
        });
      }

      this.container.classList.add("zoomed");
      this.showDetail(loc.id);
      this.setActiveBtn(loc.id);
    } else {
      // ── Going to overview ──────────────────────────
      const dur = this.duration(currentScale, 1);
      if (dur > 0.05) {
        this.tl.to(this.imageEl, { scale: 1, duration: dur, ease });
      }

      this.container.classList.remove("zoomed");
      this.clearDetails();
      this.setActiveBtn("all");
    }
  }

  // ── Helpers ──────────────────────────────────────────

  /** Kill in-flight animation, return the current scale. */
  private interrupt(): number {
    this.tl?.kill();
    this.tl = null;
    return (gsap.getProperty(this.imageEl, "scaleX") as number) || 1;
  }

  /** Proportional duration — short distances animate fast. */
  private duration(from: number, to: number): number {
    const fullRange = this.config.scale - 1; // e.g. 2.5 - 1 = 1.5
    const proportion = Math.abs(from - to) / fullRange;
    return proportion * this.config.zoomDuration;
  }

  private setOrigin(loc: MapLocation): void {
    const ox = loc.originX ?? loc.x;
    const oy = loc.originY ?? loc.y;
    this.imageEl.style.transformOrigin = `${ox}% ${oy}%`;
  }

  private showDetail(id: string): void {
    this.clearDetails();
    this.container
      .querySelector(`.map__detail[data-location="${id}"]`)
      ?.classList.add("active");
  }

  private clearDetails(): void {
    this.container
      .querySelectorAll(".map__detail.active")
      .forEach((el) => el.classList.remove("active"));
  }

  private setActiveBtn(id: string): void {
    this.container.querySelectorAll(".map__nav-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      el.classList.toggle("active", el.dataset.location === id);
    });
  }

  private onClick(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-location]",
    );
    if (!target) return;

    const id = target.dataset.location;
    if (!id) return;

    if (id === "all") {
      this.zoomOut();
    } else {
      this.zoomTo(id);
    }
  }
}
