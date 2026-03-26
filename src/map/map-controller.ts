/**
 * MapController — Two-level zoom with clustering.
 *
 * States:
 *   OVERVIEW          → Full map, clusters + standalone huts visible
 *   CLUSTER(id)       → Zoomed to cluster region (~2.5x), individual huts visible
 *   HUT(id)           → Zoomed tight on a single hut (~4-5x), detail panel shown
 *
 * Uses transform-origin + scale (Kettmeir technique):
 *   - Set transform-origin to target point
 *   - Animate scale only
 *   - NEVER transition transform-origin
 */

import data from "./locations.json";

interface HutData {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  tx: number;
  ty: number;
}

interface ClusterData {
  id: string;
  name: string;
  cx: number;
  cy: number;
  radius: number;
  scale: number;
  hutIds: string[];
  labels: { hutId: string; name: string; x: number; y: number; lx: number; ly: number; angle: number; anchor: string }[];
}

type State = { type: "overview" } | { type: "cluster"; id: string } | { type: "hut"; id: string };

export class MapController {
  private map: HTMLElement;
  private image: HTMLElement;
  private state: State = { type: "overview" };
  private huts: HutData[];
  private clusters: ClusterData[];

  constructor(container: HTMLElement) {
    this.map = container;
    this.image = container.querySelector(".map__image")!;
    this.huts = (data as any).huts;
    this.clusters = (data as any).clusters;

    // Cluster circle clicks
    container.addEventListener("click", (e) => {
      const clusterEl = (e.target as HTMLElement).closest<HTMLElement>("[data-cluster]");
      if (clusterEl) {
        e.preventDefault();
        this.zoomToCluster(clusterEl.dataset.cluster!);
        return;
      }
    });

    // Radio button changes (hut marker clicks)
    container.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.name !== "map-loc") return;
      if (target.id === "map-all") {
        this.zoomToOverview();
      } else {
        const hutId = target.id.replace("map-", "");
        this.zoomToHut(hutId);
      }
    });

    // Back button
    const backBtn = container.querySelector(".map__back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.state.type === "hut") {
          // Find which cluster this hut belongs to
          const cluster = this.clusters.find((c) => c.hutIds.includes(this.state.type === "hut" ? (this.state as any).id : ""));
          if (cluster) {
            this.zoomToCluster(cluster.id);
          } else {
            this.zoomToOverview();
          }
        } else {
          this.zoomToOverview();
        }
      });
    }

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.state.type === "hut") {
          const cluster = this.clusters.find((c) => c.hutIds.includes((this.state as any).id));
          if (cluster) {
            this.zoomToCluster(cluster.id);
          } else {
            this.zoomToOverview();
          }
        } else {
          this.zoomToOverview();
        }
      }
    });

    // Prevent double-tap zoom
    this.map.style.touchAction = "manipulation";
  }

  private zoomToOverview() {
    this.state = { type: "overview" };

    // Reset zoom
    this.image.style.transform = "scale(1)";

    // Reset radio
    const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
    if (allRadio) allRadio.checked = true;

    // Update CSS state classes
    this.map.classList.remove("map--cluster", "map--hut");
    this.map.removeAttribute("data-active-cluster");
  }

  private zoomToCluster(clusterId: string) {
    const cluster = this.clusters.find((c) => c.id === clusterId);
    if (!cluster) return;

    this.state = { type: "cluster", id: clusterId };

    // Transform-origin at cluster centroid, scale to cluster level
    this.image.style.transformOrigin = `${cluster.cx}% ${cluster.cy}%`;
    // Set origin THEN animate scale (origin change is invisible at current scale if we're at 1,
    // or we need to zoom out first if coming from a hut)
    requestAnimationFrame(() => {
      this.image.style.transform = `scale(${cluster.scale})`;
    });

    // Reset radio to "all" (no specific hut selected)
    const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
    if (allRadio) allRadio.checked = true;

    // CSS state
    this.map.classList.add("map--cluster");
    this.map.classList.remove("map--hut");
    this.map.setAttribute("data-active-cluster", clusterId);
  }

  private zoomToHut(hutId: string) {
    const hut = this.huts.find((h) => h.id === hutId);
    if (!hut) return;

    this.state = { type: "hut", id: hutId };

    // Transform-origin at hut position, scale tight
    this.image.style.transformOrigin = `${hut.x}% ${hut.y}%`;
    requestAnimationFrame(() => {
      this.image.style.transform = `scale(${hut.scale})`;
    });

    // CSS state
    this.map.classList.add("map--hut");
    this.map.classList.remove("map--cluster");
    this.map.removeAttribute("data-active-cluster");
  }
}
