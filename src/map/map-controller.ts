/**
 * MapController — Sequenced two-level zoom with choreographed transitions.
 *
 * Animation sequence (overview → cluster):
 *   1. Markers fade out (250ms)
 *   2. Wait for fade to complete
 *   3. Zoom starts (900ms, transform-origin technique)
 *   4. Cluster-level labels appear after zoom
 *
 * Uses transform-origin + scale (Kettmeir technique):
 *   - NEVER transition transform-origin, only transform
 */

import data from "./locations.json";

interface HutData {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
}

interface ClusterData {
  id: string;
  name: string;
  cx: number;
  cy: number;
  scale: number;
  hutIds: string[];
}

type State =
  | { type: "overview" }
  | { type: "cluster"; id: string }
  | { type: "hut"; id: string };

export class MapController {
  private map: HTMLElement;
  private image: HTMLElement;
  private markersEl: HTMLElement;
  private clustersEl: HTMLElement;
  private state: State = { type: "overview" };
  private huts: HutData[];
  private clusters: ClusterData[];
  private animating = false;

  constructor(container: HTMLElement) {
    this.map = container;
    this.image = container.querySelector(".map__image")!;
    this.markersEl = container.querySelector(".map__markers")!;
    this.clustersEl = container.querySelector(".map__clusters")!;
    this.huts = (data as any).huts;
    this.clusters = (data as any).clusters;

    // Cluster clicks
    this.clustersEl.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cluster]");
      if (el && !this.animating) this.zoomToCluster(el.dataset.cluster!);
    });

    // Marker label clicks (radio change)
    container.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name !== "map-loc" || this.animating) return;
      if (t.id === "map-all") {
        this.zoomToOverview();
      } else {
        this.zoomToHut(t.id.replace("map-", ""));
      }
    });

    // Back button
    container.querySelector(".map__back-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.animating) return;
      if (this.state.type === "hut") {
        const cluster = this.clusters.find((c) => c.hutIds.includes((this.state as any).id));
        cluster ? this.zoomToCluster(cluster.id) : this.zoomToOverview();
      } else {
        this.zoomToOverview();
      }
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (this.animating) return;
      if (e.key === "Escape") {
        if (this.state.type === "hut") {
          const cluster = this.clusters.find((c) => c.hutIds.includes((this.state as any).id));
          cluster ? this.zoomToCluster(cluster.id) : this.zoomToOverview();
        } else if (this.state.type === "cluster") {
          this.zoomToOverview();
        }
      }
    });

    // Dot hover → highlight its name text, dim others. 200ms debounce on leave.
    const markerEls = container.querySelectorAll<HTMLElement>(".marker[data-in-cluster]");
    let dotLeaveTimer: ReturnType<typeof setTimeout> | null = null;

    for (const marker of markerEls) {
      const clusterId = marker.dataset.inCluster!;
      const hutId = marker.querySelector("label")?.getAttribute("for")?.replace("map-", "");
      if (!hutId) continue;

      marker.addEventListener("mouseenter", () => {
        if (dotLeaveTimer) { clearTimeout(dotLeaveTimer); dotLeaveTimer = null; }
        const group = container.querySelector(`[data-cluster="${clusterId}"]`);
        if (!group) return;
        for (const text of group.querySelectorAll<HTMLElement>(".cluster__ring-text")) {
          if (text.dataset.hut === hutId) {
            text.classList.add("cluster__ring-text--highlight");
            text.classList.remove("cluster__ring-text--dim");
          } else {
            text.classList.add("cluster__ring-text--dim");
            text.classList.remove("cluster__ring-text--highlight");
          }
        }
      });

      marker.addEventListener("mouseleave", () => {
        dotLeaveTimer = setTimeout(() => {
          const group = container.querySelector(`[data-cluster="${clusterId}"]`);
          if (!group) return;
          for (const text of group.querySelectorAll<HTMLElement>(".cluster__ring-text")) {
            text.classList.remove("cluster__ring-text--highlight", "cluster__ring-text--dim");
          }
          dotLeaveTimer = null;
        }, 200);
      });
    }

    // Word hover → highlight its dot, dim others. 200ms debounce on leave.
    const ringTexts = container.querySelectorAll<HTMLElement>(".cluster__ring-text");
    let wordLeaveTimer: ReturnType<typeof setTimeout> | null = null;

    for (const text of ringTexts) {
      const hutId = text.dataset.hut;
      if (!hutId) continue;

      const clusterGroup = text.closest<HTMLElement>("[data-cluster]");
      const clusterId = clusterGroup?.dataset.cluster;
      if (!clusterId) continue;

      text.addEventListener("mouseenter", () => {
        if (wordLeaveTimer) { clearTimeout(wordLeaveTimer); wordLeaveTimer = null; }
        for (const m of markerEls) {
          if (m.dataset.inCluster !== clusterId) continue;
          const mHutId = m.querySelector("label")?.getAttribute("for")?.replace("map-", "");
          if (mHutId === hutId) {
            m.classList.add("marker--highlight");
            m.classList.remove("marker--dim");
          } else {
            m.classList.add("marker--dim");
            m.classList.remove("marker--highlight");
          }
        }
      });

      text.addEventListener("mouseleave", () => {
        wordLeaveTimer = setTimeout(() => {
          for (const m of markerEls) {
            if (m.dataset.inCluster !== clusterId) continue;
            m.classList.remove("marker--highlight", "marker--dim");
          }
          wordLeaveTimer = null;
        }, 200);
      });
    }

    this.map.style.touchAction = "manipulation";
  }

  // ── Transitions ──────────────────────────────────────

  private async zoomToCluster(clusterId: string) {
    const cluster = this.clusters.find((c) => c.id === clusterId);
    if (!cluster) return;
    this.animating = true;

    // 1. Fade out current content
    this.map.classList.add("map--hiding");
    await this.waitMs(250);

    // 2. Update state + set zoom target
    this.state = { type: "cluster", id: clusterId };
    this.map.className = "map map--cluster";
    this.map.setAttribute("data-active-cluster", clusterId);

    // Uncheck any hut radio
    const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
    if (allRadio) allRadio.checked = true;

    // 3. Set transform-origin at cluster center, then zoom
    this.image.style.transformOrigin = `${cluster.cx}% ${cluster.cy}%`;
    // Force reflow so origin is applied before transform changes
    void this.image.offsetHeight;
    this.image.style.transform = `scale(${cluster.scale})`;

    // 4. Wait for zoom to complete
    await this.waitMs(900);
    this.animating = false;
  }

  private async zoomToHut(hutId: string) {
    const hut = this.huts.find((h) => h.id === hutId);
    if (!hut) return;
    this.animating = true;

    // 1. Fade out current content
    this.map.classList.add("map--hiding");
    await this.waitMs(250);

    // 2. Update state
    this.state = { type: "hut", id: hutId };
    this.map.className = "map map--hut";
    this.map.removeAttribute("data-active-cluster");

    // 3. Zoom to hut
    this.image.style.transformOrigin = `${hut.x}% ${hut.y}%`;
    void this.image.offsetHeight;
    this.image.style.transform = `scale(${hut.scale})`;

    // 4. Wait for zoom
    await this.waitMs(900);
    this.animating = false;
  }

  private async zoomToOverview() {
    this.animating = true;

    // 1. Fade out current content (keep current classes intact)
    this.map.classList.add("map--hiding");

    // Uncheck hut radio so detail panel fades via :has()
    const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
    if (allRadio) allRadio.checked = true;

    await this.waitMs(250);

    // 2. Zoom out (classes unchanged — no CSS disruption during animation)
    this.image.style.transform = "scale(1)";
    await this.waitMs(900);

    // 3. Zoom done — NOW switch to overview state
    this.state = { type: "overview" };
    this.map.className = "map";
    this.map.removeAttribute("data-active-cluster");

    this.animating = false;
  }

  // Simple delay — more reliable than transitionend for choreography
  private waitMs(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
