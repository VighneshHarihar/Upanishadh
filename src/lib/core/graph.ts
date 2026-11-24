import type { GEdge, GNode, Rel } from "./types.ts";

export interface Adj {
  to: string;
  e: GEdge;
  out: boolean;
}
export interface GraphIndex {
  nodes: Map<string, GNode>;
  adj: Map<string, Adj[]>;
}

export function indexGraph(g: { nodes: GNode[]; edges: GEdge[] }): GraphIndex {
  const nodes = new Map(g.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Adj[]>();
  const push = (k: string, a: Adj) => {
    const l = adj.get(k);
    if (l) l.push(a);
    else adj.set(k, [a]);
  };
  for (const e of g.edges) {
    push(e.s, { to: e.t, e, out: true });
    push(e.t, { to: e.s, e, out: false });
  }
  return { nodes, adj };
}

/** How strongly a relation carries meaning, for retrieval scoring and for choosing what a focus view shows first. */
export const REL_WEIGHT: Record<Rel, number> = {
  DIAGNOSES: 1.2,
  TEACHES: 1,
  CONTRASTS_WITH: 0.9,
  CROSS_REFERENCES: 0.7,
  CITES: 0.65,
  IN_STORY: 0.6,
  ROOTED_IN: 0.55,
  GROUNDS: 0.5,
  READ_BY: 0.45,
  NEXT: 0.2,
  HAS_STEM: 0.08,
  DISTILLS: 0.06,
  PART_OF: 0.05,
};
/** Relations used for navigation only: retrieval never walks through them (a stem touches hundreds of passages). */
export const NAVIGATION_ONLY = new Set<Rel>(["PART_OF", "NEXT", "HAS_STEM", "DISTILLS"]);

export const REL_LABEL: Record<Rel, { out: string; in: string }> = {
  PART_OF: { out: "part of", in: "contains" },
  NEXT: { out: "followed by", in: "follows" },
  IN_STORY: { out: "appears in", in: "includes" },
  TEACHES: { out: "teaches", in: "taught by" },
  CONTRASTS_WITH: { out: "contrasts with", in: "contrasts with" },
  DIAGNOSES: { out: "speaks to", in: "addressed by" },
  CROSS_REFERENCES: { out: "parallels", in: "parallels" },
  GROUNDS: { out: "grounds axis", in: "grounded in" },
  DISTILLS: { out: "is the essence (sāra) of", in: "distilled in" },
  ROOTED_IN: { out: "takes up the Saṃhitā mantra", in: "taken up in" },
  READ_BY: { out: "is read by", in: "reads" },
  CITES: { out: "Śaṅkara, commenting here, cites", in: "cited by Śaṅkara on" },
  HAS_STEM: { out: "has the word", in: "occurs in" },
};

/** graph.json as shipped: structural edges are derived on load instead of being stored. */
export interface CompactGraph {
  v: 2;
  nodes: GNode[];
  edges: GEdge[];
  /** Stem id → passages that carry it (HAS_STEM). */
  stems: Record<string, string[]>;
}
/** Rebuild the full graph: PART_OF from each passage's text, NEXT from passage order, HAS_STEM from the stem lists. */
export function expandGraph(g: CompactGraph | { nodes: GNode[]; edges: GEdge[] }): { nodes: GNode[]; edges: GEdge[] } {
  if (!("v" in g) || g.v !== 2) return { nodes: g.nodes, edges: g.edges };
  const edges: GEdge[] = [];
  let prev: GNode | null = null;
  for (const n of g.nodes) {
    if (n.type !== "Verse") continue;
    edges.push({ s: n.id, t: `up:${n.up}`, type: "PART_OF", basis: "text" });
    if (prev && prev.up === n.up) edges.push({ s: prev.id, t: n.id, type: "NEXT", basis: "text" });
    prev = n;
  }
  for (const [stem, verses] of Object.entries(g.stems)) for (const v of verses) edges.push({ s: v, t: stem, type: "HAS_STEM", basis: "text" });
  return { nodes: g.nodes, edges: [...edges, ...g.edges] };
}

/** A readable focus view: the centre plus its most meaningful neighbours, capped (no hairballs). */
export function focus(gi: GraphIndex, center: string, limit = 15): { nodes: string[]; edges: GEdge[] } {
  if (!gi.nodes.has(center)) return { nodes: [], edges: [] };
  const picked = new Set([center]);
  const ranked = (gi.adj.get(center) || [])
    .filter((a) => a.e.type !== "PART_OF" || gi.nodes.get(center)?.type !== "Upanishad")
    .filter((a) => !(a.e.type === "HAS_STEM" && gi.nodes.get(center)?.type === "Stem"))
    .sort((a, b) => REL_WEIGHT[b.e.type] - REL_WEIGHT[a.e.type] || a.to.localeCompare(b.to));
  // A stem's focus view shows a sample of its passages from as many texts as possible.
  if (gi.nodes.get(center)?.type === "Stem") {
    const byText = new Map<string, string[]>();
    for (const a of gi.adj.get(center) || []) {
      const up = gi.nodes.get(a.to)?.up ?? "";
      (byText.get(up) ?? byText.set(up, []).get(up)!).push(a.to);
    }
    for (let i = 0; picked.size < limit && i < 50; i++) for (const list of byText.values()) if (list[i] && picked.size < limit) picked.add(list[i]);
    return { nodes: [...picked], edges: induced(gi, picked) };
  }
  for (const a of ranked) {
    if (picked.size >= limit) break;
    picked.add(a.to);
  }
  // A whole Upanishad: after its Veda and stories, its most connected passages (not all of them).
  if (gi.nodes.get(center)?.type === "Upanishad") {
    const sem = (id: string) => (gi.adj.get(id) || []).filter((a) => !NAVIGATION_ONLY.has(a.e.type)).length;
    const passages = (gi.adj.get(center) || [])
      .filter((a) => a.e.type === "PART_OF")
      .map((a) => a.to)
      .sort((x, y) => sem(y) - sem(x) || x.localeCompare(y, undefined, { numeric: true }));
    for (const id of passages) {
      if (picked.size >= limit) break;
      picked.add(id);
    }
    return { nodes: [...picked], edges: induced(gi, picked) };
  }
  // Second ring only for strong relations, while there is room.
  if (picked.size < limit) {
    for (const id of [...picked]) {
      if (id === center) continue;
      for (const a of (gi.adj.get(id) || []).sort((x, y) => REL_WEIGHT[y.e.type] - REL_WEIGHT[x.e.type])) {
        if (picked.size >= limit) break;
        if (REL_WEIGHT[a.e.type] >= 0.9 && gi.nodes.get(a.to)?.type !== "Upanishad") picked.add(a.to);
      }
    }
  }
  return { nodes: [...picked], edges: induced(gi, picked) };
}

/**
 * The most meaningful short route between two nodes (Dijkstra). Strong relations are cheap; navigation links and
 * passing *through* a hub (a whole Upanishad, a Veda, a common word) are expensive, so the route says something
 * instead of "both are in the Chāndogya".
 */
export function shortestPath(gi: GraphIndex, from: string, to: string, maxCost = 40): { nodes: string[]; edges: GEdge[] } | null {
  if (!gi.nodes.has(from) || !gi.nodes.has(to)) return null;
  if (from === to) return { nodes: [from], edges: [] };
  const HUB: Partial<Record<GNode["type"], number>> = { Upanishad: 4, Veda: 5, Stem: 9, Axis: 1.5 };
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { id: string; e: GEdge }>();
  const done = new Set<string>();
  // Small graph (≈2k nodes): a sorted frontier array is plenty.
  const frontier: [number, string][] = [[0, from]];
  while (frontier.length) {
    frontier.sort((a, b) => a[0] - b[0]);
    const [d, id] = frontier.shift()!;
    if (done.has(id)) continue;
    done.add(id);
    if (id === to) break;
    if (d > maxCost) break;
    const through = id === from ? 0 : (HUB[gi.nodes.get(id)!.type] ?? 0);
    for (const a of gi.adj.get(id) || []) {
      if (done.has(a.to)) continue;
      const w = 1 + (1.3 - Math.min(1.2, REL_WEIGHT[a.e.type])) * 2 + (a.e.type === "NEXT" ? 1.5 : 0) + through;
      const nd = d + w;
      if (nd < (dist.get(a.to) ?? Infinity)) {
        dist.set(a.to, nd);
        prev.set(a.to, { id, e: a.e });
        frontier.push([nd, a.to]);
      }
    }
  }
  if (!prev.has(to)) return null;
  const nodes = [to];
  const edges: GEdge[] = [];
  for (let cur = to; cur !== from; ) {
    const p = prev.get(cur)!;
    edges.unshift(p.e);
    nodes.unshift(p.id);
    cur = p.id;
  }
  return { nodes, edges };
}

export function induced(gi: GraphIndex, set: Set<string>): GEdge[] {
  const out: GEdge[] = [];
  const seen = new Set<string>();
  for (const id of set) {
    for (const a of gi.adj.get(id) || []) {
      if (!a.out || !set.has(a.to)) continue;
      const k = `${a.e.type}|${a.e.s}|${a.e.t}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a.e);
      }
    }
  }
  return out;
}
