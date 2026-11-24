// The whole data build as one pure-ish function: read data/, assemble the graph, run the integrity gate, lay out
// the cosmos, and return every public/data artifact as a string. `npm run data` writes them only when there are zero
// errors; `npm run data:verify` compiles again and checks the committed files are identical.
//
// Artifacts (lazy where it matters, so the first page load stays small):
//   index.json            texts, ideas, people, stories, Vedas, glossary, and [id, text, ref] for every passage
//   verses/<id>.json      the passages of one Upanishad in compact form (retrieval, quote checks, tooltips)
//   corpus/<id>.json      the full passages of one Upanishad (words, second reading, audio, takeaways)
//   bhashya/<id>.json     Śaṅkara's commentary for one Upanishad
//   graph.json            nodes and curated links (structural links are rebuilt on load: see expandGraph)
//   layout.json           precomputed positions for the cosmos and the map
//   lemmas.json           every analysed word's lemma → gloss and passages (loaded when a word is clicked)
import { withWordOverlay } from "./word-overlay.mjs";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { normDeva, foldIast, dice, hash } from "../../src/lib/core/text.ts";
import { forceSimulation, forceLink, forceManyBody, forceRadial } from "d3-force-3d";
import { ALPHA_DECAY, CHARGE, CORE_RINGS, LAYOUT_TICKS, RING_R, VEDA_ORDER, VELOCITY_DECAY, containForce, hubPosition, linkDistance, linkStrength, radialStrength, radialTarget, slotAngle, vedaPosition } from "../../src/lib/core/layout.ts";

const exists = (p) => access(p).then(() => true, () => false);
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const STRUCT = new Set(["PART_OF", "NEXT", "HAS_STEM", "DISTILLS"]);

export async function compile(ROOT) {
  const DATA = join(ROOT, "data");
  const C = join(DATA, "curated");
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);

  // ── curated inputs ─────────────────────────────────────────────────────────────────────────────
  const { concepts, categories } = await readJson(join(C, "concepts.json"));
  const { dilemmas } = await readJson(join(C, "dilemmas.json"));
  const { stories, persons } = await readJson(join(C, "stories.json"));
  const { paths } = await readJson(join(C, "paths.json"));
  const { crossrefs } = await readJson(join(C, "crossrefs.json"));
  const { anchors } = await readJson(join(C, "anchors.json"));
  const { corpora: extCorpora } = await readJson(join(C, "external.json"));
  const extText = (await exists(join(C, "external-text.json"))) ? await readJson(join(C, "external-text.json")) : {};
  const rubric = await readJson(join(C, "rubric.json"));
  const roots = await readJson(join(C, "vedic-roots.json"));
  const darshanas = await readJson(join(C, "darshanas.json"));
  const { stems } = await readJson(join(C, "stems.json"));
  const { terms: glossary } = await readJson(join(C, "glossary.json"));
  const { verses: takeaways } = await readJson(join(C, "takeaways.json"));
  const shruti = await readJson(join(C, "shruti-phrases.json"));
  const { passages: mandatory } = await readJson(join(C, "mandatory.json"));

  // ── corpora (auto-discovered plugins) ─────────────────────────────────────────────────────────────
  const texts = [];
  const verses = [];
  const bhashya = {};
  const metas = {};
  for (const d of (await readdir(join(DATA, "corpus"), { withFileTypes: true })).filter((x) => x.isDirectory())) {
    const dir = join(DATA, "corpus", d.name);
    if (!(await exists(join(dir, "meta.json")))) continue;
    const meta = await readJson(join(dir, "meta.json"));
    metas[meta.id] = meta;
    if (!(await exists(join(dir, "verses.json")))) { err(`${meta.id}: verses.json missing (run npm run data:sources)`); continue; }
    const vs = (await withWordOverlay(dir, await readJson(join(dir, "verses.json")))).map((v) => ({ ...v, up: meta.id, ...(takeaways[v.id] ? { takeaway: takeaways[v.id] } : {}) }));
    const bh = (await exists(join(dir, "bhashya.json"))) ? await readJson(join(dir, "bhashya.json")) : {};
    bhashya[meta.id] = bh;
    const root = meta.en.replace(/ Upanishad$/, "");
    const lin = roots.lineage[meta.id];
    const veda = roots.vedas.find((x) => x.id === lin?.veda);
    if (!lin || !veda) err(`${meta.id}: no Veda lineage in vedic-roots.json`);
    // A Veda with sections (the Yajurveda: Śukla and Kṛṣṇa) is still one Veda; each text names its section.
    const section = veda?.sections ? veda.sections.find((x) => x.id === lin?.section) : null;
    if (veda?.sections && !section) err(`${meta.id}: the ${veda.label} has sections (${veda.sections.map((x) => x.id).join(", ")}); lineage must name one`);
    if (!veda?.sections && lin?.section) err(`${meta.id}: lineage names a section but the ${veda?.label ?? lin.veda} has none`);
    const mantras = vs.filter((v) => !v.shanti);
    texts.push({
      id: meta.id, abbrev: meta.abbrev, sa: meta.sa, iast: meta.iast, en: meta.en, veda: meta.veda, levels: meta.levels,
      scope: meta.scope, order: meta.order, tagline: meta.tagline, count: mantras.length,
      translators: [...new Set(vs.map((v) => v.tr?.by).filter(Boolean))],
      aliases: [...new Set([meta.abbrev, root, `${root} Upanishad`, `${root}opanishad`, meta.iast, `${meta.iast} Upaniṣad`, meta.sa, ...(meta.aliases || [])])],
      audio: vs.some((v) => v.audio && !v.shanti) ? { whole: "", durationSec: 0, chanter: null } : null,
      bhashya: meta.ingest?.bhashya ? { translator: meta.ingest.bhashya.translator, edition: meta.ingest.bhashya.edition } : null,
      translation: meta.translation === "partial" ? "partial" : "complete",
      lineage: lin && veda ? { veda: veda.id, vedaLabel: veda.label, ...(section ? { section: section.id, sectionLabel: `${section.label} ${veda.label}` } : {}), school: lin.school, seat: lin.seat, kind: lin.kind } : undefined,
      analysed: vs.filter((v) => v.words?.length).length,
      commented: vs.filter((v) => v.hasBhashya).length,
    });
    if (meta.expect && mantras.length !== meta.expect) err(`${meta.id}: ${mantras.length} mantras, expected ${meta.expect}`);
    if (!vs.some((v) => v.shanti && v.sa?.length)) err(`${meta.id}: no śānti mantra`);
    const untranslated = new Set(meta.untranslated || []);
    for (const v of vs) {
      if (!v.sa?.length) err(`${v.id}: no Devanagari`);
      if (!v.iast?.length) err(`${v.id}: no IAST`);
      if (!v.tr?.text && meta.translation !== "partial" && !untranslated.has(v.ref)) err(`${v.id}: no Śaṅkara-tradition translation`);
      if (v.audio && !/^https:\/\//.test(v.audio.mp3)) err(`${v.id}: audio URL is not https`);
      if (v.hasBhashya !== Boolean(bh[v.id])) err(`${v.id}: hasBhashya=${v.hasBhashya} but commentary ${bh[v.id] ? "present" : "absent"}`);
    }
    for (const ref of untranslated) if (!vs.some((v) => v.ref === ref)) err(`${meta.id}: declared untranslated passage ${ref} does not exist`);
    verses.push(...vs);
  }
  texts.sort((a, b) => a.order - b.order);
  for (const k of Object.keys(takeaways)) if (!verses.some((v) => v.id === k)) err(`takeaway for ${k}: no such passage`);
  // whole-recording audio for each text, from the cached manifest when available (not required)
  const audioIndexPath = join(ROOT, ".cache", "org", "api_index.json");
  if (await exists(audioIndexPath)) {
    const audio = (await readJson(audioIndexPath)).audio || {};
    for (const t of texts) {
      const a = audio[metas[t.id].ingest?.org];
      if (t.audio && a?.whole) t.audio = { whole: a.whole, durationSec: a.dur, chanter: CHANTER[metas[t.id].ingest.org] || null };
    }
  } else {
    const prev = join(ROOT, "public", "data", "index.json");
    if (await exists(prev)) for (const t of (await readJson(prev)).texts) { const x = texts.find((y) => y.id === t.id); if (x && t.audio) x.audio = t.audio; }
  }
  const verseById = new Map(verses.map((v) => [v.id, v]));
  const abbrevOf = new Map(texts.map((t) => [t.id, t.abbrev]));
  const textOf = (vid) => texts.find((t) => vid.startsWith(`${t.abbrev}_`));
  const kwOk = (vid, kw) => !kw || foldIast(verseById.get(vid)?.iast.join(" ") || "").includes(foldIast(kw));

  // ── nodes and links ──────────────────────────────────────────────────────────────────────────────
  const nodes = [];
  const edges = [];
  const addNode = (n) => nodes.push(n);
  const addEdge = (e) => edges.push(e);

  for (const v of roots.vedas) addNode({ id: `veda:${v.id}`, type: "Veda", label: v.label, sub: v.essence });
  for (const t of texts) {
    addNode({ id: `up:${t.id}`, type: "Upanishad", label: t.iast, sub: t.en, up: t.id });
    if (t.lineage) addEdge({ s: `up:${t.id}`, t: `veda:${t.lineage.veda}`, type: "DISTILLS", basis: "text", why: `${t.iast}${t.lineage.sectionLabel ? ` (${t.lineage.sectionLabel})` : ""}: ${t.lineage.seat}.` });
  }
  for (const t of texts) for (const v of verses.filter((x) => x.up === t.id).sort((a, b) => a.order - b.order)) addNode({ id: v.id, type: "Verse", label: v.shanti ? `${t.abbrev} śānti` : `${t.abbrev} ${v.ref}`, up: v.up, ref: v.ref });
  for (const c of concepts) {
    addNode({ id: `concept:${c.id}`, type: "Concept", label: cap(c.iast), sub: c.en });
    for (const x of c.teaches) addEdge({ s: x.verse, t: `concept:${c.id}`, type: "TEACHES", basis: "editorial", why: x.why, reviewed: false });
    for (const x of c.contrasts) addEdge({ s: `concept:${c.id}`, t: `concept:${x.with}`, type: "CONTRASTS_WITH", basis: "editorial", why: x.why, verse: x.verse, reviewed: false });
    if (!categories[c.category]) err(`concept ${c.id}: unknown category ${c.category}`);
  }
  for (const d of dilemmas) {
    addNode({ id: `dilemma:${d.id}`, type: "Dilemma", label: d.en, sub: d.desc });
    for (const x of d.verses) addEdge({ s: x.verse, t: `dilemma:${d.id}`, type: "DIAGNOSES", basis: "editorial", role: x.role, why: x.why, reviewed: false });
    for (const c of d.concepts) addEdge({ s: `concept:${c}`, t: `dilemma:${d.id}`, type: "DIAGNOSES", basis: "editorial", why: `A key idea for "${d.en}".`, reviewed: false });
  }
  for (const a of rubric.axes) {
    addNode({ id: `axis:${a.id}`, type: "Axis", label: a.label, sub: a.en });
    for (const c of a.grounds) addEdge({ s: `concept:${c}`, t: `axis:${a.id}`, type: "GROUNDS", basis: "editorial", why: `${a.label} is scored against this idea.`, reviewed: false });
  }
  for (const p of persons) addNode({ id: `person:${p.id}`, type: "Person", label: p.iast, sub: p.role });
  for (const s of stories) {
    addNode({ id: `story:${s.id}`, type: "Story", label: s.title, sub: s.summary });
    for (const v of s.verses) addEdge({ s: v, t: `story:${s.id}`, type: "IN_STORY", basis: "text" });
    for (const p of s.cast) addEdge({ s: `person:${p}`, t: `story:${s.id}`, type: "IN_STORY", basis: "text" });
  }

  // External passages: the Gītā (GitaViśva), the Saṃhitās (VedAnvaya) and the Brahma Sūtra.
  const external = {};
  const addExternal = (side) => {
    const corpus = side.split("_")[0];
    const cfg = extCorpora[corpus];
    if (!cfg) { err(`external ${side}: unknown corpus ${corpus}`); return false; }
    if (external[side]) return true;
    const ref = side.slice(corpus.length + 1);
    external[side] = { label: `${corpus} ${ref}`, corpus: cfg.name, title: cfg.title, url: null, site: cfg.site || null, path: cfg.path ? cfg.path.replace("{id}", side).replace("{ref}", ref) : null };
    addNode({ id: side, type: "External", label: `${corpus} ${ref}`, sub: `${cfg.title}${cfg.name !== cfg.title ? ` · ${cfg.name}` : ""}` });
    if (!validExternal(corpus, ref, cfg)) err(`external ${side}: not a valid ${cfg.title} reference`);
    return true;
  };
  for (const x of crossrefs) {
    for (const side of [x.a, x.b]) if (!verseById.has(side)) addExternal(side);
    addEdge({ s: x.a, t: x.b, type: "CROSS_REFERENCES", basis: x.kind === "echo" ? "editorial" : "text", kind: x.kind, why: x.note });
  }
  for (const r of roots.mantraRoots) for (const e of r.ext) {
    addExternal(e);
    addEdge({ s: r.up, t: e, type: "ROOTED_IN", basis: "text", kind: r.kind, why: r.note });
  }
  for (const b of roots.brahmaSutra) {
    const id = `BS_${b.bs}`;
    addExternal(id);
    nodes.find((n) => n.id === id).sub = `Brahma Sūtra ${b.bs}: ${b.sutra}`;
    addEdge({ s: b.verse, t: id, type: "READ_BY", basis: "editorial", why: `${b.sutra}: ${b.en}`, reviewed: false });
  }
  for (const d of dilemmas) for (const e of d.external || []) if (addExternal(e)) addEdge({ s: `dilemma:${d.id}`, t: e, type: "CROSS_REFERENCES", basis: "editorial", kind: "echo", why: `Where the ${extCorpora[e.split("_")[0]].title} speaks to “${d.en}”.` });

  // Śaṅkara's citations: famous śruti statements he quotes, and explicit references, in each commentary.
  const shankara = new Map();
  const ABBR = shruti.abbreviations;
  const abbrRe = new RegExp(`\\b(${Object.keys(ABBR).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\.?\\s*(?:Up(?:aniṣad|anishad|a)?\\.?)?,?\\s*([IVXLivxl]+|\\d{1,2})[.\\s-]+([IVXLivxl]+|\\d{1,3})(?:[.\\s-]+(\\d{1,3}))?`, "g");
  const num = (s) => (/^\d+$/.test(s) ? Number(s) : roman(s));
  for (const [up, bh] of Object.entries(bhashya)) {
    for (const [vid, b] of Object.entries(bh)) {
      const low = b.text.toLowerCase();
      const fold = foldIast(b.text);
      for (const p of shruti.phrases) {
        if (p.verse === vid) continue;
        const hit = p.match.find((m) => (/[^\x00-\x7f]/.test(m) ? fold.includes(foldIast(m)) : low.includes(m.toLowerCase())));
        if (hit) shankara.set(`${vid}|${p.verse}`, { s: vid, t: p.verse, why: `Śaṅkara, commenting on ${labelOf(vid)}, quotes ${p.label}.` });
      }
      for (const m of b.text.matchAll(abbrRe)) {
        const ab = ABBR[m[1]];
        const parts = [m[2], m[3], m[4]].filter(Boolean).map(num);
        for (const cand of [parts.join("."), parts.slice(0, 2).join(".")]) {
          const target = `${ab}_${cand}`;
          if (target !== vid && verseById.has(target)) { shankara.set(`${vid}|${target}`, { s: vid, t: target, why: `Śaṅkara, commenting on ${labelOf(vid)}, cites ${m[0].trim()}.` }); break; }
        }
      }
      // A reference with no title, "(I. iv. 7)", points into the same Upanishad (Mādhavānanda, Gambhīrānanda).
      const abbrev = vid.split("_")[0];
      for (const m of b.text.matchAll(/\((?:Ibid\.?,?\s*)?([IVX]{1,4})\.\s?([ivx]{1,5})\.\s?(\d{1,3})\)/g)) {
        const target = `${abbrev}_${roman(m[1])}.${roman(m[2])}.${m[3]}`;
        if (target !== vid && verseById.has(target)) shankara.set(`${vid}|${target}`, { s: vid, t: target, why: `Śaṅkara, commenting on ${labelOf(vid)}, refers back to ${labelOf(target)}.` });
      }
    }
    void up;
  }
  for (const x of shankara.values()) addEdge({ s: x.s, t: x.t, type: "CITES", basis: "shankara", why: x.why });
  function labelOf(vid) {
    const v = verseById.get(vid);
    return v ? `${abbrevOf.get(v.up)} ${v.ref}` : vid;
  }

  // Stems: a passage carries a key stem when its analysed words have one of the stem's lemmas, or its IAST matches.
  const stemMap = {};
  for (const st of stems) {
    const re = new RegExp(st.re, "u");
    const lemmas = new Set(st.lemmas.map((l) => l.toLowerCase()));
    const list = [];
    for (const v of verses) {
      const iast = v.iast.join(" ").toLowerCase().normalize("NFC");
      if (re.test(iast) || (v.words || []).some((w) => lemmas.has(w[3]))) list.push(v.id);
    }
    if (list.length < 3) err(`stem ${st.id}: only ${list.length} passage(s) carry it`);
    addNode({ id: `stem:${st.id}`, type: "Stem", label: st.iast, sub: `${st.en} · ${list.length} passages` });
    stemMap[`stem:${st.id}`] = list;
  }

  // ── integrity gate ──────────────────────────────────────────────────────────────────────────────
  const fullEdges = [...expandStructural(nodes), ...Object.entries(stemMap).flatMap(([s, vs]) => vs.map((v) => ({ s: v, t: s, type: "HAS_STEM", basis: "text" }))), ...edges];
  const ids = new Map();
  for (const n of nodes) { if (ids.has(n.id)) err(`duplicate node id ${n.id}`); ids.set(n.id, n); }
  const seen = new Set();
  const degree = new Map();
  const semantic = new Map();
  for (const e of fullEdges) {
    if (!ids.has(e.s)) err(`${e.type} edge from missing node ${e.s}`);
    if (!ids.has(e.t)) err(`${e.type} edge to missing node ${e.t}`);
    if (e.s === e.t) err(`self-loop ${e.type} on ${e.s}`);
    const k = `${e.type}|${e.s}|${e.t}`;
    if (seen.has(k)) err(`duplicate edge ${k}`);
    seen.add(k);
    degree.set(e.s, (degree.get(e.s) || 0) + 1);
    degree.set(e.t, (degree.get(e.t) || 0) + 1);
    if (!["PART_OF", "NEXT"].includes(e.type)) { semantic.set(e.s, (semantic.get(e.s) || 0) + 1); semantic.set(e.t, (semantic.get(e.t) || 0) + 1); }
    if (["TEACHES", "DIAGNOSES", "CONTRASTS_WITH", "GROUNDS", "READ_BY", "CITES", "ROOTED_IN"].includes(e.type) && !e.why) err(`${k} has no 'why'`);
  }
  for (const n of nodes) if (["Concept", "Dilemma", "Axis", "Story", "Person", "Veda", "Stem", "External"].includes(n.type) && !degree.get(n.id)) err(`${n.type} ${n.id} is isolated`);
  // No decorative dots: every passage carries at least one link of meaning (a stem, an idea, a story, a citation).
  const dead = nodes.filter((n) => n.type === "Verse" && !semantic.get(n.id)).map((n) => n.id);
  if (dead.length) err(`${dead.length} passage(s) have no link of meaning: ${dead.slice(0, 12).join(", ")}${dead.length > 12 ? "…" : ""}`);

  // Every curated verse reference must point where it says: an IAST keyword (kw) or a Devanagari anchor.
  const curated = [
    ...concepts.flatMap((c) => [...c.teaches, ...c.contrasts]),
    ...dilemmas.flatMap((d) => d.verses),
    ...paths.flatMap((p) => p.steps.map((s) => (s.kw !== undefined ? { verse: s.node, kw: s.kw } : { verse: s.node }))).filter((x) => verseById.has(x.verse) || /^[A-Z][a-zA-Z]*_\d/.test(x.verse)),
    // identical and parallel passages are checked by their wording below; echoes need a keyword or an anchor
    ...crossrefs.filter((x) => x.kind === "echo").flatMap((x) => [{ verse: x.a, kw: x.kwA }, { verse: x.b, kw: x.kwB }].map((y) => (y.kw === undefined ? { verse: y.verse } : y))).filter((x) => !extCorpora[x.verse.split("_")[0]]),
    // the Darśana comparisons name their passage by keyword
    ...darshanas.passages.map((p) => ({ verse: p.verse, kw: p.kw })),
    // a Saṃhitā root the Upanishad only quotes in part ("echo") must name the quoted words
    ...roots.mantraRoots.filter((r) => r.kind === "echo").map((r) => (r.kw !== undefined ? { verse: r.up, kw: r.kw } : { verse: r.up })),
  ];
  let anchorChecks = 0;
  for (const x of curated) {
    if (!verseById.has(x.verse)) { err(`curated reference ${x.verse} is not in the corpus`); continue; }
    if (x.kw !== undefined) {
      anchorChecks++;
      if (!kwOk(x.verse, x.kw)) err(`curated reference ${x.verse}: IAST lacks “${x.kw}”`);
    } else if (!anchors[x.verse]) err(`curated reference ${x.verse} has no anchor in anchors.json and no kw`);
  }
  for (const [ref, a] of Object.entries(anchors)) {
    const v = verseById.get(ref);
    if (!v) { err(`anchor ${ref}: verse not in corpus`); continue; }
    const text = normDeva(v.sa.join(" "));
    const missing = a.sa.filter((f) => !text.includes(normDeva(f)));
    anchorChecks++;
    if (missing.length) err(`anchor ${ref}: Devanagari lacks ${missing.join(" | ")}`);
    if (a.bhashya && !v.hasBhashya) err(`anchor ${ref}: Śaṅkara's commentary expected but missing`);
  }
  for (const m of mandatory) {
    anchorChecks++;
    if (!verseById.has(m.verse)) err(`mandatory passage ${m.verse} (${m.why}) is missing`);
    else if (!kwOk(m.verse, m.kw)) err(`mandatory passage ${m.verse} (${m.why}) lacks “${m.kw}”`);
  }
  for (const s of stories) for (const v of s.verses) if (!verseById.has(v)) err(`story ${s.id}: passage ${v} is not in the corpus`);
  for (const c of concepts) if (c.teaches.length < 2) err(`concept ${c.id} has ${c.teaches.length} grounding verse(s); needs ≥ 2`);
  for (const d of dilemmas) {
    if (d.verses.length < 3) err(`dilemma ${d.id} has ${d.verses.length} verses; needs ≥ 3`);
    if (!d.preyas || !d.shreyas) err(`dilemma ${d.id} needs both preyas and shreyas`);
    if (d.cues.length < 3) err(`dilemma ${d.id} needs ≥ 3 cues`);
    for (const c of d.concepts) if (!concepts.some((x) => x.id === c)) err(`dilemma ${d.id}: unknown concept ${c}`);
  }
  if (rubric.axes.length !== 6) err(`rubric has ${rubric.axes.length} axes; expected 6`);
  if (!rubric.controlSystem) err("rubric has no controlSystem (the honesty control)");
  if (/upani|veda|śruti|scripture|sanskrit/i.test(rubric.controlSystem || "")) err("the honesty control prompt must not mention scripture");
  for (const a of rubric.axes) {
    if (a.levels.length !== 5) err(`axis ${a.id} needs 5 level descriptors (0–4)`);
    if (a.grounds.length < 2) err(`axis ${a.id} needs ≥ 2 grounding concepts`);
    for (const c of a.grounds) if (!concepts.some((x) => x.id === c)) err(`axis ${a.id}: unknown concept ${c}`);
  }
  for (const p of rubric.presets) if (!dilemmas.some((d) => d.id === p.expectDilemma)) err(`preset ${p.id}: unknown dilemma ${p.expectDilemma}`);
  for (const re of [rubric.checks.flatteryOpener, rubric.checks.flatteryPhrase, rubric.checks.engagementBait, ...rubric.pressures.flatMap((p) => p.cues)]) {
    try { new RegExp(re, "i"); } catch { err(`rubric regex does not compile: ${re}`); }
  }
  for (const p of paths) for (const s of p.steps) {
    if (s.node === "reflect") continue;
    if (s.node.startsWith("concept:") ? !concepts.some((c) => `concept:${c.id}` === s.node) : !verseById.has(s.node)) err(`path ${p.id}: step ${s.node} does not resolve`);
  }
  for (const s of stories) for (const p of s.cast) if (!persons.some((x) => x.id === p)) err(`story ${s.id}: unknown person ${p}`);
  for (const g of glossary) if (g.concept && !concepts.some((c) => c.id === g.concept)) err(`glossary ${g.id}: unknown concept ${g.concept}`);
  if (Object.keys(roots.lineage).length !== texts.length) err(`vedic-roots lineage covers ${Object.keys(roots.lineage).length} texts; corpus has ${texts.length}`);

  // Parallels must share their wording: identical ≥ 0.75, parallel ≥ 0.45 (Devanagari or folded IAST).
  const crossChecks = [];
  // Similarity is the better of Dice overlap and containment (a verse quoted inside a longer passage counts in full).
  const similar = (x, y) => Math.max(dice(x, y), contained(x.length <= y.length ? x : y, x.length <= y.length ? y : x));
  const wording = (a, b, kind) => {
    if (kind === "echo") return;
    const A = verseById.get(a), B = verseById.get(b);
    let sim = null;
    if (A && B) sim = similar(normDeva(A.sa.join("")), normDeva(B.sa.join("")));
    else {
      const local = A || B, other = extText[A ? b : a];
      if (local && other?.sa) sim = similar(normDeva(local.sa.join("")), normDeva(Array.isArray(other.sa) ? other.sa.join("") : other.sa));
      else if (local && other?.iast) sim = similar(foldIast(local.iast.join("")), foldIast(Array.isArray(other.iast) ? other.iast.join("") : other.iast));
      else warnings.push(`${a} ≡ ${b}: external text not available locally; wording not checked`);
    }
    if (sim !== null) {
      crossChecks.push({ a, b, kind, similarity: Number(sim.toFixed(3)) });
      const min = kind === "identical" ? 0.75 : 0.45;
      if (sim < min) err(`${a} ${kind} ${b}: wording similarity ${sim.toFixed(2)} < ${min}`);
    }
  };
  for (const x of crossrefs) wording(x.a, x.b, x.kind);
  for (const r of roots.mantraRoots) for (const e of r.ext) wording(r.up, e, r.kind);

  // ── layout: the ring grouped by Veda, the mandala inside, passages placed by forces ─────────────────
  const layout3d = cosmosLayout(nodes, edges, texts, roots);

  // ── lemma index (every analysed word) ───────────────────────────────────────────────────────────
  const lemmas = {};
  for (const v of verses) for (const w of v.words || []) {
    const l = w[3];
    if (!l || l.length < 2) continue;
    const e = (lemmas[l] ||= [w[2] || "", []]);
    if (!e[0] && w[2]) e[0] = w[2];
    if (e[1][e[1].length - 1] !== v.id) e[1].push(v.id);
  }

  // ── artifacts ─────────────────────────────────────────────────────────────────────────────────────
  const lite = (v) => ({
    id: v.id, up: v.up, ref: v.ref, section: v.section, sa: v.sa.join(" "), iast: v.iast.join(" "),
    tr: v.tr?.text || "", trBy: v.tr?.by || "", audio: v.audio?.mp3 || null, hasBhashya: v.hasBhashya, ...(v.shanti ? { shanti: true } : {}),
  });
  const verseLite = verses.map(lite);
  const index = {
    texts,
    verseIds: verses.map((v) => [v.id, v.up, v.ref]),
    concepts, dilemmas, stories, persons, external,
    vedas: roots.vedas,
    glossary,
  };
  const graph = { v: 2, nodes, edges, stems: stemMap };
  const corpusHash = (hash(JSON.stringify(verseLite)) >>> 0).toString(16).padStart(8, "0");
  const runFiles = (await exists(join(ROOT, "public", "data", "runs"))) ? (await readdir(join(ROOT, "public", "data", "runs"))).filter((f) => f.endsWith(".json") && f !== "index.json") : [];
  const mantras = verses.filter((v) => !v.shanti);
  const semanticEdges = edges.filter((e) => !STRUCT.has(e.type)).length;
  const facts = {
    texts: { complete: texts.filter((t) => t.scope === "complete").length, excerpts: texts.filter((t) => t.scope !== "complete").length, total: texts.length },
    mantras: { complete: mantras.filter((v) => textOf(v.id)?.scope === "complete").length, excerpts: mantras.filter((v) => textOf(v.id)?.scope !== "complete").length, total: mantras.length },
    shanti: verses.filter((v) => v.shanti).length,
    bhashyaVerses: verses.filter((v) => v.hasBhashya).length,
    audioVerses: mantras.filter((v) => v.audio).length,
    translatedVerses: mantras.filter((v) => v.tr?.text).length,
    analysedVerses: verses.filter((v) => v.words?.length).length,
    concepts: concepts.length, dilemmas: dilemmas.length, stories: stories.length, persons: persons.length,
    paths: paths.length, axes: rubric.axes.length, presets: rubric.presets.length,
    nodes: nodes.length, edges: fullEdges.length, semanticEdges,
    shankaraLinks: edges.filter((e) => e.type === "CITES").length,
    vedaSaraLinks: edges.filter((e) => e.type === "DISTILLS" || e.type === "ROOTED_IN" || e.type === "READ_BY").length,
    stems: stems.length, lemmas: Object.keys(lemmas).length, glossary: glossary.length,
    anchors: anchorChecks, crossCorpus: Object.keys(external).length,
    runs: runFiles.length, corpusHash,
  };
  const outputs = {
    "index.json": JSON.stringify(index),
    "graph.json": JSON.stringify(graph),
    "layout.json": JSON.stringify(layout3d),
    "lemmas.json": JSON.stringify(lemmas),
    "rubric.json": JSON.stringify(rubric),
    "paths.json": JSON.stringify({ paths, categories }),
    "facts.json": JSON.stringify(facts, null, 2),
    "darshanas.json": JSON.stringify(darshanas),
  };
  for (const t of texts) {
    outputs[`verses/${t.id}.json`] = JSON.stringify(verseLite.filter((v) => v.up === t.id));
    // Full passages and Śaṅkara's commentary are split by chapter (the first number of the ref; "0" is the śānti),
    // so opening one passage never downloads a whole Bṛhadāraṇyaka (1.5 MB) or its commentary.
    const chapterOf = (ref) => ref.split(".")[0];
    const own = verses.filter((v) => v.up === t.id);
    for (const ch of [...new Set(own.map((v) => chapterOf(v.ref)))]) {
      const vs = own.filter((v) => chapterOf(v.ref) === ch);
      outputs[`corpus/${t.id}/${ch}.json`] = JSON.stringify(vs);
      const bh = Object.fromEntries(Object.entries(bhashya[t.id] || {}).filter(([vid]) => vs.some((v) => v.id === vid)));
      outputs[`bhashya/${t.id}/${ch}.json`] = JSON.stringify(bh);
    }
  }
  return { outputs, errors, warnings, facts, crossChecks, kb: { ...index, verses: verseLite }, graph };
}

/** PART_OF and NEXT, as expandGraph rebuilds them in the browser (kept identical on purpose). */
function expandStructural(nodes) {
  const out = [];
  let prev = null;
  for (const n of nodes) {
    if (n.type !== "Verse") continue;
    out.push({ s: n.id, t: `up:${n.up}`, type: "PART_OF", basis: "text" });
    if (prev && prev.up === n.up) out.push({ s: prev.id, t: n.id, type: "NEXT", basis: "text" });
    prev = n;
  }
  return out;
}

const CHANTER = { isha: "Ravindra Sathe", katha: "Ravindra Sathe", prashna: "Ravindra Sathe", taittiriya: "Ravindra Sathe", kena: "Ashit Desai", mundaka: "Ashit Desai", mandukya: "Ashit Desai" };
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function roman(s) {
  let n = 0, prev = 0;
  for (const c of s.toLowerCase().split("").reverse()) { const v = ROMAN[c] || 0; n += v < prev ? -v : v; prev = Math.max(prev, v); }
  return n;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** Share of the shorter text's character 5-grams that also occur in the longer text (a quotation inside a passage). */
function contained(short, long) {
  if (short.length < 16) return 0;
  const have = new Set();
  for (let i = 0; i + 5 <= long.length; i++) have.add(long.slice(i, i + 5));
  let hit = 0, n = 0;
  for (let i = 0; i + 5 <= short.length; i++, n++) if (have.has(short.slice(i, i + 5))) hit++;
  return n ? hit / n : 0;
}
function validExternal(corpus, ref, cfg) {
  const p = ref.split(".").map(Number);
  if (corpus === "BG") return p.length === 2 && p[0] >= 1 && p[0] <= 18 && p[1] >= 1 && p[1] <= cfg.chapterVerses[p[0] - 1];
  if (corpus === "RV") return p.length === 3 && p[0] >= 1 && p[0] <= 10 && p[1] >= 1 && p[2] >= 1;
  if (corpus === "YV") return p.length === 2 && p[0] >= 1 && p[0] <= 40 && p[1] >= 1;
  if (corpus === "BS") return p.length === 3 && p[0] >= 1 && p[0] <= 4 && p[1] >= 1 && p[1] <= 4 && p[2] >= 1;
  return true;
}

// The cosmos. Hubs on the ring grouped by Veda (one empty slot between Vedas); each Veda's node just outside its arc;
// the teaching core and the stems as fixed rings inside, each node at the angle of the texts it touches; passages and
// external nodes placed by d3-force-3d around them.
function cosmosLayout(nodes, edges, texts, roots) {
  const byVeda = VEDA_ORDER.map((v) => texts.filter((t) => t.lineage?.veda === v).sort((a, b) => a.order - b.order));
  const slots = texts.length + VEDA_ORDER.length;
  const hubAngle = new Map();
  const vedaAngle = new Map();
  let slot = 0;
  byVeda.forEach((list, i) => {
    const first = slot;
    for (const t of list) hubAngle.set(t.id, slotAngle(slot++, slots));
    vedaAngle.set(VEDA_ORDER[i], slotAngle(first + (list.length - 1) / 2, slots));
    slot++; // the gap
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map();
  for (const e of edges) {
    if (STRUCT.has(e.type)) continue;
    (adj.get(e.s) || adj.set(e.s, []).get(e.s)).push(e.t);
    (adj.get(e.t) || adj.set(e.t, []).get(e.t)).push(e.s);
  }
  const prefer = (id, extra = []) => {
    let sx = 0, sz = 0;
    const add = (up, w) => { const a = hubAngle.get(up); if (a !== undefined) { sx += Math.cos(a) * w; sz += Math.sin(a) * w; } };
    for (const up of extra) add(up, 1);
    const seen = new Set([id]);
    let ring = [id];
    for (let hop = 0; hop < 2; hop++) {
      const next = [];
      for (const x of ring) for (const y of adj.get(x) || []) {
        if (seen.has(y)) continue;
        seen.add(y);
        next.push(y);
        const n = byId.get(y);
        if (n?.type === "Verse") add(n.up, hop === 0 ? 1 : 0.35);
      }
      ring = next;
    }
    return sx === 0 && sz === 0 ? 0 : Math.atan2(sz, sx);
  };
  const fixed = new Map();
  for (const t of texts) fixed.set(`up:${t.id}`, hubPosition(hubAngle.get(t.id)));
  for (const v of roots.vedas) fixed.set(`veda:${v.id}`, vedaPosition(vedaAngle.get(v.id) ?? 0));
  // Stems sit at the circular mean of the texts they occur in.
  const stemTexts = new Map();
  for (const n of nodes) if (n.type === "Stem") stemTexts.set(n.id, []);
  for (const [type, ring] of Object.entries(CORE_RINGS)) {
    const list = nodes.filter((n) => n.type === type).map((n) => ({ id: n.id, a: prefer(n.id) })).sort((a, b) => a.a - b.a || a.id.localeCompare(b.id));
    if (!list.length) continue;
    const gap = ((Math.PI * 2) / list.length) * 0.82;
    const ang = list.map((n) => n.a);
    for (let it = 0; it < 400; it++) {
      let moved = false;
      for (let i = 0; i < ang.length; i++) {
        const j = (i + 1) % ang.length;
        let d = ang[j] - ang[i];
        if (j === 0) d += Math.PI * 2;
        if (d < gap) { const push = (gap - d) / 2; ang[i] -= push; ang[j] += push; moved = true; }
      }
      if (!moved) break;
    }
    const R = ring.r * RING_R;
    list.forEach((n, i) => fixed.set(n.id, [R * Math.cos(ang[i]), ring.y + 6 * Math.sin(ang[i] * 3), R * Math.sin(ang[i])]));
  }
  const sim = nodes.map((n) => {
    const f = fixed.get(n.id);
    if (f) return { id: n.id, type: n.type, x: f[0], y: f[1], z: f[2], fx: f[0], fy: f[1], fz: f[2] };
    // passages start beside their hub so the simulation settles quickly and deterministically
    const a = hubAngle.get(n.up);
    const k = (hash(n.id) % 1000) / 1000;
    return a !== undefined ? { id: n.id, type: n.type, up: n.up, x: RING_R * Math.cos(a) + (k - 0.5) * 60, y: 0, z: RING_R * Math.sin(a) + (k - 0.5) * 60 } : { id: n.id, type: n.type };
  });
  // (links to missing nodes are reported by the integrity gate; the layout simply skips them)
  const links = [...expandStructural(nodes), ...edges.filter((e) => !STRUCT.has(e.type) && byId.has(e.s) && byId.has(e.t))].map((e) => ({ source: e.s, target: e.t, type: e.type }));
  const s = forceSimulation(sim, 3)
    .alphaDecay(ALPHA_DECAY)
    .velocityDecay(VELOCITY_DECAY)
    .force("link", forceLink(links).id((d) => d.id).distance((l) => linkDistance(l.type)).strength((l) => linkStrength(l.type)))
    .force("charge", forceManyBody().strength(CHARGE.strength).distanceMax(CHARGE.distanceMax))
    .force("radial", forceRadial((d) => radialTarget(d.type)).strength((d) => radialStrength(d.type)))
    .force("contain", containForce())
    .stop();
  for (let i = 0; i < LAYOUT_TICKS; i++) s.tick();
  const r = (v) => Math.round(v * 10) / 10;
  return Object.fromEntries(sim.map((n) => [n.id, [r(n.x), r(n.y), r(n.z)]]));
}
