// The completion pass: no thin spots across the thirteen texts, and every new source labelled for what it is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { index, read } from "./helpers.ts";
import type { Bhashya, Facts, Verse } from "../src/lib/core/types.ts";

const D = join(import.meta.dirname, "..", "public", "data");
const facts = read<Facts>("facts.json");
const chapters = (dir: string, up: string) => readdirSync(join(D, dir, up)).filter((f) => f.endsWith(".json"));
const corpus = (up: string) => chapters("corpus", up).flatMap((f) => read<Verse[]>(`corpus/${up}/${f}`));
const bhashya = (up: string): Record<string, Bhashya> => Object.assign({}, ...chapters("bhashya", up).map((f) => read<Record<string, Bhashya>>(`bhashya/${up}/${f}`)));

test("every one of the 1,693 passages has an English translation and a word-by-word reading", () => {
  for (const t of index.texts) {
    const vs = corpus(t.id).filter((v) => !v.shanti);
    assert.equal(vs.length, t.count, t.id);
    assert.deepEqual(vs.filter((v) => !v.tr).map((v) => v.id), [], `${t.id}: passages without English`);
    assert.deepEqual(vs.filter((v) => !v.words?.length).map((v) => v.id), [], `${t.id}: passages without word analysis`);
  }
  assert.equal(facts.translatedVerses, facts.mantras.total);
  assert.equal(facts.analysedVerses, facts.mantras.total);
});

test("Śaṅkara’s commentary covers the texts he commented on, and says where it came from", () => {
  const floor: Record<string, number> = { chandogya: 590, brihadaranyaka: 360, taittiriya: 30, aitareya: 25, shvetashvatara: 105 };
  for (const [up, n] of Object.entries(floor)) assert.ok(Object.keys(bhashya(up)).length >= n, `${up}: ${Object.keys(bhashya(up)).length} < ${n}`);
  assert.ok(facts.bhashyaVerses >= 1350, String(facts.bhashyaVerses));
  // Śaṅkara wrote no commentary on these two; none may be invented
  assert.equal(Object.keys(bhashya("kaushitaki")).length, 0);
  assert.equal(Object.keys(bhashya("maitri")).length, 0);
  for (const t of index.texts) {
    for (const [vid, b] of Object.entries(bhashya(t.id))) {
      assert.ok(b.text.length >= 25, `${vid}: commentary too short`);
      assert.ok(/^https:\/\/(www\.wisdomlib\.org|archive\.org)\//.test(b.source), `${vid}: source ${b.source}`);
      if (b.source.includes("archive.org")) assert.equal(b.ocr, true, `${vid}: a scan must be marked as one`);
      assert.doesNotMatch(b.text, /Last Updated|Footnotes and references|EIGHT UPANI/, `${vid}: page furniture left in`);
    }
  }
  // the Śvetāśvatara bhāṣya is only attributed to Śaṅkara, and says so
  for (const b of Object.values(bhashya("shvetashvatara"))) assert.match(b.author, /attributed/);
});

test("Hume’s Maitrī fills prapāṭhakas 5–7 and is marked as read from a scan", () => {
  const vs = corpus("maitri");
  const hume = vs.filter((v) => v.tr?.by === "R. E. Hume");
  assert.ok(hume.length >= 54, String(hume.length));
  for (const v of hume) assert.equal(v.tr?.ocr, true, v.id);
  assert.match(vs.find((v) => v.ref === "6.1")!.tr!.text, /twofold/);
  assert.match(vs.find((v) => v.ref === "5.12")!.tr!.text, /Thou art Brahma/);
});

test("passages and commentary load per chapter, never a whole long text at once", () => {
  for (const t of index.texts) {
    for (const dir of ["corpus", "bhashya"]) {
      for (const f of chapters(dir, t.id)) {
        const kb = statSync(join(D, dir, t.id, f)).size / 1024;
        assert.ok(kb < 400, `${dir}/${t.id}/${f}: ${kb.toFixed(0)} KB`);
      }
    }
  }
});

test("the Veda-Sāra layer grew, and every partial quotation names its words", () => {
  assert.ok(facts.vedaSaraLinks >= 60, String(facts.vedaSaraLinks));
  const roots = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "curated", "vedic-roots.json"), "utf8"));
  for (const r of roots.mantraRoots) if (r.kind === "echo") assert.ok(r.kw, `${r.up} → ${r.ext}: an echo needs its keyword`);
});

test("no benchmark model is judged by itself or by its own family", async () => {
  const ix = read<{ bench: { model: string; judgeModel: string }[] }>("runs/index.json");
  const family = (m: string) => m.split("/")[0];
  for (const b of ix.bench) assert.notEqual(family(b.model), family(b.judgeModel), `${b.model} judged by ${b.judgeModel}`);
});
