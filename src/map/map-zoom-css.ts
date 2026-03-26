/**
 * MapZoomCSS — CSS-transition-only map zoom engine.
 *
 * Same DOM contract as MapZoom (GSAP version), but all animation is driven
 * by a single CSS transition on `transform`. JS manages state and sets
 * `transform` / `transform-origin` directly on `.map__image`.
 *
 * Key rule: never CSS-transition transform-origin.
 * At scale(1) all origins look identical — snap origin freely there.
 *
 * Interruptible: clicking mid-animation cancels any pending transitionend
 * handler and starts a new transition from the browser's current interpolated
 * scale value.
 */

export interface MapLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  originX?: number;
  originY?: number;
  label: string;
  info: string;
}

export interface MapZoomCSSConfig {
  /** Zoom scale factor. Default: 2.5 */
  scale?: number;
  /** Duration for a full zoom in/out (ms). Default: 900 */
  durationMs?: number;
  /** CSS easing. Default: cubic-bezier(0.45, 0, 0.55, 1) — matches power2.inOut */
  easing?: string;
}

const DEFAULTS: Required<MapZoomCSSConfig> = {
  scale: 2.5,
  durationMs: 900,
  easing: "cubic-bezier(0.45, 0, 0.55, 1)",
};

type State = "overview" | "zoomed" | "animating";

export class MapZoomCSS {
  private container: HTMLElement;
  private imageEl: HTMLElement;
  private locations: MapLocation[];
  private config: Required<MapZoomCSSConfig>;

  private state: State = "overview";
  private currentLocationId: string | null = null;
  private pendingAbort: AbortController | null = null;

  private boundClick: (e: Event) => void;

  constructor(
    container: HTMLElement,
    locations: MapLocation[],
    config?: MapZoomCSSConfig,
  ) {
    this.container = container;
    this.locations = locations;
    this.config = { ...DEFAULTS, ...config };

    const imageEl = container.querySelector<HTMLElement>(".map__image");
    if (!imageEl) throw new Error("MapZoomCSS: .map__image not found");
    this.imageEl = imageEl;

    // Set the transition property — only transform, never transform-origin
    this.applyTransition(this.config.durationMs);

    this.boundClick = this.onClick.bind(this);
    container.addEventListener("click", this.boundClick);
  }

  // ── Public API ───────────────────────────────────────

  zoomTo(id: string): void {
    const loc = this.locations.find((l) => l.id === id);
    if (!loc) return;
    this.navigateTo(loc);
  }

  zoomOut(): void {
    this.navigateTo(null);
  }

  destroy(): void {
    this.cancelPending();
    this.container.removeEventListener("click", this.boundClick);
    this.imageEl.style.transition = "";
    this.imageEl.style.transform = "";
    this.imageEl.style.transformOrigin = "";
    this.container.classList.remove("zoomed");
    this.clearDetails();
    this.setActiveBtn("all");
    this.state = "overview";
    this.currentLocationId = null;
  }

  // ── Navigation logic ───────────────────────────────────

  private navigateTo(loc: MapLocation | null): void {
    this.cancelPending();

    const currentScale = this.getCurrentScale();
    const isNearOverview = currentScale < 1.05;

    if (loc === null) {
      // ── Zoom out to overview ──────────────────────
      this.applyTransition(this.proportionalDuration(currentScale, 1));
      this.state = "animating";
      this.imageEl.style.transform = "scale(1)";
      this.container.classList.remove("zoomed");
      this.clearDetails();
      this.setActiveBtn("all");
      this.onTransitionEnd(() => {
        this.state = "overview";
        this.currentLocationId = null;
      });
    } else if (isNearOverview) {
      // ── Zoom in from overview (or near it) ────────
      this.setOrigin(loc);
      this.applyTransition(this.proportionalDuration(currentScale, this.config.scale));
      this.state = "animating";
      this.imageEl.style.transform = `scale(${this.config.scale})`;
      this.container.classList.add("zoomed");
      this.showDetail(loc.id);
      this.setActiveBtn(loc.id);
      this.onTransitionEnd(() => {
        this.state = "zoomed";
        this.currentLocationId = loc.id;
      });
    } else {
      // ── Switch: zoom out → snap origin → zoom in ──
      this.switchLocation(loc, currentScale);
    }
  }

  /**
   * 3-phase location switch using CSS transitions:
   * 1. Zoom out to scale(1)
   * 2. Snap transform-origin to new location (invisible at scale 1)
   * 3. Zoom in to scale(target)
   */
  private switchLocation(loc: MapLocation, currentScale: number): void {
    // Update UI immediately
    this.showDetail(loc.id);
    this.setActiveBtn(loc.id);

    // Phase 1: zoom out
    this.applyTransition(this.proportionalDuration(currentScale, 1));
    this.state = "animating";
    this.imageEl.style.transform = "scale(1)";

    this.onTransitionEnd(() => {
      // Phase 2: snap origin (invisible at scale 1)
      this.setOrigin(loc);

      // Phase 3: zoom in to new location
      this.applyTransition(this.config.durationMs);
      // Force reflow so the browser picks up the new transition duration
      void this.imageEl.offsetHeight;
      this.imageEl.style.transform = `scale(${this.config.scale})`;

      this.onTransitionEnd(() => {
        this.state = "zoomed";
        this.currentLocationId = loc.id;
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────

  private getCurrentScale(): number {
    const matrix = getComputedStyle(this.imageEl).transform;
    if (!matrix || matrix === "none") return 1;
    // matrix(a, b, c, d, tx, ty) — a is scaleX
    const match = matrix.match(/^matrix\(([^,]+)/);
    return match ? parseFloat(match[1]) : 1;
  }

  private proportionalDuration(from: number, to: number): number {
    const fullRange = this.config.scale - 1;
    const proportion = Math.abs(from - to) / fullRange;
    return proportion * this.config.durationMs;
  }

  private applyTransition(durationMs: number): void {
    this.imageEl.style.transition = `transform ${durationMs}ms ${this.config.easing}`;
  }

  private setOrigin(loc: MapLocation): void {
    const ox = loc.originX ?? loc.x;
    const oy = loc.originY ?? loc.y;
    this.imageEl.style.transformOrigin = `${ox}% ${oy}%`;
  }

  /** Listen for the next transitionend on .map__image, with abort support. */
  private onTransitionEnd(callback: () => void): void {
    const abort = new AbortController();
    this.pendingAbort = abort;

    this.imageEl.addEventListener(
      "transitionend",
      (e) => {
        // Only respond to our transform transition, not bubbled ones
        if (e.target !== this.imageEl || e.propertyName !== "transform") return;
        this.pendingAbort = null;
        callback();
      },
      { once: true, signal: abort.signal },
    );
  }

  private cancelPending(): void {
    if (this.pendingAbort) {
      this.pendingAbort.abort();
      this.pendingAbort = null;
    }
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
    if (!target?.dataset.location) return;

    const id = target.dataset.location;
    if (id === "all") {
      this.zoomOut();
    } else {
      this.zoomTo(id);
    }
  }
}
