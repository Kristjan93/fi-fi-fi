/**
 * MapController — GSAP-powered map zoom with clustering.
 *
 * States:
 *   OVERVIEW    → Full map, clusters + standalone huts visible
 *   CLUSTER(id) → Zoomed to cluster region, hut markers + route visible
 *   HUT(id)     → Zoomed to single hut, detail panel visible
 *
 * Uses transform-origin + scale (Kettmeir technique).
 * Markers inside .map__image — counter-scaled via --zoom custom property.
 */

import gsap from "gsap";
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
  private tl: gsap.core.Timeline | null = null;

  constructor(container: HTMLElement) {
    this.map = container;
    this.image = container.querySelector(".map__image")!;
    this.markersEl = container.querySelector(".map__markers")!;
    this.clustersEl = container.querySelector(".map__clusters")!;
    this.huts = (data as any).huts;
    this.clusters = (data as any).clusters;

    // Fix ring spacing after render
    requestAnimationFrame(() => this.fixRingSpacing());

    // Cluster clicks
    this.clustersEl.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cluster]");
      if (el) this.zoomToCluster(el.dataset.cluster!);
    });

    // Hut marker clicks (radio change)
    container.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name !== "map-loc") return;
      if (t.id === "map-all") {
        this.zoomToOverview();
      } else {
        this.zoomToHut(t.id.replace("map-", ""));
      }
    });

    // Back button
    container.querySelector(".map__back-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.state.type === "hut") {
        const cluster = this.clusters.find((c) =>
          c.hutIds.includes((this.state as any).id),
        );
        cluster ? this.zoomToCluster(cluster.id) : this.zoomToOverview();
      } else {
        this.zoomToOverview();
      }
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.state.type === "hut") {
          const cluster = this.clusters.find((c) =>
            c.hutIds.includes((this.state as any).id),
          );
          cluster ? this.zoomToCluster(cluster.id) : this.zoomToOverview();
        } else if (this.state.type === "cluster") {
          this.zoomToOverview();
        }
      }
    });

    // Hover interactions
    this.setupHoverInteractions(container);

    this.map.style.touchAction = "manipulation";
  }

  // ── Zoom transitions (GSAP timelines) ─────────────────

  private zoomToCluster(clusterId: string) {
    const cluster = this.clusters.find((c) => c.id === clusterId);
    if (!cluster) return;
    this.killTimeline();

    this.tl = gsap.timeline({
      onComplete: () => {
        this.state = { type: "cluster", id: clusterId };
      },
    });

    // 1. Fade out current content
    this.tl.to([this.markersEl, this.clustersEl], {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    });

    // 2. Set state + zoom
    this.tl.call(() => {
      this.map.className = "map map--cluster";
      this.map.setAttribute("data-active-cluster", clusterId);
      const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
      if (allRadio) allRadio.checked = true;
      this.image.style.transformOrigin = `${cluster.cx}% ${cluster.cy}%`;
      this.image.style.setProperty("--zoom", String(cluster.scale));
    });

    // 3. Zoom in
    this.tl.to(this.image, {
      scale: cluster.scale,
      duration: 0.9,
      ease: "power2.inOut",
    });
  }

  private zoomToHut(hutId: string) {
    const hut = this.huts.find((h) => h.id === hutId);
    if (!hut) return;
    this.killTimeline();

    this.tl = gsap.timeline({
      onComplete: () => {
        this.state = { type: "hut", id: hutId };
      },
    });

    // 1. Fade current content
    const fadeTargets = [this.markersEl, this.clustersEl];
    const hutMarkers = this.image.querySelector(".map__hut-markers");
    if (hutMarkers) fadeTargets.push(hutMarkers as HTMLElement);

    this.tl.to(fadeTargets, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    });

    // 2. Set state + zoom
    this.tl.call(() => {
      this.map.className = "map map--hut";
      this.map.removeAttribute("data-active-cluster");
      this.image.style.transformOrigin = `${hut.x}% ${hut.y}%`;
      this.image.style.setProperty("--zoom", String(hut.scale));
    });

    // 3. Zoom in
    this.tl.to(this.image, {
      scale: hut.scale,
      duration: 0.9,
      ease: "power2.inOut",
    });
  }

  private zoomToOverview() {
    this.killTimeline();

    this.tl = gsap.timeline({
      onComplete: () => {
        this.state = { type: "overview" };
      },
    });

    // 1. Fade out current content
    this.tl.to([this.markersEl, this.clustersEl], {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    });

    // 2. Uncheck radio, keep classes stable during zoom
    this.tl.call(() => {
      const allRadio = this.map.querySelector<HTMLInputElement>("#map-all");
      if (allRadio) allRadio.checked = true;
      this.image.style.setProperty("--zoom", "1");
    });

    // 3. Zoom out
    this.tl.to(this.image, {
      scale: 1,
      duration: 0.9,
      ease: "power2.inOut",
    });

    // 4. Switch to overview state, fade content back in
    this.tl.call(() => {
      this.map.className = "map";
      this.map.removeAttribute("data-active-cluster");
    });

    this.tl.to([this.markersEl, this.clustersEl], {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    });
  }

  private killTimeline() {
    if (this.tl) {
      this.tl.kill();
      this.tl = null;
    }
  }

  // ── Hover interactions ────────────────────────────────

  private setupHoverInteractions(container: HTMLElement) {
    const markerEls = container.querySelectorAll<HTMLElement>(
      ".marker[data-in-cluster]",
    );
    let dotLeaveTimer: ReturnType<typeof setTimeout> | null = null;
    let wordLeaveTimer: ReturnType<typeof setTimeout> | null = null;

    // Dot hover → highlight ring text
    for (const marker of markerEls) {
      const clusterId = marker.dataset.inCluster!;
      const hutId = marker
        .querySelector("label")
        ?.getAttribute("for")
        ?.replace("map-", "");
      if (!hutId) continue;

      marker.addEventListener("mouseenter", () => {
        if (dotLeaveTimer) {
          clearTimeout(dotLeaveTimer);
          dotLeaveTimer = null;
        }
        const group = container.querySelector(
          `[data-cluster="${clusterId}"]`,
        );
        if (!group) return;
        for (const text of group.querySelectorAll<HTMLElement>(
          ".cluster__ring-text",
        )) {
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
          const group = container.querySelector(
            `[data-cluster="${clusterId}"]`,
          );
          if (!group) return;
          for (const text of group.querySelectorAll<HTMLElement>(
            ".cluster__ring-text",
          )) {
            text.classList.remove(
              "cluster__ring-text--highlight",
              "cluster__ring-text--dim",
            );
          }
          dotLeaveTimer = null;
        }, 100);
      });
    }

    // Word hover → highlight dot
    const ringTexts = container.querySelectorAll<HTMLElement>(
      ".cluster__ring-text",
    );
    for (const text of ringTexts) {
      const hutId = text.dataset.hut;
      if (!hutId) continue;
      const clusterGroup = text.closest<HTMLElement>("[data-cluster]");
      const clusterId = clusterGroup?.dataset.cluster;
      if (!clusterId) continue;

      text.addEventListener("mouseenter", () => {
        if (wordLeaveTimer) {
          clearTimeout(wordLeaveTimer);
          wordLeaveTimer = null;
        }
        for (const m of markerEls) {
          if (m.dataset.inCluster !== clusterId) continue;
          const mHutId = m
            .querySelector("label")
            ?.getAttribute("for")
            ?.replace("map-", "");
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
        }, 100);
      });
    }
  }

  // ── Fix ring text spacing ─────────────────────────────

  private fixRingSpacing() {
    const rings = this.map.querySelectorAll<SVGGElement>(".cluster__ring");
    for (const ring of rings) {
      const texts = Array.from(
        ring.querySelectorAll<SVGTextElement>(".cluster__ring-text"),
      );
      if (texts.length < 2) continue;

      const pathId = texts[0]
        .querySelector("textPath")
        ?.getAttribute("href");
      if (!pathId) continue;
      const pathD =
        this.map.querySelector(pathId)?.getAttribute("d") || "";
      const rMatch = pathD.match(/a\s+([\d.]+)/);
      if (!rMatch) continue;
      const circumference = 2 * Math.PI * parseFloat(rMatch[1]);
      if (circumference <= 0) continue;

      const measured = texts.map(
        (t) => (t.getComputedTextLength() / circumference) * 100,
      );
      if (
        measured.some((m) => m <= 0) ||
        measured.reduce((s, v) => s + v, 0) >= 100
      )
        continue;

      const totalText = measured.reduce((s, v) => s + v, 0);
      const gapEach = (100 - totalText) / texts.length;

      let offset = gapEach / 2;
      for (let i = 0; i < texts.length; i++) {
        const tp = texts[i].querySelector("textPath");
        if (tp) tp.setAttribute("startOffset", `${offset.toFixed(1)}%`);
        offset += measured[i] + gapEach;
      }
    }
  }
}
