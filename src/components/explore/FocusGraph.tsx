"use client";
// The default map view: one node and its most meaningful neighbours (never more than 15), laid out radially in crisp
// HTML with React Flow. Fully keyboard-navigable: Tab or the arrow keys move between nodes, Enter re-centres,
// Backspace goes back. With nothing selected it shows the root map: the four Vedas and the thirteen Upanishads they
// distil (the Yajurveda's texts labelled by section, Śukla or Kṛṣṇa).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Handle, Position, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GEdge, GNode, GraphData, KbIndex } from "@/lib/core/types";
import { focus, indexGraph, REL_LABEL } from "@/lib/core/graph";
import { VEDA_ORDER } from "@/lib/core/layout";
import { explore, useExplore } from "@/lib/client/explore-store";
import { useAsk } from "@/lib/client/ask-store";
import { useReady } from "@/lib/client/capture";
import { KIND_COLOR } from "@/components/graph/MiniGraph";

const KIND: Record<GNode["type"], string> = { Verse: "mantra", Concept: "concept", Dilemma: "human situation", Axis: "axis", Story: "story", Person: "person", Upanishad: "Upanishad", External: "beyond the 13", Veda: "Veda", Stem: "word" };
const W = 184;
/** Room for the title card (top left) and the ask bar (bottom) that float over the map. */
const FIT_PADDING = { top: "230px", bottom: "150px", left: "48px", right: "48px" } as const;
type Data = { n: GNode; centre: boolean; on: boolean; dim: boolean; text?: string; lr?: boolean };

function FNode({ data }: NodeProps<Node<Data>>) {
  const { n, centre, on, dim, text, lr } = data;
  return (
    <div className="rf-node fg-node" data-centre={centre ? "1" : "0"} data-on={on ? "1" : "0"} data-dim={dim ? "1" : "0"} style={{ width: W, maxWidth: W }}>
      <Handle type="target" position={lr ? Position.Left : Position.Top} />
      <div className="k"><span className="dot" style={{ background: KIND_COLOR[n.type] }} />{KIND[n.type]}{text ? ` · ${text}` : ""}</div>
      <div className={`font-semibold ${n.type === "Stem" ? "iast" : ""}`}>{n.label}</div>
      {n.sub && n.type !== "Upanishad" && <div className="mt-0.5 line-clamp-2 text-[11px] text-text-3">{n.sub}</div>}
      <Handle type="source" position={lr ? Position.Right : Position.Bottom} />
    </div>
  );
}
const nodeTypes = { f: FNode };

/** Radial placement: the centre in the middle, direct neighbours on an ellipse grouped by kind, second-ring nodes outside their parent. */
function radial(center: string, ids: string[], edges: GEdge[], nodes: Map<string, GNode>) {
  const pos = new Map<string, { x: number; y: number }>([[center, { x: 0, y: 0 }]]);
  const direct = new Set<string>();
  for (const e of edges) {
    if (e.s === center) direct.add(e.t);
    if (e.t === center) direct.add(e.s);
  }
  const order = ["Veda", "Upanishad", "Story", "Person", "Concept", "Axis", "Dilemma", "Verse", "Stem", "External"];
  const ring1 = ids.filter((id) => id !== center && direct.has(id)).sort((a, b) => order.indexOf(nodes.get(a)!.type) - order.indexOf(nodes.get(b)!.type) || a.localeCompare(b));
  const ring2 = ids.filter((id) => id !== center && !direct.has(id));
  const rx = Math.max(330, ring1.length * 44);
  const ry = Math.max(190, ring1.length * 24);
  ring1.forEach((id, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, ring1.length)) * Math.PI * 2;
    pos.set(id, { x: Math.cos(a) * rx, y: Math.sin(a) * ry });
  });
  // Second ring: outside its parent, siblings spread along the tangent so they never stack.
  const byParent = new Map<string, string[]>();
  for (const id of ring2) {
    const parent = edges.map((e) => (e.s === id ? e.t : e.t === id ? e.s : null)).find((p) => p && ring1.includes(p)) ?? "";
    (byParent.get(parent) ?? byParent.set(parent, []).get(parent)!).push(id);
  }
  let orphan = 0;
  for (const [parent, list] of byParent) {
    const p = parent ? pos.get(parent)! : { x: (orphan++ - 1) * 230, y: ry * 1.7 };
    const len = Math.hypot(p.x, p.y) || 1;
    const [ux, uy] = [p.x / len, p.y / len];
    list.forEach((id, k) => {
      const off = (k - (list.length - 1) / 2) * 210;
      pos.set(id, { x: p.x + ux * 280 - uy * off, y: p.y + uy * 150 + ux * off * 0.45 });
    });
  }
  return pos;
}

export default function FocusGraph({ graph, ix }: { graph: GraphData; ix: KbIndex }) {
  const { selected, roots, path } = useExplore();
  const { highlight } = useAsk();
  const gi = useMemo(() => indexGraph(graph), [graph]);
  const rf = useRef<ReactFlowInstance<Node<Data>, Edge> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const textOf = useMemo(() => new Map(ix.texts.map((t) => [t.id, t])), [ix]);
  /** A Veda's Upanishads, the Yajurveda's grouped by section (Śukla first). */
  const textsOf = useCallback(
    (v: string) => ix.texts.filter((t) => t.lineage?.veda === v).sort((a, b) => (a.lineage?.section ?? "").localeCompare(b.lineage?.section ?? "") * -1 || a.order - b.order),
    [ix],
  );
  const sectionShort = useCallback((up?: string) => {
    const l = up ? textOf.get(up)?.lineage : undefined;
    return l?.sectionLabel ? `${l.sectionLabel.split(" ")[0]} section` : undefined;
  }, [textOf]);

  const view = useMemo(() => {
    const center = selected && gi.nodes.has(selected) ? selected : null;
    // A found path is shown as the subgraph itself.
    if (path?.nodes.length) return { center: path.from, ids: path.nodes, edges: path.edges, mode: "path" as const };
    if (!center) {
      // The root map: Vedas → their Upanishads.
      const ids = [...VEDA_ORDER.map((v) => `veda:${v}`), ...ix.texts.map((t) => `up:${t.id}`)].filter((id) => gi.nodes.has(id));
      const edges = graph.edges.filter((e) => e.type === "DISTILLS").map((e) => ({ ...e, s: e.t, t: e.s }));
      return { center: null, ids, edges, mode: "roots" as const };
    }
    const f = focus(gi, center, 15);
    let ids = f.nodes;
    let edges = f.edges;
    if (roots) {
      // Lineage lens: make room for the chain mantra → Upanishad → Veda and any Saṃhitā root.
      const n = gi.nodes.get(center)!;
      const chain: string[] = [];
      if (n.up) chain.push(`up:${n.up}`);
      const up = n.type === "Upanishad" ? center : n.up ? `up:${n.up}` : null;
      const veda = up && (gi.adj.get(up) || []).find((a) => a.e.type === "DISTILLS")?.to;
      if (veda) chain.push(veda);
      for (const a of gi.adj.get(center) || []) if (a.e.type === "ROOTED_IN" || a.e.type === "READ_BY") chain.push(a.to);
      const keep = new Set([center, ...chain]);
      for (const id of ids) if (keep.size < 15) keep.add(id);
      ids = [...keep];
      const set = new Set(ids);
      edges = graph.edges.filter((e) => set.has(e.s) && set.has(e.t) && e.type !== "NEXT" && e.type !== "HAS_STEM");
    }
    return { center, ids, edges, mode: "focus" as const };
  }, [selected, gi, roots, path, graph, ix]);

  const { rfNodes, rfEdges } = useMemo(() => {
    const lit = highlight?.nodes.length ? new Set(highlight.nodes) : null;
    let pos: Map<string, { x: number; y: number }>;
    if (view.mode === "roots") {
      pos = new Map();
      // Two columns (Ṛg and Yajus; Sāma and Atharva), so the map stays wide rather than tall, and legible.
      const rows = [0, 0];
      VEDA_ORDER.forEach((v, i) => {
        const col = i < 2 ? 0 : 1;
        const ups = textsOf(v);
        const first = rows[col];
        ups.forEach((t) => pos.set(`up:${t.id}`, { x: col * 820 + 380, y: rows[col]++ * 74 }));
        pos.set(`veda:${v}`, { x: col * 820, y: ((first + rows[col] - 1) / 2) * 74 });
        rows[col] += 0.5;
      });
    } else if (view.mode === "path") {
      pos = new Map(view.ids.map((id, i) => [id, { x: i * 270, y: i % 2 ? 60 : 0 }]));
    } else pos = radial(view.center!, view.ids, view.edges, gi.nodes);
    const rfNodes = view.ids
      .filter((id) => gi.nodes.has(id))
      .map<Node<Data>>((id) => {
        const n = gi.nodes.get(id)!;
        const p = pos.get(id) ?? { x: 0, y: 0 };
        return {
          id,
          type: "f",
          position: { x: p.x - W / 2, y: p.y - 30 },
          data: { n, centre: id === view.center, on: Boolean(lit?.has(id)), dim: Boolean(lit && !lit.has(id)), text: n.type === "Verse" ? textOf.get(n.up ?? "")?.iast : n.type === "Upanishad" && view.mode === "roots" ? sectionShort(n.up) : undefined, lr: view.mode !== "focus" },
          ariaLabel: `${KIND[n.type]}: ${n.label}`,
        };
      });
    const quiet = new Set(["PART_OF", "NEXT", "HAS_STEM", "DISTILLS"]);
    const showLabel = (e: GEdge) => !quiet.has(e.type) && (view.mode === "path" || e.s === view.center || e.t === view.center);
    const rfEdges = view.edges.map<Edge>((e, i) => ({
      id: `${e.type}|${e.s}|${e.t}|${i}`,
      source: e.s,
      target: e.t,
      type: view.mode === "roots" ? "default" : "straight",
      label: showLabel(e) ? REL_LABEL[e.type].out : undefined,
      style: {
        stroke: e.type === "CONTRASTS_WITH" ? "var(--preyas)" : e.type === "DISTILLS" || e.type === "ROOTED_IN" ? "var(--gold)" : e.basis === "shankara" ? "var(--accent)" : "var(--line-3)",
        strokeWidth: view.mode === "path" ? 2 : 1.2,
        strokeDasharray: e.basis === "editorial" ? "4 3" : undefined,
      },
      labelStyle: { fill: "var(--text-3)", fontSize: 10.5 },
      labelBgStyle: { fill: "var(--bg)" },
      labelBgPadding: [4, 2] as [number, number],
    }));
    return { rfNodes, rfEdges };
  }, [view, gi, highlight, ix, textOf]);

  // Refit whenever the subgraph changes.
  useEffect(() => {
    const t = setTimeout(() => rf.current?.fitView({ padding: FIT_PADDING, duration: 350 }), 30);
    return () => clearTimeout(t);
  }, [rfNodes]);
  useReady(true);

  const order = rfNodes.map((n) => n.id);
  const move = useCallback(
    (dir: 1 | -1) => {
      if (!order.length) return;
      const i = active ? order.indexOf(active) : -1;
      const next = order[(i + dir + order.length) % order.length];
      setActive(next);
      (wrap.current?.querySelector(`.react-flow__node[data-id="${CSS.escape(next)}"]`) as HTMLElement | null)?.focus();
    },
    [order, active],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest(".react-flow__node") as HTMLElement | null;
    const id = el?.dataset.id ?? active;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if ((e.key === "Enter" || e.key === " ") && id) { e.preventDefault(); explore.select(id); }
    else if (e.key === "Backspace") { e.preventDefault(); explore.back(); }
    else if (e.key === "Escape") { e.preventDefault(); explore.home(); }
  };

  // Phones: the same subgraph as a list of tappable cards (a 15-node drawing is unreadable at 390 px).
  if (narrow) {
    const nodes = rfNodes.map((n) => n.data.n);
    const centre = view.center ? gi.nodes.get(view.center) : null;
    const rel = (id: string) => {
      const e = view.edges.find((x) => (x.s === view.center && x.t === id) || (x.t === view.center && x.s === id));
      return e ? (e.s === view.center ? REL_LABEL[e.type].out : REL_LABEL[e.type].in) : null;
    };
    const groups = new Map<string, GNode[]>();
    for (const n of nodes) if (n.id !== view.center) (groups.get(n.type) ?? groups.set(n.type, []).get(n.type)!).push(n);
    return (
      <div className="focus-list scroll-thin absolute inset-0 overflow-y-auto px-3 pb-28 pt-[252px]" aria-label={centre ? `Focus on ${centre.label}` : "Root map: the four Vedas and the thirteen Upanishads"}>
        {centre && (
          <div className="rf-node fg-node mb-4 !max-w-none" data-centre="1">
            <div className="k"><span className="dot" style={{ background: KIND_COLOR[centre.type] }} />{KIND[centre.type]}</div>
            <div className="text-[16px] font-semibold">{centre.label}</div>
            {centre.sub && <div className="mt-0.5 text-[12.5px] text-text-3">{centre.sub}</div>}
          </div>
        )}
        {view.mode === "roots"
          ? VEDA_ORDER.map((v) => {
              const veda = gi.nodes.get(`veda:${v}`);
              if (!veda) return null;
              return (
                <div key={v} className="mb-4">
                  <button className="rf-node fg-node !max-w-none w-full text-left" onClick={() => explore.select(veda.id)}>
                    <div className="k"><span className="dot" style={{ background: KIND_COLOR.Veda }} />Veda</div>
                    <div className="font-semibold">{veda.label}</div>
                  </button>
                  <div className="ml-4 mt-1.5 grid grid-cols-2 gap-1.5 border-l border-line-2 pl-3">
                    {textsOf(v).map((t) => (
                      <button key={t.id} className="rf-node !max-w-none text-left" onClick={() => explore.select(`up:${t.id}`)}>
                        {t.iast}
                        {sectionShort(t.id) && <span className="block text-[10.5px] uppercase tracking-wider text-text-4">{sectionShort(t.id)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          : [...groups].map(([type, list]) => (
              <div key={type} className="mb-4">
                <p className="eyebrow mb-1.5">{KIND[type as GNode["type"]]}</p>
                <div className="grid gap-1.5">
                  {list.map((n) => (
                    <button key={n.id} className="rf-node fg-node !max-w-none w-full text-left" onClick={() => explore.select(n.id)}>
                      {rel(n.id) && <div className="k">{rel(n.id)}</div>}
                      <div className="font-semibold">{n.type === "Verse" ? `${n.label} · ${textOf.get(n.up ?? "")?.iast ?? ""}` : n.label}</div>
                      {n.sub && n.type !== "Upanishad" && <div className="mt-0.5 line-clamp-2 text-[12px] text-text-3">{n.sub}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
      </div>
    );
  }

  return (
    <div ref={wrap} className="focus-graph absolute inset-0" onKeyDown={onKeyDown} role="application" aria-label={view.center ? `Focus on ${gi.nodes.get(view.center)?.label}. Arrow keys move between nodes, Enter re-centres, Backspace goes back, Escape returns to the root map.` : "Root map: the four Vedas and the thirteen Upanishads. Arrow keys move, Enter opens."}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onInit={(i) => (rf.current = i)}
        fitView
        fitViewOptions={{ padding: FIT_PADDING }}
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable
        edgesFocusable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        onNodeClick={(_, n) => explore.select(n.id)}
        onNodeMouseEnter={(_, n) => setActive(n.id)}
        proOptions={{ hideAttribution: false }}
      />
    </div>
  );
}
