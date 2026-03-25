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
 * State machine:
 *   OVERVIEW  → scale(1), markers visible
 *   ZOOMED    → scale(N), markers hidden, one detail panel active
 *   ANIMATING → in-flight, clicks ignored
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
  /** Duration for overview <-> zoomed (seconds). Default: 0.9 */
  zoomDuration?: number;
  /** Location switch — phase 1 zoom-out duration. Default: 1.084 */
  switchOutDuration?: number;
  /** Location switch — pause at scale(1) before re-zoom. Default: 0.52 */
  switchPause?: number;
  /** Location switch — phase 3 zoom-in duration. Default: 1.497 */
  switchInDuration?: number;
  /** GSAP easing. Default: "power2.inOut" */
  ease?: string;
}

const DEFAULTS: Required<MapZoomConfig> = {
  scale: 2.5,
  zoomDuration: 0.9,
  switchOutDuration: 1.084,
  switchPause: 0.52,
  switchInDuration: 1.497,
  ease: "power2.inOut",
};

type State = "overview" | "zoomed" | "animating";

export class MapZoom {
  private container: HTMLElement;
  private imageEl: HTMLElement;
  private locations: MapLocation[];
  private config: Required<MapZoomConfig>;

  private state: State = "overview";
  private currentId: string | null = null;
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

    // Single delegated listener — handles nav buttons AND marker clicks
    this.boundClick = this.onClick.bind(this);
    container.addEventListener("click", this.boundClick);
  }

  // ── Public API ───────────────────────────────────────

  zoomTo(id: string): void {
    if (this.state === "animating") return;

    const loc = this.locations.find((l) => l.id === id);
    if (!loc) return;

    if (this.state === "zoomed" && this.currentId === id) return;
    if (this.state === "zoomed") {
      this.switchLocation(loc);
      return;
    }

    this.animateIn(loc);
  }

  zoomOut(): void {
    if (this.state !== "zoomed") return;
    this.animateOut();
  }

  destroy(): void {
    this.container.removeEventListener("click", this.boundClick);
    this.tl?.kill();
    this.tl = null;
    this.state = "overview";
    this.currentId = null;
    this.imageEl.style.transform = "";
    this.imageEl.style.transformOrigin = "";
    this.container.classList.remove("zoomed");
    this.clearDetails();
    this.setActiveBtn("all");
  }

  // ── Animations ───────────────────────────────────────

  /** OVERVIEW -> ZOOMED: set origin at scale(1), then animate scale up */
  private animateIn(loc: MapLocation): void {
    this.state = "animating";
    const { scale, zoomDuration, ease } = this.config;

    // Origin snap is invisible at scale(1)
    this.setOrigin(loc);

    this.tl = gsap.timeline({
      onComplete: () => this.settle("zoomed", loc.id),
    });
    this.tl.to(this.imageEl, { scale, duration: zoomDuration, ease });

    this.container.classList.add("zoomed");
    this.showDetail(loc.id);
    this.setActiveBtn(loc.id);
  }

  /** ZOOMED -> OVERVIEW: animate scale down, restore UI */
  private animateOut(): void {
    this.state = "animating";
    const { zoomDuration, ease } = this.config;

    this.tl = gsap.timeline({
      onComplete: () => this.settle("overview", null),
    });
    this.tl.to(this.imageEl, { scale: 1, duration: zoomDuration, ease });

    this.container.classList.remove("zoomed");
    this.clearDetails();
    this.setActiveBtn("all");
  }

  /**
   * ZOOMED(a) -> ZOOMED(b): the 3-phase dance.
   * Phase 1: zoom out to scale(1), keeping OLD origin.
   * Phase 2: pause, snap origin to NEW location (invisible at scale 1).
   * Phase 3: zoom in to scale(N) from NEW origin.
   */
  private switchLocation(loc: MapLocation): void {
    this.state = "animating";
    const { scale, switchOutDuration, switchPause, switchInDuration, ease } =
      this.config;

    this.tl = gsap.timeline({
      onComplete: () => this.settle("zoomed", loc.id),
    });

    // Phase 1: zoom out
    this.tl.to(this.imageEl, {
      scale: 1,
      duration: switchOutDuration,
      ease,
    });

    // Phase 2: snap origin + swap detail (at scale 1, invisible)
    this.tl.call(
      () => {
        this.setOrigin(loc);
        this.clearDetails();
        this.showDetail(loc.id);
      },
      [],
      `+=${switchPause}`,
    );

    // Phase 3: zoom back in
    this.tl.to(this.imageEl, {
      scale,
      duration: switchInDuration,
      ease,
    });

    this.setActiveBtn(loc.id);
  }

  // ── Helpers ──────────────────────────────────────────

  private settle(state: State, id: string | null): void {
    this.state = state;
    this.currentId = id;
    this.tl = null;
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
