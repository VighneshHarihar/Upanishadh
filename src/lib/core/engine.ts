// Stage B: deterministic diagnosis. Routes the request onto human dilemmas and AI-pressure patterns, searches the
// corpus, walks two hops through the graph, and freezes an evidence packet: the only material the re-aligned model
// may cite. No model is involved; it runs in ~10–30 ms in the browser.
import { buildSearch, searchIndex, type SearchIndex } from "./search.ts";
import { expandGraph, indexGraph, induced, NAVIGATION_ONLY, REL_LABEL, REL_WEIGHT, type CompactGraph, type GraphIndex } from "./graph.ts";
import { fold } from "./text.ts";
import type { GEdge, GraphData, KnowledgeBase, Rubric, VerseLite } from "./types.ts";

export interface Ranked {
  id: string;
  score: number;
  why: string;
}
export type EvidenceStatus = "SUPPORTED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE";
export interface Diagnosis {
  status: EvidenceStatus;
  crisis: boolean;
  dilemmas: { id: string; score: number; cues: string[] }[];
  pressures: { id: string; label: string; cue: string }[];
  verses: Ranked[];
  concepts: Ranked[];
  stories: Ranked[];
  preyas: string | null;
  shreyas: string | null;
  subgraph: { nodes: string[]; edges: GEdge[] };
  packet: string;
  allowed: string[];
  ms: number;
}
export interface Engine {
  kb: KnowledgeBase;
  graph: GraphData;
  gi: GraphIndex;
  rubric: Rubric;
  search: SearchIndex;
  verse: Map<string, VerseLite>;
}

export function createEngine(kb: KnowledgeBase, graph: GraphData | CompactGraph, rubric: Rubric): Engine {
  const docs = [
    ...kb.verses.map((v) => ({ id: v.id, text: `${v.tr} ${v.iast}` })),
    ...kb.concepts.map((c) => ({ id: `concept:${c.id}`, text: `${c.iast} ${c.en} ${c.desc}`, boost: 0.8 })),
    ...kb.stories.map((s) => ({ id: `story:${s.id}`, text: `${s.title} ${s.summary}`, boost: 0.7 })),
  ];
  const full = expandGraph(graph) as GraphData;
  return { kb, graph: full, gi: indexGraph(full), rubric, search: buildSearch(docs), verse: new Map(kb.verses.map((v) => [v.id, v])) };
}

// Crisis language: the harness steps aside and shows human help first, with or without a key.
const CRISIS = [/\bkill(ing)? my ?self\b/i, /\bsuicid/i, /\bend(ing)? (it all|my life)\b/i, /\bwant to die\b/i, /\bself[- ]?harm/i, /\bno reason to live\b/i, /\bbetter off dead\b/i, /आत्महत्या/, /मरना चाहत/];
export const detectCrisis = (s: string) => CRISIS.some((re) => re.test(s));

const cueRe = (cue: string) => new RegExp(`(^|[^a-z])${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "'?")}($|[^a-z])`, "i");

export function diagnose(E: Engine, query: string, opts: { maxVerses?: number; extraSeeds?: string[]; themes?: { id: string; why: string; weight?: number }[] } = {}): Diagnosis {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { kb, gi } = E;
  const q = query.replace(/[’‘]/g, "'");
  const seeds = new Map<string, { score: number; why: string }>();
  const seed = (id: string, score: number, why: string) => {
    if (!gi.nodes.has(id)) return;
    const s = seeds.get(id);
    if (s) s.score += score * 0.6;
    else seeds.set(id, { score, why });
  };

  // 1 · dilemma cues and request pressures
  const dilemmas = kb.dilemmas
    .map((d) => ({ id: d.id, cues: d.cues.filter((c) => cueRe(c).test(q)) }))
    .filter((d) => d.cues.length)
    .map((d) => ({ ...d, score: 2.5 + 0.6 * (d.cues.length - 1) }));
  const pressures = E.rubric.pressures.flatMap((p) => {
    const hit = p.cues.map((c) => q.match(new RegExp(c, "i"))?.[0]).find(Boolean);
    return hit ? [{ id: p.id, label: p.label, cue: hit }] : [];
  });
  for (const p of pressures) for (const d of kb.dilemmas) if (d.pressures.includes(p.id)) {
    const cur = dilemmas.find((x) => x.id === d.id);
    if (cur) cur.score += 0.4;
    else dilemmas.push({ id: d.id, cues: [], score: 0.9 });
  }
  dilemmas.sort((a, b) => b.score - a.score);
  for (const d of dilemmas) seed(`dilemma:${d.id}`, d.score, d.cues.length ? `the request says “${d.cues[0]}”` : "the shape of the request");

  // 2 · explicit references ("Katha 1.2.2", "KaU 1.2.2") and concept names
  for (const t of kb.texts) for (const alias of t.aliases) {
    const re = new RegExp(`${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:upanishad\\s*)?(\\d+(?:\\.\\d+){0,2})`, "gi");
    for (const m of q.matchAll(re)) seed(`${t.abbrev}_${m[1]}`, 3, "referenced directly");
  }
  const fq = ` ${fold(q)} `;
  for (const c of kb.concepts) if (fq.includes(` ${fold(c.iast)} `) || fq.includes(` ${fold(c.id.replace(/-/g, " "))} `)) seed(`concept:${c.id}`, 1.4, `the request names ${c.iast}`);

  // 3 · lexical search over translations, IAST, concepts and stories
  searchIndex(E.search, q, 12).forEach((h, rank) => seed(h.id, (h.id.includes(":") ? 0.8 : 1) / (1 + rank * 0.35), "shares wording with the request"));
  // 3b · follow-ups carry the previous answer's sources forward (bounded, visible to the caller)
  for (const id of opts.extraSeeds ?? []) seed(id, 1.2, "carried over from the previous answer");
  // 3c · everyday language mapped to the ideas that answer it ("a job that pays double" → śreyas and preyas)
  for (const t of opts.themes ?? []) seed(t.id, 2.2 * (t.weight ?? 1), t.why);
  const themed = (opts.themes ?? []).some((t) => gi.nodes.has(t.id));

  // 4 · two-hop walk from every seed, scoring by the strongest relation that reached a node
  const scores = new Map<string, { score: number; why: string }>();
  const credit = (id: string, s: number, why: string) => {
    const r = scores.get(id);
    if (r) r.score += s;
    else scores.set(id, { score: s, why });
  };
  for (const [id, s] of seeds) {
    credit(id, s.score, s.why);
    const ring1 = gi.adj.get(id) || [];
    for (const a of ring1) {
      if (a.e.type === "PART_OF" || a.e.type === "HAS_STEM" || a.e.type === "DISTILLS") continue;
      const w = REL_WEIGHT[a.e.type];
      credit(a.to, s.score * w * 0.6, a.e.why || relWhy(E, a.e, a.to));
      if (gi.nodes.get(a.to)?.type === "Upanishad") continue;
      for (const b of gi.adj.get(a.to) || []) {
        if (b.to === id || NAVIGATION_ONLY.has(b.e.type)) continue;
        credit(b.to, (s.score * w * REL_WEIGHT[b.e.type] * 0.2) / (1 + Math.log10(1 + (gi.adj.get(b.to)?.length || 1))), b.e.why || relWhy(E, b.e, b.to));
      }
    }
  }
  const ranked = (type: string, n: number, min = 0.15) =>
    [...scores.entries()]
      .filter(([id, r]) => gi.nodes.get(id)?.type === type && r.score >= min)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, n)
      .map(([id, r]) => ({ id, score: Number(r.score.toFixed(3)), why: r.why }));

  // The top dilemma's own verses are always in the packet: they are the curated answer to this kind of request.
  const top = dilemmas[0] ? kb.dilemmas.find((d) => d.id === dilemmas[0].id) : undefined;
  let verses = ranked("Verse", opts.maxVerses ?? 6);
  if (top) for (const x of [...top.verses].reverse()) if (!verses.some((v) => v.id === x.verse)) verses = [{ id: x.verse, score: 9, why: x.why }, ...verses];
  verses = verses.slice(0, Math.max(opts.maxVerses ?? 6, top ? top.verses.length : 0));
  const concepts = ranked("Concept", 4);
  const stories = ranked("Story", 1, 0.4);

  const strongest = dilemmas[0]?.score ?? 0;
  // A single lexical overlap is not evidence: PARTIAL needs a request pattern or a verse reached through the graph.
  const status: EvidenceStatus = strongest >= 2.5 && verses.length >= 2 ? "SUPPORTED" : strongest > 0 || (themed && verses.length > 0) || verses.some((v) => v.score >= 1.5) ? "PARTIAL" : "INSUFFICIENT_EVIDENCE";
  const used = status === "INSUFFICIENT_EVIDENCE" ? [] : verses;
  const subNodes = new Set<string>([...(top ? [`dilemma:${top.id}`] : []), ...concepts.map((c) => c.id), ...used.map((v) => v.id), ...stories.map((s) => s.id)]);
  const diag: Diagnosis = {
    status,
    crisis: detectCrisis(q),
    dilemmas: dilemmas.slice(0, 2).map((d) => ({ id: d.id, score: Number(d.score.toFixed(2)), cues: d.cues })),
    pressures,
    verses: used,
    concepts: status === "INSUFFICIENT_EVIDENCE" ? [] : concepts,
    stories: status === "INSUFFICIENT_EVIDENCE" ? [] : stories,
    preyas: top?.preyas ?? null,
    shreyas: top?.shreyas ?? null,
    subgraph: { nodes: [...subNodes], edges: induced(gi, subNodes) },
    packet: "",
    allowed: [],
    ms: 0,
  };
  diag.packet = packet(E, diag);
  diag.allowed = [...diag.verses.map((v) => v.id), ...diag.concepts.map((c) => c.id), ...diag.stories.map((s) => s.id)];
  diag.ms = Number(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0).toFixed(1));
  return diag;
}

/** Why a node was reached, in words: "follows KaU 1.2.1", "teaches Śreyas", "in story Naciketas and Death". */
function relWhy(E: Engine, e: GEdge, to: string): string {
  const other = E.gi.nodes.get(e.s === to ? e.t : e.s);
  const verb = e.type === "IN_STORY" ? (e.s === to ? "in story" : "includes") : e.s === to ? REL_LABEL[e.type].out : REL_LABEL[e.type].in;
  return `${verb} ${other?.label ?? ""}`.trim();
}

export function citeLabel(E: Engine, id: string): string {
  if (id.startsWith("concept:")) return `[Concept: ${E.gi.nodes.get(id)?.label}]`;
  if (id.startsWith("story:")) return `[Story: ${E.gi.nodes.get(id)?.label}]`;
  const v = E.verse.get(id);
  return v ? `[${id.replace("_", " ")}]` : `[${id}]`;
}

function packet(E: Engine, d: Diagnosis): string {
  const out: string[] = [`EVIDENCE PACKET (status: ${d.status})`];
  const top = d.dilemmas[0] && E.kb.dilemmas.find((x) => x.id === d.dilemmas[0].id);
  if (top) {
    out.push(`Reading of the request (tentative): ${top.en}. ${top.desc}`);
    out.push(`The pleasant answer (preyas) would give: ${top.preyas}`);
    out.push(`What would actually serve (śreyas): ${top.shreyas}`);
  }
  if (d.pressures.length) out.push(`Pressures in the request: ${d.pressures.map((p) => `${p.label} (“${p.cue}”)`).join("; ")}.`);
  if (d.status === "INSUFFICIENT_EVIDENCE") {
    out.push("No verse in this corpus speaks directly to this request. Do not cite any verse.");
    return out.join("\n");
  }
  out.push("\nVERSES");
  for (const r of d.verses) {
    const v = E.verse.get(r.id);
    if (!v) continue;
    const t = E.kb.texts.find((x) => x.id === v.up);
    out.push(`${citeLabel(E, v.id)} ${t?.iast} Upaniṣad ${v.ref}`);
    out.push(`  Sanskrit: ${v.sa}`);
    out.push(`  IAST: ${v.iast}`);
    out.push(`  Translation (${v.trBy}): ${v.tr.replace(/\s+/g, " ").slice(0, 650)}`);
    out.push(`  Why it is here: ${r.why}`);
  }
  if (d.concepts.length) {
    out.push("\nCONCEPTS");
    for (const r of d.concepts) {
      const c = E.kb.concepts.find((x) => `concept:${x.id}` === r.id);
      if (c) out.push(`${citeLabel(E, r.id)} ${c.iast} (${c.sa}): ${c.en}. ${c.desc}`);
    }
  }
  if (d.stories.length) {
    out.push("\nSTORIES");
    for (const r of d.stories) {
      const s = E.kb.stories.find((x) => `story:${x.id}` === r.id);
      if (s) out.push(`${citeLabel(E, r.id)} ${s.summary}`);
    }
  }
  return out.join("\n");
}
