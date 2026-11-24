"use client";
// The cosmos: the whole knowledge graph in 3D. Positions are precomputed at build time (deterministic), so the
// browser never runs a simulation: the nine Upanishads sit on a ring, each with its mantras clustered around it, and
// the ideas (axes, concepts, human situations, stories, people) form a mandala at the centre, each placed toward the
// texts that teach it. Links are batched into a few draw calls; labels fade in with proximity; rendering sleeps when
// nothing moves.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { loadGraph, loadKb, loadLayout } from "@/lib/client/data";
import { useAsk } from "@/lib/client/ask-store";
import { explore, useExplore } from "@/lib/client/explore-store";
import { useTheme } from "@/lib/client/theme";
import { useReady } from "@/lib/client/capture";
import { CORE_RINGS as LAYOUT_RINGS, RING_R } from "@/lib/core/layout";
import type { GNode as DNode, GraphData, KnowledgeBase, NodeType, Rel } from "@/lib/core/types";
import { nodeColor } from "./palette";

type NodeT = { id: string; t: NodeType; d: DNode; deg: number };
type LinkT = { key: string; type: Rel };
type N = NodeObject<NodeT>;
type L = LinkObject<NodeT, LinkT>;
type LinkRec = { key: string; type: Rel; s: string; t: string };

const STRUCT = new Set<Rel>(["PART_OF", "NEXT", "HAS_STEM", "DISTILLS"]);
/** Links never drawn as lines (a stem touches hundreds of passages); they still count for emphasis. */
const HIDDEN_LINKS = new Set<Rel>(["HAS_STEM"]);
const ROOT_RELS = new Set<Rel>(["DISTILLS", "ROOTED_IN", "READ_BY"]);
const CORE_RINGS: [number, number][] = Object.values(LAYOUT_RINGS).map((c) => [c.r * RING_R, c.y]);
const ekey = (e: { s: string; t: string; type: string }) => `${e.s}|${e.t}|${e.type}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const KIND: Record<NodeType, string> = { Veda: "Veda", Upanishad: "Upanishad", Verse: "Mantra", Concept: "Concept", Dilemma: "Human situation", Axis: "Alignment axis", Story: "Story", Person: "Person", External: "Elsewhere in the tradition", Stem: "Word" };

// ── shared GPU resources ─────────────────────────────────────────────────────────────────────────────
const geos = new Map<string, THREE.BufferGeometry>();
function geo(kind: "lo" | "mid" | "hi" | "oct") {
  let g = geos.get(kind);
  if (!g) {
    g = kind === "oct" ? new THREE.OctahedronGeometry(1, 0) : new THREE.SphereGeometry(1, ...({ lo: [10, 8], mid: [20, 14], hi: [36, 26] }[kind] as [number, number]));
    geos.set(kind, g);
  }
  return g;
}
let glowTex: THREE.Texture | null = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.16, "rgba(255,255,255,0.6)");
  grd.addColorStop(0.42, "rgba(255,255,255,0.16)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
const ringTex = new Map<number, THREE.Texture>();
function ring(weight: number) {
  let t = ringTex.get(weight);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const lw = Math.max(2, 128 * weight);
  g.strokeStyle = "#fff";
  g.lineWidth = lw;
  g.beginPath();
  g.arc(128, 128, 128 - lw / 2 - 2, 0, Math.PI * 2);
  g.stroke();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  ringTex.set(weight, t);
  return t;
}

function radiusOf(n: NodeT, maxDeg: number) {
  const lift = Math.sqrt(Math.min(1, n.deg / Math.max(1, maxDeg)));
  switch (n.t) {
    case "Veda":
      return 13;
    case "Upanishad":
      return 9.5;
    case "Stem":
      return 2 + 1.4 * lift;
    case "Axis":
      return 4.4;
    case "Concept":
      return 2.8 + 3.2 * lift;
    case "Dilemma":
      return 3.4 + 2.2 * lift;
    case "Story":
      return 3.4 + 1.8 * lift;
    case "Person":
      return 2.4 + 1.6 * lift;
    case "External":
      return 2.8;
    default:
      return 1.3 + Math.min(1.7, n.deg * 0.3);
  }
}

interface LabelSpec {
  text: string;
  size: number;
  color: string;
  weight: string;
  font: "sans" | "deva";
  y: number;
}
interface Vis {
  group: THREE.Group;
  mesh: THREE.Mesh | null;
  halo: THREE.Sprite | null;
  haloOp: number;
  ringS: THREE.Sprite | null;
  labels: SpriteText[];
  specs: LabelSpec[];
  t: NodeType;
  color: string;
  r: number;
  op: number;
  always: boolean;
}
interface Emphasis {
  nodes: Set<string>;
  edges: Set<string>;
  kind: "answer" | "focus";
}

export default function Cosmos3D({ preview = false, offsetRight = 0, onPick }: { preview?: boolean; offsetRight?: number; onPick?: (id: string) => void }) {
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [layout, setLayout] = useState<Record<string, [number, number, number]> | null>(null);
  const { selected, colorBy, hidden, autoRotate, camera, flyTo, roots, path } = useExplore();
  const { highlight } = useAsk();
  const theme = useTheme();
  const dark = theme === "dark";
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const fonts = useRef({ sans: "Inter, system-ui, sans-serif", deva: "'Tiro Devanagari Sanskrit', 'Nirmala UI', serif" });

  useEffect(() => {
    loadGraph().then(setGraph);
    loadLayout().then(setLayout);
    loadKb().then(setKb);
    setReduceMotion(matchMedia("(prefers-reduced-motion: reduce)").matches);
    setCoarse(matchMedia("(pointer: coarse)").matches);
    const css = getComputedStyle(document.documentElement);
    const inter = css.getPropertyValue("--font-inter").trim();
    const tiro = css.getPropertyValue("--font-tiro").trim();
    if (inter) fonts.current.sans = `${inter}, system-ui, sans-serif`;
    if (tiro) fonts.current.deva = `${tiro}, 'Nirmala UI', serif`;
  }, []);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(200, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── nodes and links, at their precomputed places ──
  const nodeCache = useRef(new Map<string, N>());
  const base = useMemo(() => {
    if (!graph || !layout) return null;
    const deg = new Map<string, number>();
    for (const e of graph.edges) {
      if (STRUCT.has(e.type)) continue;
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1);
      deg.set(e.t, (deg.get(e.t) ?? 0) + 1);
    }
    let maxDeg = 1;
    for (const n of graph.nodes) if (n.type !== "Verse" && n.type !== "Upanishad" && n.type !== "Veda" && n.type !== "Stem") maxDeg = Math.max(maxDeg, deg.get(n.id) ?? 0);
    const nodes: N[] = [];
    for (const d of graph.nodes) {
      const p = layout[d.id];
      if (!p) continue;
      let n = nodeCache.current.get(d.id);
      if (!n) {
        n = { id: d.id, t: d.type, d, deg: deg.get(d.id) ?? 0 };
        nodeCache.current.set(d.id, n);
      }
      n.fx = n.x = p[0];
      n.fy = n.y = p[1];
      n.fz = n.z = p[2];
      nodes.push(n);
    }
    const links: LinkRec[] = graph.edges.map((e) => ({ key: ekey(e), type: e.type, s: e.s, t: e.t }));
    const drawn = links.filter((l) => !HIDDEN_LINKS.has(l.type));
    const adj = new Map<string, { to: string; key: string }[]>();
    for (const l of links) {
      (adj.get(l.s) ?? adj.set(l.s, []).get(l.s)!).push({ to: l.t, key: l.key });
      (adj.get(l.t) ?? adj.set(l.t, []).get(l.t)!).push({ to: l.s, key: l.key });
    }
    return { nodes, links: drawn, adj, maxDeg };
  }, [graph, layout]);

  const data = useMemo(() => {
    if (!base) return { nodes: [] as N[], links: [] as LinkRec[] };
    const shown = new Set(base.nodes.filter((n) => !hidden.includes(n.t)).map((n) => n.id));
    return { nodes: base.nodes.filter((n) => shown.has(n.id)), links: base.links.filter((l) => shown.has(l.s) && shown.has(l.t)) };
  }, [base, hidden]);

  // ── emphasis: an answer's subgraph > hover neighbourhood > selection neighbourhood ──
  const emphasis = useMemo((): Emphasis | null => {
    if (path?.nodes.length) return { nodes: new Set(path.nodes), edges: new Set(path.edges.map(ekey)), kind: "answer" };
    if (highlight?.nodes.length) return { nodes: new Set(highlight.nodes), edges: new Set(highlight.edges.map(ekey)), kind: "answer" };
    const f = hoverId ?? selected;
    if (f && base?.adj.has(f)) {
      const nodes = new Set([f]);
      const edges = new Set<string>();
      for (const a of base.adj.get(f)!) {
        nodes.add(a.to);
        edges.add(a.key);
      }
      return { nodes, edges, kind: "focus" };
    }
    if (roots && base) {
      const nodes = new Set<string>();
      const edges = new Set<string>();
      for (const l of base.links) {
        if (!ROOT_RELS.has(l.type)) continue;
        nodes.add(l.s);
        nodes.add(l.t);
        edges.add(l.key);
      }
      return { nodes, edges, kind: "focus" };
    }
    return null;
  }, [highlight, hoverId, selected, base, roots, path]);

  // ── materials ──
  const materials = useRef(new Map<string, THREE.Material>());
  const material = useCallback(
    (color: string, state: "base" | "dim" | "focus") => {
      const k = `${color}|${state}|${dark}`;
      let m = materials.current.get(k);
      if (!m) {
        const c = new THREE.Color(color);
        m = new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.42,
          metalness: 0.08,
          emissive: c.clone().multiplyScalar(dark ? (state === "focus" ? 0.75 : 0.42) : state === "focus" ? 0.18 : 0.04),
          transparent: state === "dim",
          opacity: state === "dim" ? (dark ? 0.14 : 0.18) : 1,
          depthWrite: state !== "dim",
        });
        materials.current.set(k, m);
      }
      return m;
    },
    [dark],
  );

  // ── node objects ──
  const visuals = useRef(new Map<string, Vis>());
  const live = useRef<{ emphasis: Emphasis | null; selected: string | null; hover: string | null; dirty: boolean; dark: boolean }>({ emphasis: null, selected: null, hover: null, dirty: true, dark: true });
  const texts = useMemo(() => new Map((kb?.texts ?? []).map((t) => [t.id, t])), [kb]);
  const nodeObject = useCallback(
    (n: N) => {
      const color = nodeColor({ type: n.t, up: n.d.up, id: n.id }, colorBy, dark);
      const r = radiusOf(n, base?.maxDeg ?? 1);
      const group = new THREE.Group();
      let mesh: THREE.Mesh | null = null;
      {
        mesh = new THREE.Mesh(geo(n.t === "Story" ? "oct" : n.t === "Verse" || n.t === "Stem" ? "lo" : n.t === "Upanishad" || n.t === "Veda" ? "hi" : "mid"), material(color, "base"));
        mesh.scale.setScalar(n.t === "Dilemma" ? r * 0.4 : r);
        if (n.t === "Story") mesh.rotation.set(0.3, 0.6, 0);
        group.add(mesh);
      }
      // a soft light around every point (additive in the dark; a faint wash in the light theme)
      const haloOp = n.t === "Upanishad" || n.t === "Veda" ? 0.62 : n.t === "Axis" ? 0.5 : n.t === "Verse" ? 0.16 : n.t === "Concept" ? 0.32 : 0.24;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: dark ? haloOp : haloOp * 0.3 }));
      const hs = n.t === "Upanishad" || n.t === "Veda" ? r * 7.5 : n.t === "Verse" ? r * 5.5 : r * 5.2;
      halo.scale.set(hs, hs, 1);
      group.add(halo);
      let ringS: THREE.Sprite | null = null;
      if (n.t === "Upanishad" || n.t === "Veda" || n.t === "Axis" || n.t === "Dilemma" || n.t === "External") {
        const w = n.t === "Dilemma" ? 0.2 : n.t === "Axis" ? 0.12 : 0.06;
        ringS = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring(w), color, transparent: true, depthWrite: false, opacity: n.t === "Dilemma" ? 0.95 : 0.6 }));
        const s = n.t === "Dilemma" ? r * 2.3 : n.t === "Upanishad" ? r * 3.4 : r * 3;
        ringS.scale.set(s, s, 1);
        group.add(ringS);
      }
      const specs: LabelSpec[] = [];
      if (n.t === "Upanishad") {
        const t = texts.get(n.d.up ?? "");
        specs.push({ text: n.d.label, size: preview ? 15 : 12.5, color: dark ? "#f3efe6" : "#1b1d1a", weight: "600", font: "sans", y: r + 12 });
        if (t) specs.push({ text: t.sa, size: preview ? 11 : 9, color, weight: "400", font: "deva", y: r + (preview ? 27 : 24) });
      } else if (n.t !== "Verse") {
        specs.push({ text: n.d.label, size: n.t === "Axis" ? 6.2 : n.t === "Dilemma" ? 4.8 : 5.2, color: n.t === "Axis" ? (dark ? "#bff0dc" : "#1f5c47") : dark ? "#dcdfd9" : "#2c302d", weight: n.t === "Axis" ? "600" : "500", font: "sans", y: r + (n.t === "Axis" ? 7 : 6) });
      } else {
        specs.push({ text: n.d.label, size: 4.4, color: dark ? "#eef0ea" : "#1b1d1a", weight: "600", font: "sans", y: r + 4.5 });
      }
      const always = n.t === "Upanishad" || n.t === "Veda" || n.t === "Axis";
      const v: Vis = { group, mesh, halo, haloOp, ringS, labels: [], specs, t: n.t, color, r, op: 0, always };
      visuals.current.set(n.id, v);
      live.current.dirty = true;
      return group;
    },
    [colorBy, dark, material, base, texts, preview],
  );

  const makeLabels = useCallback((v: Vis) => {
    for (const s of v.specs) {
      const l = new SpriteText(s.text, s.size, s.color);
      l.fontFace = s.font === "deva" ? fonts.current.deva : fonts.current.sans;
      l.fontWeight = s.weight;
      l.strokeWidth = s.font === "deva" ? 0.5 : 0.8;
      l.strokeColor = live.current.dark ? "rgba(6,8,7,0.9)" : "rgba(246,245,241,0.92)";
      l.material.depthWrite = false;
      l.material.opacity = 0;
      l.position.y = s.y;
      l.renderOrder = 5;
      v.group.add(l);
      v.labels.push(l);
    }
  }, []);

  live.current = { ...live.current, emphasis, selected, hover: hoverId, dark };
  useEffect(() => {
    live.current.dirty = true;
  }, [emphasis, selected, hoverId, dark, nodeObject]);

  const selMark = useRef<THREE.Sprite | null>(null);
  const reconcile = useCallback(() => {
    const { emphasis: e, selected: sel, hover: hov, dark: dk } = live.current;
    for (const [id, v] of visuals.current) {
      const on = !e || e.nodes.has(id);
      const focus = !!e && on && (id === sel || id === hov || e.kind === "answer");
      if (v.mesh) v.mesh.material = material(v.color, on ? (focus ? "focus" : "base") : "dim");
      if (v.halo) (v.halo.material as THREE.SpriteMaterial).opacity = (dk ? v.haloOp : v.haloOp * 0.3) * (on ? (focus ? 1.5 : 1) : 0.12);
      if (v.ringS) (v.ringS.material as THREE.SpriteMaterial).opacity = on ? (v.t === "Dilemma" ? 0.95 : 0.6) : 0.07;
    }
    const target = sel ? visuals.current.get(sel) : undefined;
    let m = selMark.current;
    if (!m) {
      m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring(0.12), transparent: true, depthWrite: false, depthTest: false }));
      m.renderOrder = 10;
      selMark.current = m;
    }
    if (m.parent !== target?.group) m.parent?.remove(m);
    if (target) {
      (m.material as THREE.SpriteMaterial).color.set(dk ? "#f0c674" : "#9a6514");
      const s = Math.max(14, target.r * 4.2);
      m.scale.set(s, s, 1);
      if (m.parent !== target.group) target.group.add(m);
    }
  }, [material]);

  // ── scene: lights, fog, stars and the mandala guides ──
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !base) return;
    const bg = new THREE.Color(dark ? "#070908" : "#f3f2ee");
    const scene = fg.scene();
    scene.fog = new THREE.Fog(bg, 700, 2400);
    const key = new THREE.DirectionalLight(0xfff4e2, dark ? 1.9 : 2.0);
    key.position.set(320, 720, 460);
    const rim = new THREE.DirectionalLight(dark ? 0x8fb8ff : 0xffffff, dark ? 0.6 : 0.4);
    rim.position.set(-520, -160, -620);
    fg.lights([new THREE.HemisphereLight(dark ? 0xf2ece2 : 0xffffff, dark ? 0x1a201d : 0xd9d4cc, dark ? 1.25 : 2.2), key, rim]);

    const group = new THREE.Group();
    group.name = "cosmos-guides";
    const gold = dark ? 0xe6b96a : 0x9a6514;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 288; i++) {
      const th = (i / 288) * Math.PI * 2 - Math.PI / 2;
      pts.push(new THREE.Vector3(RING_R * Math.cos(th), 30 * Math.sin(th * 3), RING_R * Math.sin(th)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: dark ? 0.2 : 0.24, depthWrite: false })));
    for (const [r, y] of CORE_RINGS) {
      const p: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const th = (i / 160) * Math.PI * 2;
        p.push(new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th)));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineDashedMaterial({ color: dark ? 0x9fe0c6 : 0x2a6a54, dashSize: 4, gapSize: 6, transparent: true, opacity: dark ? 0.1 : 0.14, depthWrite: false }));
      line.computeLineDistances();
      group.add(line);
    }
    if (dark) {
      // a field of distant stars, seeded so every load (and every video frame) is identical
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const N = 2200;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = rnd() * 2 - 1;
        const th = rnd() * Math.PI * 2;
        const rr = 1500 + rnd() * 1600;
        const s = Math.sqrt(1 - u * u);
        pos.set([rr * s * Math.cos(th), rr * u, rr * s * Math.sin(th)], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8e2dc, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      stars.raycast = () => {};
      group.add(stars);
    }
    for (const o of group.children) o.raycast = () => {};
    scene.add(group);
    const r = fg.renderer();
    r.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NoToneMapping;
    wake(1200);
    return () => {
      scene.remove(group);
      for (const o of group.children as (THREE.Line | THREE.Points)[]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, base, coarse]);

  // ── links, batched by visual class (868 links → a handful of draw calls), tinted by the nodes they join ──
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !data.links.length) return;
    const pos = (id: string) => nodeCache.current.get(id);
    const classes = new Map<string, { p: number[]; c: number[] }>();
    const col = new THREE.Color();
    const colOf = (id: string) => col.set(visuals.current.get(id)?.color ?? nodeColor({ type: pos(id)!.t, up: pos(id)!.d.up, id }, colorBy, dark));
    for (const l of data.links) {
      const s = pos(l.s);
      const t = pos(l.t);
      if (!s || !t) continue;
      const c = emphasis ? (emphasis.edges.has(l.key) ? (emphasis.kind === "answer" ? "hi" : "focus") : "dim") : STRUCT.has(l.type) ? "struct" : "meaning";
      const b = classes.get(c) ?? classes.set(c, { p: [], c: [] }).get(c)!;
      b.p.push(s.fx!, s.fy!, s.fz!, t.fx!, t.fy!, t.fz!);
      if (c === "hi") b.c.push(...(dark ? [0.96, 0.8, 0.5, 0.96, 0.8, 0.5] : [0.6, 0.4, 0.08, 0.6, 0.4, 0.08]));
      else {
        const a = colOf(l.s).toArray();
        const z = colOf(l.t).toArray();
        b.c.push(...a, ...z);
      }
    }
    const opacity: Record<string, number> = dark ? { struct: 0.14, meaning: 0.15, focus: 0.7, hi: 0.95, dim: 0.03 } : { struct: 0.16, meaning: 0.24, focus: 0.75, hi: 0.95, dim: 0.05 };
    const group = new THREE.Group();
    group.name = "cosmos-links";
    for (const [c, b] of classes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
      const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: opacity[c], depthWrite: false, blending: dark && c !== "dim" ? THREE.AdditiveBlending : THREE.NormalBlending }));
      line.frustumCulled = false;
      line.raycast = () => {};
      line.renderOrder = c === "hi" || c === "focus" ? 2 : 0;
      group.add(line);
    }
    const scene = fg.scene();
    scene.add(group);
    wake(800);
    return () => {
      scene.remove(group);
      for (const o of group.children as THREE.LineSegments[]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, emphasis, colorBy, dark, nodeObject]);

  // The force-graph itself draws only an answer's links (with light flowing along them); everything else is batched.
  const fgData = useMemo(() => {
    const links =
      emphasis?.kind === "answer" && !reduceMotion
        ? data.links.filter((l) => emphasis.edges.has(l.key) && !STRUCT.has(l.type)).map((l) => ({ key: l.key, type: l.type, source: nodeCache.current.get(l.s)!, target: nodeCache.current.get(l.t)! }))
        : [];
    return { nodes: data.nodes, links: links as L[] };
  }, [data, emphasis, reduceMotion]);

  // ── frame loop: reconcile visual state, fade labels by proximity, keep fog in step with the camera, sleep when idle ──
  const awakeUntil = useRef(0);
  const sleeping = useRef(false);
  const startLoop = useRef<(() => void) | null>(null);
  const wake = useCallback((ms = 1200) => {
    awakeUntil.current = Math.max(awakeUntil.current, performance.now() + ms);
    if (sleeping.current && !document.hidden) {
      sleeping.current = false;
      fgRef.current?.resumeAnimation();
      startLoop.current?.();
    }
  }, []);
  useEffect(() => {
    let raf = 0;
    let running = false;
    const p = new THREE.Vector3();
    const tick = () => {
      const fg = fgRef.current;
      if (!fg) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (live.current.dirty) {
        live.current.dirty = false;
        reconcile();
      }
      const cam = fg.camera();
      const target = (fg.controls() as { target?: THREE.Vector3 }).target;
      const dist = target ? cam.position.distanceTo(target) : 1000;
      const fog = fg.scene().fog as THREE.Fog | null;
      if (fog) {
        fog.near = dist * 0.75;
        fog.far = dist + 1500;
      }
      const { emphasis: e, selected: sel, hover: hov } = live.current;
      const small = !!e && e.nodes.size <= 70;
      let fading = false;
      for (const [id, v] of visuals.current) {
        const on = !e || e.nodes.has(id);
        let want: number;
        if (id === sel || id === hov) want = 1;
        else if (!on) want = v.always ? 0.22 : 0;
        else if (v.always) want = 0.95;
        else if (e && small) want = v.t === "Verse" && e.nodes.size > 40 ? 0 : 0.92;
        else if (v.t === "Verse") want = 0;
        else {
          v.group.getWorldPosition(p);
          want = 0.9 * (1 - smooth(300, 620, p.distanceTo(cam.position)));
        }
        if (v.op === want) continue;
        if (!v.labels.length) {
          if (want <= 0.02) continue;
          makeLabels(v);
        }
        fading = true;
        v.op += (want - v.op) * 0.18;
        if (Math.abs(v.op - want) < 0.004) v.op = want;
        for (const l of v.labels) {
          l.material.opacity = v.op;
          l.visible = v.op > 0.02;
        }
      }
      const rotating = !!(fg.controls() as { autoRotate?: boolean }).autoRotate;
      const flowing = live.current.emphasis?.kind === "answer";
      if (!rotating && !fading && !flowing && performance.now() > awakeUntil.current) {
        running = false;
        sleeping.current = true;
        fg.pauseAnimation();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    startLoop.current = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    startLoop.current();
    return () => {
      cancelAnimationFrame(raf);
      running = false;
      startLoop.current = null;
    };
  }, [reconcile, makeLabels]);
  useEffect(() => {
    wake(1500);
  }, [fgData, emphasis, selected, hoverId, dark, colorBy, size, autoRotate, wake]);

  // ── camera ──
  const home = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return { x: 0, y: 600, z: 1000 };
    const cam = fg.camera() as THREE.PerspectiveCamera;
    const el = wrapRef.current;
    const w = (el?.clientWidth || size.w) - offsetRight;
    const h = el?.clientHeight || size.h;
    const aspect = w / h;
    const vt = Math.tan((cam.fov * Math.PI) / 360);
    const extent = preview ? 560 : 610;
    const d = Math.max((extent * 0.7) / vt, extent / (vt * aspect)) * (preview ? 1.08 : 1.24);
    const dir = new THREE.Vector3(0, aspect < 0.9 ? 0.95 : 0.6, 1).normalize();
    return { x: dir.x * d, y: dir.y * d, z: dir.z * d };
  }, [size, offsetRight, preview]);
  const homed = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !base) return;
    const controls = fg.controls() as { enableDamping?: boolean; dampingFactor?: number; minDistance?: number; maxDistance?: number; rotateSpeed?: number; enableZoom?: boolean; addEventListener?: (e: string, fn: () => void) => void };
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 2600;
    controls.rotateSpeed = 0.7;
    if (preview) controls.enableZoom = false;
    controls.addEventListener?.("start", () => explore.get().autoRotate && explore.setAutoRotate(false));
    controls.addEventListener?.("change", () => wake(700));
    if (!homed.current) {
      homed.current = true;
      fg.cameraPosition(home(), { x: 0, y: 0, z: 0 }, 0);
    }
    wake(1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);
  useEffect(() => {
    const c = fgRef.current?.controls() as { autoRotate?: boolean; autoRotateSpeed?: number } | undefined;
    if (!c) return;
    c.autoRotate = autoRotate && !reduceMotion;
    c.autoRotateSpeed = preview ? 0.5 : 0.35;
  }, [autoRotate, reduceMotion, preview, base]);
  // A docked panel covers the right of the canvas: shift the projection so the centre of attention stays visible.
  useEffect(() => {
    const cam = fgRef.current?.camera() as THREE.PerspectiveCamera | undefined;
    if (!cam?.setViewOffset) return;
    // Also lift the scene a little: the ask bar sits along the bottom edge.
    const lift = preview ? 0 : Math.min(48, size.h * 0.05);
    if (offsetRight > 0 || lift) cam.setViewOffset(size.w, size.h, offsetRight / 2, lift, size.w, size.h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    wake(600);
  }, [offsetRight, size, wake, preview]);

  const flyToNode = useCallback(
    (id: string) => {
      const fg = fgRef.current;
      const n = nodeCache.current.get(id);
      if (!fg || !n) return;
      wake(reduceMotion ? 400 : 1700);
      const x = n.fx ?? 0;
      const y = n.fy ?? 0;
      const z = n.fz ?? 0;
      const dist = n.t === "Verse" ? 210 : n.t === "Upanishad" ? 330 : 260;
      const len = Math.hypot(x, z);
      const pos = len < 40 ? { x: x, y: y + dist * 0.7, z: z + dist } : { x: x * (1 + dist / len), y: y + dist * 0.55, z: z * (1 + dist / len) };
      fg.cameraPosition(pos, { x, y, z }, reduceMotion ? 0 : 1200);
    },
    [reduceMotion, wake],
  );
  const lastFly = useRef(0);
  useEffect(() => {
    if (!flyTo || !base || flyTo.n === lastFly.current) return;
    lastFly.current = flyTo.n;
    const t = setTimeout(() => flyToNode(flyTo.id), 60);
    return () => clearTimeout(t);
  }, [flyTo, base, flyToNode]);

  // Frame a set of nodes in the part of the canvas that is actually visible (left of the dock, above the ask bar).
  // The force-graph's own zoomToFit always looks at the origin, which frames a subgraph off to one side.
  const fitNodes = useCallback(
    (ids: Iterable<string>, ms: number) => {
      const fg = fgRef.current;
      if (!fg) return;
      const pts = [...ids].map((id) => nodeCache.current.get(id)).filter((n): n is N => !!n);
      if (!pts.length) return;
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const n of pts) {
        min.min(new THREE.Vector3(n.fx, n.fy, n.fz));
        max.max(new THREE.Vector3(n.fx, n.fy, n.fz));
      }
      const c = min.clone().add(max).multiplyScalar(0.5);
      let r = 40;
      for (const n of pts) r = Math.max(r, Math.hypot((n.fx ?? 0) - c.x, (n.fy ?? 0) - c.y, (n.fz ?? 0) - c.z));
      r += preview ? 30 : 46;
      const cam = fg.camera() as THREE.PerspectiveCamera;
      const visW = Math.max(200, size.w - offsetRight - (preview ? 0 : 90));
      const visH = Math.max(200, size.h - (preview ? 0 : 150));
      const tan = Math.tan((cam.fov * Math.PI) / 360);
      const d = Math.max(r / (tan * (visH / size.h)), r / (tan * (size.w / size.h) * (visW / size.w)));
      const target = (fg.controls() as { target?: THREE.Vector3 }).target ?? new THREE.Vector3();
      const dir = cam.position.clone().sub(target);
      if (dir.lengthSq() < 1) dir.set(0, 0.55, 1);
      dir.normalize();
      if (dir.y < 0.25) dir.setY(0.25).normalize(); // keep looking down onto the ring
      const pos = c.clone().add(dir.multiplyScalar(d));
      fg.cameraPosition({ x: pos.x, y: pos.y, z: pos.z }, { x: c.x, y: c.y, z: c.z }, ms);
    },
    [size, offsetRight, preview],
  );

  // An answer lights its subgraph and the camera frames it.
  useEffect(() => {
    if (!fgRef.current || !highlight?.nodes.length || !base) return;
    explore.setAutoRotate(false);
    wake(2200);
    const t = setTimeout(() => fitNodes(highlight.nodes, reduceMotion ? 0 : 1300), 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, base, reduceMotion, wake]);

  const lastCmd = useRef(0);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !camera || camera.n === lastCmd.current) return;
    lastCmd.current = camera.n;
    const ms = reduceMotion ? 0 : 650;
    wake(ms + 600);
    const controls = fg.controls() as { target?: THREE.Vector3 };
    const target = controls.target ?? new THREE.Vector3();
    const cam = fg.camera().position;
    if (camera.kind === "fit") fitNodes(nodeCache.current.keys(), ms);
    else if (camera.kind === "home") fg.cameraPosition(home(), { x: 0, y: 0, z: 0 }, ms);
    else {
      const f = camera.kind === "zoomIn" ? 0.68 : 1.45;
      const next = target.clone().add(cam.clone().sub(target).multiplyScalar(f));
      fg.cameraPosition({ x: next.x, y: next.y, z: next.z }, { x: target.x, y: target.y, z: target.z }, ms * 0.6);
    }
  }, [camera, home, reduceMotion, wake, fitNodes]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        fgRef.current?.pauseAnimation();
        sleeping.current = true;
      } else wake(1200);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wake]);

  // ── tooltips, hover, click ──
  const verseText = useMemo(() => new Map((kb?.verses ?? []).map((v) => [v.id, v])), [kb]);
  const tooltip = useCallback(
    (n: N) => {
      if (coarse) return "";
      const d = n.d;
      const color = visuals.current.get(n.id)?.color ?? "#999";
      const kind = `<div class="t"><i style="background:${color}"></i>${esc(KIND[n.t])}</div>`;
      if (n.t === "Verse") {
        const v = verseText.get(n.id);
        const t = texts.get(d.up ?? "");
        const sa = v?.sa ? v.sa.split(/\s+/).slice(0, 9).join(" ") : "";
        return `<div class="cos-tip">${kind}<div class="h">${esc(d.label)} <span class="m">${esc(t ? `${t.iast} Upaniṣad` : "")}</span></div>${sa ? `<div class="deva">${esc(sa)}…</div>` : ""}<div class="s">${esc((v?.tr || d.sub || "").slice(0, 170))}${(v?.tr || d.sub || "").length > 170 ? "…" : ""}</div></div>`;
      }
      if (n.t === "Upanishad") {
        const t = texts.get(d.up ?? "");
        return `<div class="cos-tip">${kind}<div class="h">${esc(d.label)} <span class="deva-inline">${esc(t?.sa ?? "")}</span></div><div class="s">${esc(t?.tagline ?? d.sub ?? "")}</div><div class="m">${t ? `${t.count} mantras · ${t.scope === "complete" ? "complete" : "selected passages"} · ${esc(t.veda)}` : ""}</div></div>`;
      }
      return `<div class="cos-tip">${kind}<div class="h">${esc(d.label)}</div>${d.sub ? `<div class="s">${esc(d.sub.slice(0, 200))}</div>` : ""}</div>`;
    },
    [coarse, verseText, texts],
  );
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHover = useCallback(
    (n: N | null) => {
      if (coarse) return;
      if (wrapRef.current) wrapRef.current.style.cursor = n ? "pointer" : "";
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      const id = n ? String(n.id) : null;
      hoverTimer.current = setTimeout(() => setHoverId(id), id ? 60 : 140);
    },
    [coarse],
  );
  const onClick = useCallback(
    (n: N) => {
      setHoverId(null);
      if (onPick) onPick(String(n.id));
      else explore.select(String(n.id));
    },
    [onPick],
  );
  const onBackground = useCallback(() => {
    if (!onPick && explore.get().selected) explore.select(null);
  }, [onPick]);

  const [rendererConfig] = useState(() => ({ antialias: true, powerPreference: "default" as const, alpha: false }));
  // Ready for capture once the scene has been built and drawn a few frames.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!base) return;
    const t = setTimeout(() => setDrawn(visuals.current.size > 0), 900);
    return () => clearTimeout(t);
  }, [base, fgData]);
  useReady(drawn);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __cosmos: fgRef.current });
  });

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      role="img"
      aria-label="3D knowledge graph of the Upanishads. Use search or the legend to find nodes."
      onPointerDown={() => wake(1500)}
      onPointerMove={() => wake(900)}
      onWheel={() => wake(1200)}
    >
      {base && (
        <ForceGraph3D<NodeT, LinkT>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={fgData}
          controlType="orbit"
          backgroundColor={dark ? "#070908" : "#f3f2ee"}
          showNavInfo={false}
          nodeThreeObject={nodeObject}
          nodeLabel={tooltip}
          linkColor={() => (dark ? "rgba(240,200,130,0.9)" : "rgba(154,101,20,0.9)")}
          linkWidth={0.7}
          linkOpacity={0.9}
          linkResolution={4}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => (dark ? "#ffe2a8" : "#9a6514")}
          onNodeClick={onClick}
          onNodeHover={onHover}
          onBackgroundClick={onBackground}
          enableNodeDrag={false}
          warmupTicks={0}
          cooldownTicks={0}
          rendererConfig={rendererConfig}
        />
      )}
    </div>
  );
}
