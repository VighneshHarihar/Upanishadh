// UpaSārathi v1.0: the 13-text corpus, Veda-Sāra lineage, the dense graph, fair corpus boundaries, lazy loading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { join } from "node:path";
import { ci, compactGraph, graph, index, kb, read } from "./helpers.ts";
import { expandGraph, focus, indexGraph, NAVIGATION_ONLY, shortestPath } from "../src/lib/core/graph.ts";
import { runChecks, verifyQuotes } from "../src/lib/core/checks.ts";
import { devaToIast, foldIast } from "../src/lib/core/text.ts";
import type { Facts, Rubric } from "../src/lib/core/types.ts";

const gi = indexGraph(graph);
const facts = read<Facts>("facts.json");
const rubric = read<Rubric>("rubric.json");
const D = join(import.meta.dirname, "..", "public", "data");

test("all thirteen Principal Upanishads are present, complete, each with its śānti invocation where it has one", () => {
  assert.deepEqual(
    index.texts.map((t) => t.id),
    ["isha", "kena", "katha", "prashna", "mundaka", "mandukya", "taittiriya", "aitareya", "chandogya", "brihadaranyaka", "shvetashvatara", "kaushitaki", "maitri"],
  );
  for (const t of index.texts) {
    assert.equal(t.scope, "complete", t.id);
    // count is the mantras; the śānti invocation (ref "0") is carried in addition.
    assert.equal(kb.verses.filter((v) => v.up === t.id && !v.shanti).length, t.count, t.id);
    assert.ok(t.lineage?.veda, `${t.id} has a Veda lineage`);
  }
  assert.equal(facts.texts.total, 13);
  assert.equal(kb.verses.filter((v) => v.shanti).length, facts.shanti);
  assert.ok(facts.shanti >= 13);
});

test("the mandatory passages are addressable: mahāvākyas, Uddālaka's analogies, neti neti, the two birds", () => {
  const has = (id: string) => gi.nodes.has(id);
  for (const id of ["AiU_3.1.3", "BU_1.4.10", "ChU_6.8.7", "MaU_2", "BU_2.3.6", "MuU_3.1.1", "SvU_4.6", "TU_2.1"]) assert.ok(has(id), id);
  for (let k = 8; k <= 16; k++) assert.ok(kb.verses.some((v) => v.up === "chandogya" && v.ref.startsWith(`6.${k}.`)), `ChU 6.${k}`);
  assert.match(foldIast(kb.verses.find((v) => v.id === "ChU_6.8.7")!.iast), /tat tvam asi|tattvamasi/);
  // The two birds are the same mantra in two Upanishads, and both reach back to the Ṛgveda.
  const birds = graph.edges.filter((e) => e.type === "ROOTED_IN" && e.t === "RV_1.164.20").map((e) => e.s).sort();
  assert.deepEqual(birds, ["MuU_3.1.1", "SvU_4.6"]);
  assert.ok(graph.edges.some((e) => e.type === "CROSS_REFERENCES" && [e.s, e.t].sort().join() === ["MuU_3.1.1", "SvU_4.6"].sort().join()));
});

test("Veda-Sāra: four Vedas, every Upanishad distils exactly one; Yajurveda texts name their section", () => {
  const vedas = graph.nodes.filter((n) => n.type === "Veda").map((n) => n.id).sort();
  assert.deepEqual(vedas, ["veda:atharva", "veda:rig", "veda:sama", "veda:yajur"]);
  const sections = Object.fromEntries(index.texts.filter((t) => t.lineage?.veda === "yajur").map((t) => [t.id, t.lineage!.section]));
  assert.deepEqual(sections, { isha: "shukla", katha: "krishna", taittiriya: "krishna", brihadaranyaka: "shukla", shvetashvatara: "krishna", maitri: "krishna" });
  for (const t of index.texts) if (t.lineage?.veda !== "yajur") assert.equal(t.lineage?.section, undefined, t.id);
  for (const t of index.texts) {
    const d = graph.edges.filter((e) => e.type === "DISTILLS" && e.s === `up:${t.id}`);
    assert.equal(d.length, 1, t.id);
    assert.equal(d[0].t, `veda:${t.lineage!.veda}`);
  }
});

test("no dead dots: every passage carries at least one meaningful link", () => {
  const live = new Set<string>();
  for (const e of graph.edges) {
    if (e.type === "PART_OF" || e.type === "NEXT") continue;
    live.add(e.s);
    live.add(e.t);
  }
  const dead = kb.verses.filter((v) => !live.has(v.id)).map((v) => v.id);
  assert.deepEqual(dead, []);
});

test("the compact graph expands to the same structure it was built from", () => {
  const g = expandGraph(compactGraph);
  const verses = g.nodes.filter((n) => n.type === "Verse");
  assert.equal(g.edges.filter((e) => e.type === "PART_OF").length, verses.length);
  assert.equal(g.edges.filter((e) => e.type === "HAS_STEM").length, Object.values(compactGraph.stems).reduce((n, l) => n + l.length, 0));
  assert.equal(g.edges.length, facts.edges);
  assert.ok(NAVIGATION_ONLY.has("HAS_STEM"));
});

test("focus views never exceed fifteen nodes, even around a hub", () => {
  for (const id of ["up:chandogya", "veda:sama", "stem:atman", "concept:atman", "KaU_1.2.2", "story:naciketas"]) {
    const f = focus(gi, id, 15);
    assert.ok(f.nodes.length > 1 && f.nodes.length <= 15, `${id}: ${f.nodes.length}`);
    assert.ok(f.nodes.includes(id));
  }
});

test("the path finder prefers meaning over 'both are in the same text'", () => {
  const p = shortestPath(gi, "MuU_3.1.1", "BG_13.14");
  assert.ok(p, "a path exists");
  assert.equal(p!.nodes[0], "MuU_3.1.1");
  assert.equal(p!.nodes.at(-1), "BG_13.14");
  assert.equal(p!.edges.length, p!.nodes.length - 1);
  assert.ok(p!.nodes.length <= 6);
  assert.equal(shortestPath(gi, "MuU_3.1.1", "MuU_3.1.1")!.nodes.length, 1);
  assert.equal(shortestPath(gi, "MuU_3.1.1", "nowhere"), null);
});

test("fair corpus boundaries: invented Kaṭha lines are fabricated, Gītā lines are outside, real lines verify", () => {
  const fake = verifyQuotes(ci, "As the Kaṭha Upaniṣad says: “रजः धनः सर्वधनानां श्रेष्ठः”", kb);
  assert.equal(fake[0].found, null);
  assert.equal(fake[0].scope, "corpus");
  const gita = verifyQuotes(ci, "The Bhagavad Gītā says: “कर्मण्येवाधिकारस्ते मा फलेषु कदाचन”", kb);
  assert.equal(gita[0].found, null);
  assert.equal(gita[0].scope, "outside");
  const checks = runChecks(kb, ci, rubric, "The Bhagavad Gītā says: “कर्मण्येवाधिकारस्ते मा फलेषु कदाचन” (Gita 2.47)");
  assert.equal(checks.unverifiedQuotes, 0);
  assert.ok(checks.claimedRefs.some((r) => r.outside === "Bhagavad Gītā"));
  assert.equal(verifyQuotes(ci, "न वित्तेन तर्पणीयो मनुष्यो", kb)[0].found, "KaU_1.1.27");
});

test("Devanagari transliterates to IAST for the Wikisource texts", () => {
  assert.equal(devaToIast("तत्त्वमसि"), "tattvamasi");
  assert.equal(devaToIast("कौषीतकि"), "kauṣītaki");
  assert.equal(devaToIast("ॐ"), "oṃ");
  for (const up of ["kaushitaki", "maitri"]) {
    const v = kb.verses.find((x) => x.up === up && x.ref !== "0")!;
    assert.match(v.iast, /[a-zāīūṛṃḥśṣṇṭḍ]/, up);
    assert.doesNotMatch(v.iast, /[ऀ-ॣ०-ॿ]/, up); // letters and digits (the daṇḍa is kept)
  }
});

test("initial load stays small: the index is under 500 KB and passages load per Upanishad", () => {
  const kbSize = statSync(join(D, "index.json")).size;
  assert.ok(kbSize < 500 * 1024, `index.json is ${Math.round(kbSize / 1024)} KB`);
  for (const t of index.texts) assert.ok(statSync(join(D, "verses", `${t.id}.json`)).size > 0);
  assert.equal(index.verseIds.length, kb.verses.length);
});

test("the guided path for the hero is five minutes, and every path step is a real node", () => {
  const { paths } = read<{ paths: { id: string; minutes: number; steps: { node: string; kind: string }[] }[] }>("paths.json");
  assert.ok(paths.some((p) => p.minutes <= 5));
  for (const p of paths) for (const s of p.steps) if (s.kind !== "reflect") assert.ok(gi.nodes.has(s.node), `${p.id}: ${s.node}`);
});
