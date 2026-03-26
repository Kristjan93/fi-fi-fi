/**
 * MapController — Thin JS orchestration for the Iceland map.
 *
 * CSS handles: detail panel visibility (:has()), marker show/hide,
 * header show/hide, transitions, reduced motion.
 *
 * JS handles: per-hut zoom transforms (adaptive scale), active label
 * visibility, keyboard navigation, touch-action.
 */

import locations from "./locations.json";

interface Location {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  tx: number;
  ty: number;
}

export class MapController {
  private map: HTMLElement;
  private image: HTMLElement;
  private radios: HTMLInputElement[];
  private markers: HTMLElement[];
  private locs: Location[];

  constructor(container: HTMLElement) {
    this.map = container;
    this.image = container.querySelector(".map__image")!;
    this.radios = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="map-loc"]'),
    );
    this.markers = Array.from(
      container.querySelectorAll<HTMLElement>(".marker"),
    );
    this.locs = locations as Location[];

    // Listen for radio changes
    this.map.addEventListener("change", this.onChange.bind(this));

    // Keyboard navigation
    document.addEventListener("keydown", this.onKey.bind(this));

    // Prevent double-tap zoom on the map section
    this.map.style.touchAction = "manipulation";
  }

  private onChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.name !== "map-loc") return;

    if (target.id === "map-all") {
      this.zoomToOverview();
    } else {
      const hutId = target.id.replace("map-", "");
      this.zoomToHut(hutId);
    }
  }

  private zoomToOverview() {
    this.image.style.setProperty("--map-scale", "1");
    this.image.style.setProperty("--map-tx", "0");
    this.image.style.setProperty("--map-ty", "0");

    // Hide all marker labels
    for (const m of this.markers) {
      m.querySelector<HTMLElement>(".marker__label")?.classList.remove(
        "marker__label--active",
      );
    }
  }

  private zoomToHut(hutId: string) {
    const loc = this.locs.find((l) => l.id === hutId);
    if (!loc) return;

    this.image.style.setProperty("--map-scale", String(loc.scale));
    this.image.style.setProperty("--map-tx", String(loc.tx));
    this.image.style.setProperty("--map-ty", String(loc.ty));

    // Show the active hut's label, hide others
    for (const m of this.markers) {
      const label = m.querySelector<HTMLElement>(".marker__label");
      const forId = m.querySelector("label")?.getAttribute("for");
      if (forId === `map-${hutId}`) {
        label?.classList.add("marker__label--active");
      } else {
        label?.classList.remove("marker__label--active");
      }
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.selectAll();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this.next();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this.prev();
    }
  }

  private selectAll() {
    const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
    if (allRadio) {
      allRadio.checked = true;
      allRadio.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  private getHutRadios(): HTMLInputElement[] {
    return this.radios.filter((r) => r.id !== "map-all");
  }

  private currentIndex(): number {
    const hutRadios = this.getHutRadios();
    return hutRadios.findIndex((r) => r.checked);
  }

  private next() {
    const hutRadios = this.getHutRadios();
    const idx = this.currentIndex();
    const next = hutRadios[(idx + 1) % hutRadios.length];
    next.checked = true;
    next.dispatchEvent(new Event("change", { bubbles: true }));
  }

  private prev() {
    const hutRadios = this.getHutRadios();
    const idx = this.currentIndex();
    const prev =
      hutRadios[idx <= 0 ? hutRadios.length - 1 : idx - 1];
    prev.checked = true;
    prev.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
