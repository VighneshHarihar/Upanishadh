"use client";
// The map: what is selected, which view (focus subgraph by default, the whole map, or the optional 3D cosmos), the
// Vedic-roots lens, a found path, and camera commands from the toolbar.
import { useSyncExternalStore } from "react";
import type { GEdge, NodeType } from "@/lib/core/types";

export type ColorBy = "text" | "type";
export type ViewMode = "focus" | "2d" | "3d";
export type CameraCmd = { kind: "zoomIn" | "zoomOut" | "fit" | "home"; n: number };

export interface ExploreState {
  selected: string | null;
  /** Focus-view trail, for Back. */
  trail: string[];
  view: ViewMode;
  colorBy: ColorBy;
  hidden: NodeType[];
  dock: "details" | "ask" | "path" | null;
  autoRotate: boolean;
  camera: CameraCmd | null;
  flyTo: { id: string; n: number } | null;
  /** Vedic Roots (Sāra) lens: Veda → Upanishad lineage and the Saṃhitā mantras taken up. */
  roots: boolean;
  path: { from: string; to: string; nodes: string[]; edges: GEdge[] } | null;
}

let state: ExploreState = { selected: null, trail: [], view: "focus", colorBy: "text", hidden: [], dock: null, autoRotate: true, camera: null, flyTo: null, roots: false, path: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<ExploreState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let n = 0;

export const useExplore = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );

export const explore = {
  get: () => state,
  select: (id: string | null, fly = true) =>
    set({
      selected: id,
      trail: id && id !== state.selected ? [...state.trail, ...(state.selected ? [state.selected] : [])].slice(-30) : state.trail,
      dock: id ? (state.dock === "path" || state.dock === "ask" ? state.dock : "details") : state.dock === "details" ? null : state.dock,
      ...(id && fly ? { flyTo: { id, n: ++n }, autoRotate: false } : {}),
    }),
  back: () => {
    const trail = [...state.trail];
    const prev = trail.pop() ?? null;
    set({ selected: prev, trail, ...(prev ? { flyTo: { id: prev, n: ++n } } : {}) });
  },
  home: () => set({ selected: null, trail: [] }),
  setView: (view: ViewMode) => set({ view }),
  setColorBy: (colorBy: ColorBy) => set({ colorBy }),
  toggleType: (t: NodeType) => set({ hidden: state.hidden.includes(t) ? state.hidden.filter((x) => x !== t) : [...state.hidden, t] }),
  setDock: (dock: ExploreState["dock"]) => set({ dock }),
  setAutoRotate: (autoRotate: boolean) => set({ autoRotate }),
  setRoots: (roots: boolean) => set({ roots }),
  setPath: (path: ExploreState["path"]) => set({ path }),
  camera: (kind: CameraCmd["kind"]) => set({ camera: { kind, n: ++n }, ...(kind !== "home" ? { autoRotate: false } : {}) }),
  flyTo: (id: string) => set({ flyTo: { id, n: ++n }, autoRotate: false }),
};
