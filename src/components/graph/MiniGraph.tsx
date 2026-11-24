"use client";
// A small, readable React Flow graph laid out with dagre (left to right). Used for the hero preview, the
// diagnosis pane and the map's focus view. Never more than a few dozen nodes: no hairballs.
import { useMemo } from "react";
import { ReactFlow, Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import type { GEdge, GNode } from "@/lib/core/types";
import { REL_LABEL } from "@/lib/core/graph";
import { UpanishadEmblem } from "@/components/art/UpanishadEmblem";

export const KIND_COLOR: Record<GNode["type"], string> = {
  Verse: "var(--n-verse)",
  Concept: "var(--n-concept)",
  Dilemma: "var(--n-dilemma)",
  Axis: "var(--n-axis)",
  Story: "var(--n-story)",
  Person: "var(--n-person)",
  Upanishad: "var(--n-text)",
  External: "var(--n-external)",
  Veda: "var(--gold)",
  Stem: "var(--n-stem)",
};
const KIND_LABEL: Record<GNode["type"], string> = { Verse: "mantra", Concept: "concept", Dilemma: "situation", Axis: "axis", Story: "story", Person: "person", Upanishad: "Upanishad", External: "elsewhere", Veda: "Veda", Stem: "stem" };

type Data = { n: GNode; on: boolean; dim: boolean; emblem?: string };
function GNodeView({ data }: NodeProps<Node<Data>>) {
  const { n, on, dim, emblem } = data;
  if (emblem)
    return (
      <div className="rf-node flex items-center gap-2.5 !py-1.5 !pl-1.5" data-on={on ? "1" : "0"} data-dim={dim ? "1" : "0"}>
        <Handle type="target" position={Position.Left} />
        <UpanishadEmblem id={emblem} size={34} className="shrink-0 text-text-2" />
        <div className="min-w-0">
          <div className="k">{KIND_LABEL[n.type]}</div>
          <div className="font-semibold">{n.label}</div>
        </div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  return (
    <div className="rf-node" data-on={on ? "1" : "0"} data-dim={dim ? "1" : "0"}>
      <Handle type="target" position={Position.Left} />
      <div className="k"><span className="dot" style={{ background: KIND_COLOR[n.type] }} />{KIND_LABEL[n.type]}</div>
      <div className="font-semibold">{n.label}</div>
      {n.type === "Verse" && n.sub && <div className="mt-0.5 line-clamp-2 text-[11px] text-text-3">{n.sub}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { g: GNodeView };

export function MiniGraph({ nodes, edges, highlight, onPick, height = 360, direction = "LR", interactive = true, emblems = false }: {
  nodes: GNode[];
  edges: GEdge[];
  highlight?: Set<string>;
  onPick?: (id: string) => void;
  height?: number | string;
  direction?: "LR" | "TB";
  interactive?: boolean;
  /** Draw each Upanishad node with its emblem instead of the kind dot (the home page's Veda → Upanishad map). */
  emblems?: boolean;
}) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    // the emblem map (home) packs its thirteen texts tighter so it renders near full size
    g.setGraph({ rankdir: direction, nodesep: emblems ? 8 : 18, ranksep: emblems ? 110 : 70, marginx: 10, marginy: 10 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of nodes) g.setNode(n.id, { width: 178, height: n.type === "Verse" ? 66 : 46 });
    const ids = new Set(nodes.map((n) => n.id));
    const es = edges.filter((e) => ids.has(e.s) && ids.has(e.t));
    for (const e of es) g.setEdge(e.s, e.t);
    dagre.layout(g);
    const lit = highlight && highlight.size > 0;
    return {
      rfNodes: nodes.map<Node<Data>>((n) => {
        const p = g.node(n.id);
        return { id: n.id, type: "g", position: { x: (p?.x ?? 0) - 89, y: (p?.y ?? 0) - 23 }, data: { n, on: Boolean(lit && highlight!.has(n.id)), dim: Boolean(lit && !highlight!.has(n.id)), emblem: emblems && n.type === "Upanishad" ? n.id.replace(/^up:/, "") : undefined } };
      }),
      rfEdges: es.map<Edge>((e, i) => ({
        id: `${e.type}-${e.s}-${e.t}-${i}`,
        source: e.s,
        target: e.t,
        label: e.type === "PART_OF" || e.type === "NEXT" ? undefined : REL_LABEL[e.type].out,
        style: { stroke: e.type === "CONTRASTS_WITH" ? "var(--preyas)" : "var(--line-3)", strokeDasharray: e.basis === "editorial" ? "4 3" : undefined },
        labelStyle: { fill: "var(--text-3)", fontSize: 10 },
        labelBgStyle: { fill: "var(--bg)" },
      })),
    };
  }, [nodes, edges, highlight, direction, emblems]);

  return (
    <div style={{ height }} className="w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={interactive}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        zoomOnDoubleClick={false}
        panOnDrag={interactive}
        onNodeClick={(_, n) => onPick?.(n.id)}
        proOptions={{ hideAttribution: false }}
      />
    </div>
  );
}
