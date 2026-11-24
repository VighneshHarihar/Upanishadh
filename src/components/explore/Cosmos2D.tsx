"use client";
// The same cosmos seen from above: a flat map of dots (the 3D layout's x/z plane). Lighter than 3D, and the clearest
// way to see which mantras cluster around which text and which ideas sit between them.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { loadGraph, loadIndex, loadLayout } from "@/lib/client/data";
import { useAsk } from "@/lib/client/ask-store";
import { explore, useExplore } from "@/lib/client/explore-store";
import { useTheme } from "@/lib/client/theme";
import { useReady } from "@/lib/client/capture";
import type { GNode as DNode, GraphData, KbIndex, NodeType, Rel } from "@/lib/core/types";
import { nodeColor } from "./palette";

type NodeT = { id: string; t: NodeType; d: DNode; r: number; color: string };
type N = NodeObject<NodeT>;
type L = LinkObject<NodeT, { key: string; type: Rel }>;
const STRUCT = new Set<Rel>(["PART_OF", "NEXT", "DISTILLS"]);
/** Drawn only through emphasis (a stem touches hundreds of passages). */
const HIDDEN_LINKS = new Set<Rel>(["HAS_STEM"]);
const ROOT_RELS = new Set<Rel>(["DISTILLS", "ROOTED_IN", "READ_BY"]);
const ekey = (e: { s: string; t: string; type: string }) => `${e.s}|${e.t}|${e.type}`;
const R: Record<NodeType, number> = { Veda: 12, Upanishad: 9, Axis: 5, Concept: 4, Dilemma: 4.4, Story: 4.2, Person: 3.2, External: 3.2, Stem: 2.8, Verse: 1.9 };

export default function Cosmos2D({ offsetRight = 0 }: { offsetRight?: number }) {
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [kb, setKb] = useState<KbIndex | null>(null);
  const [layout, setLayout] = useState<Record<string, [number, number, number]> | null>(null);
  const { selected, colorBy, hidden, camera, flyTo, roots, path } = useExplore();
  const { highlight } = useAsk();
  const dark = useTheme() === "dark";
  const [hover, setHover] = useState<string | null>(null);
  const font = useRef("Inter, system-ui, sans-serif");

  useEffect(() => {
    loadGraph().then(setGraph);
    loadIndex().then(setKb);
    loadLayout().then(setLayout);
    const inter = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
    if (inter) font.current = `${inter}, system-ui, sans-serif`;
  }, []);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(200, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const texts = useMemo(() => new Map((kb?.texts ?? []).map((t) => [t.id, t])), [kb]);
  const base = useMemo(() => {
    if (!graph || !layout) return null;
    const nodes = new Map<string, N>();
    for (const d of graph.nodes) {
      const p = layout[d.id];
      if (!p) continue;
      nodes.set(d.id, { id: d.id, t: d.type, d, r: R[d.type], color: "#999", fx: p[0], fy: p[2], x: p[0], y: p[2] });
    }
    const adj = new Map<string, { to: string; key: string }[]>();
    for (const e of graph.edges) {
      (adj.get(e.s) ?? adj.set(e.s, []).get(e.s)!).push({ to: e.t, key: ekey(e) });
      (adj.get(e.t) ?? adj.set(e.t, []).get(e.t)!).push({ to: e.s, key: ekey(e) });
    }
    return { nodes, edges: graph.edges, adj };
  }, [graph, layout]);

  const data = useMemo(() => {
    if (!base) return { nodes: [] as N[], links: [] as L[] };
    for (const n of base.nodes.values()) n.color = nodeColor({ type: n.t, up: n.d.up, id: n.id }, colorBy, dark);
    const nodes = [...base.nodes.values()].filter((n) => !hidden.includes(n.t));
    const shown = new Set(nodes.map((n) => n.id));
    const links = base.edges.filter((e) => !HIDDEN_LINKS.has(e.type) && shown.has(e.s) && shown.has(e.t)).map((e) => ({ key: ekey(e), type: e.type, source: base.nodes.get(e.s)!, target: base.nodes.get(e.t)! })) as L[];
    // draw order: verses first, hubs and ideas on top
    nodes.sort((a, b) => (a.t === "Verse" ? 0 : 1) - (b.t === "Verse" ? 0 : 1));
    return { nodes, links };
  }, [base, hidden, colorBy, dark]);

  const emphasis = useMemo(() => {
    if (path?.nodes.length) return { nodes: new Set(path.nodes), edges: new Set(path.edges.map(ekey)), answer: true };
    if (highlight?.nodes.length) return { nodes: new Set(highlight.nodes), edges: new Set(highlight.edges.map(ekey)), answer: true };
    const f = hover ?? selected;
    if (f && base?.adj.has(f)) {
      const nodes = new Set([f]);
      const edges = new Set<string>();
      for (const a of base.adj.get(f)!) {
        nodes.add(a.to);
        edges.add(a.key);
      }
      return { nodes, edges, answer: false };
    }
    if (roots && base) {
      // Vedic roots (Sāra): the Vedas, their Upanishads, and the mantras taken up from the Saṃhitās.
      const nodes = new Set<string>();
      const edges = new Set<string>();
      for (const e of base.edges) {
        if (!ROOT_RELS.has(e.type)) continue;
        nodes.add(e.s);
        nodes.add(e.t);
        edges.add(ekey(e));
      }
      return { nodes, edges, answer: false };
    }
    return null;
  }, [highlight, hover, selected, base, roots, path]);

  const ink = dark ? "236,239,233" : "23,26,24";
  const linkColor = useCallback(
    (l: L) => {
      if (emphasis) return emphasis.edges.has(l.key) ? (emphasis.answer ? (dark ? "rgba(240,198,116,0.9)" : "rgba(154,101,20,0.9)") : `rgba(${ink},0.55)`) : `rgba(${ink},0.025)`;
      const s = l.source as N;
      return STRUCT.has(l.type) ? hexA(s.color, dark ? 0.16 : 0.2) : `rgba(${ink},${dark ? 0.09 : 0.1})`;
    },
    [emphasis, ink, dark],
  );

  const paint = useCallback(
    (n: N, ctx: CanvasRenderingContext2D, scale: number) => {
      const on = !emphasis || emphasis.nodes.has(n.id);
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const r = n.r;
      ctx.globalAlpha = on ? 1 : 0.12;
      if (dark && on && n.t !== "Verse") {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
        g.addColorStop(0, hexA(n.color, n.t === "Upanishad" ? 0.42 : 0.26));
        g.addColorStop(1, hexA(n.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      if (n.t === "Story") {
        ctx.moveTo(x, y - r * 1.2);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r * 1.2);
        ctx.lineTo(x - r, y);
        ctx.closePath();
      } else ctx.arc(x, y, n.t === "Dilemma" ? r * 0.45 : r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      if (n.t === "Veda") {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(n.color, 0.6);
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.lineWidth = 1.2 / Math.max(0.6, scale * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (n.t === "Dilemma" || n.t === "Axis" || n.t === "Upanishad" || n.t === "External") {
        ctx.beginPath();
        ctx.arc(x, y, n.t === "Upanishad" ? r * 1.55 : r * 1.25, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(n.color, 0.8);
        ctx.lineWidth = (n.t === "Dilemma" ? 1.6 : 0.9) / Math.max(0.6, scale * 0.5);
        ctx.stroke();
      }
      if (n.id === selected) {
        ctx.beginPath();
        ctx.arc(x, y, r * 2.2 + 2, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? "#f0c674" : "#9a6514";
        ctx.lineWidth = 1.6 / scale;
        ctx.stroke();
      }
      // labels: hubs always; ideas when zoomed in or emphasised; mantras only when focused
      const focus = n.id === selected || n.id === hover;
      const show = n.t === "Veda" || n.t === "Upanishad" || n.t === "Axis" || (roots && on && n.t === "External") || focus || (on && emphasis && emphasis.nodes.size < 60 && (n.t !== "Verse" || emphasis.nodes.size < 30)) || (n.t !== "Verse" && scale > 1.6);
      if (show && (on || n.t === "Upanishad" || n.t === "Veda")) {
        const px = n.t === "Veda" ? 15 : n.t === "Upanishad" ? 13 : n.t === "Verse" ? 10 : 11;
        const fs = px / Math.min(Math.max(scale, 0.5), 3) ;
        ctx.font = `${n.t === "Veda" || n.t === "Upanishad" || n.t === "Axis" || focus ? 600 : 500} ${fs}px ${font.current}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = dark ? "rgba(7,9,8,0.9)" : "rgba(243,242,238,0.92)";
        const ty = y - r * (n.t === "Veda" ? 2.1 : n.t === "Upanishad" ? 1.8 : 1.4) - 2 / scale;
        ctx.strokeText(n.d.label, x, ty);
        ctx.fillStyle = n.t === "Veda" ? (dark ? "#f0c674" : "#7a4f0c") : n.t === "Axis" ? (dark ? "#bff0dc" : "#1f5c47") : dark ? "#eceee8" : "#1b1d1a";
        ctx.fillText(n.d.label, x, ty);
      }
      ctx.globalAlpha = 1;
    },
    [emphasis, dark, selected, hover, roots],
  );
  const pointer = useCallback((n: N, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x ?? 0, n.y ?? 0, Math.max(4, n.r * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }, []);
  const tip = useCallback(
    (n: N) => {
      const t = texts.get(n.d.up ?? "");
      return `<div class="cos-tip"><div class="t"><i style="background:${n.color}"></i>${n.t === "Verse" ? `Mantra · ${t?.iast ?? ""}` : n.t === "Stem" ? "Word" : n.t}</div><div class="h">${esc(n.d.label)}</div>${n.d.sub ? `<div class="s">${esc(n.d.sub.slice(0, 170))}</div>` : ""}</div>`;
    },
    [texts],
  );

  const fitted = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !base || fitted.current) return;
    fitted.current = true;
    setTimeout(() => fg.zoomToFit(0, 40), 30);
  }, [base]);
  const lastCmd = useRef(0);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !camera || camera.n === lastCmd.current) return;
    lastCmd.current = camera.n;
    if (camera.kind === "fit" || camera.kind === "home") fg.zoomToFit(500, 40);
    else fg.zoom(fg.zoom() * (camera.kind === "zoomIn" ? 1.45 : 0.7), 400);
  }, [camera]);
  const lastFly = useRef(0);
  useEffect(() => {
    const fg = fgRef.current;
    const n = flyTo && base?.nodes.get(flyTo.id);
    if (!fg || !flyTo || !n || flyTo.n === lastFly.current) return;
    lastFly.current = flyTo.n;
    fg.centerAt(n.x, n.y, 700);
    fg.zoom(Math.max(fg.zoom(), n.t === "Verse" ? 4 : 2.4), 700);
  }, [flyTo, base]);
  useEffect(() => {
    const fg = fgRef.current;
    const focusIds = path?.nodes.length ? path.nodes : highlight?.nodes;
    if (!fg || !focusIds?.length) return;
    const ids = new Set(focusIds);
    const t = setTimeout(() => fg.zoomToFit(800, 80, (n) => ids.has(String(n.id))), 120);
    return () => clearTimeout(t);
  }, [highlight, path]);
  useReady(!!base);

  return (
    <div ref={wrapRef} className="absolute inset-y-0 left-0" style={{ right: offsetRight }} role="img" aria-label="Map of the thirteen Upanishads, grouped by Veda. Use the Focus view for keyboard navigation.">
      {base && (
        <ForceGraph2D<NodeT, { key: string; type: Rel }>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor={dark ? "#070908" : "#f3f2ee"}
          nodeCanvasObject={paint}
          nodePointerAreaPaint={pointer}
          nodeLabel={tip}
          linkColor={linkColor}
          linkWidth={(l: L) => (emphasis?.edges.has(l.key) ? 1.4 : 0.6)}
          linkDirectionalParticles={(l: L) => (emphasis?.answer && emphasis.edges.has(l.key) && !STRUCT.has(l.type) ? 2 : 0)}
          linkDirectionalParticleWidth={2.4}
          linkDirectionalParticleColor={() => (dark ? "#ffe2a8" : "#9a6514")}
          onNodeHover={(n: N | null) => {
            setHover(n ? String(n.id) : null);
            if (wrapRef.current) wrapRef.current.style.cursor = n ? "pointer" : "";
          }}
          onNodeClick={(n: N) => explore.select(String(n.id))}
          onBackgroundClick={() => explore.get().selected && explore.select(null)}
          enableNodeDrag={false}
          cooldownTicks={0}
          warmupTicks={0}
          minZoom={0.3}
          maxZoom={14}
        />
      )}
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
