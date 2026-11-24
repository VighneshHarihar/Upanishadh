// The word layer covers every passage: the primary source's analysis where it has one, else the overlay
// (data/corpus/<id>/words.json from npm run data:words): DCS gold annotation, or automatic analysis marked as such.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { devaToIast } from "../src/lib/core/text.ts";
// @ts-expect-error: plain ESM script without type declarations
import { withWordOverlay } from "../scripts/lib/word-overlay.mjs";

type Word = [string, string, string, string];
type Verse = { id: string; ref: string; shanti?: boolean; words?: Word[] };
type Overlay = { note: string; src: Record<string, "dcs" | "auto">; words: Record<string, Word[]> };

const CORPUS = join(import.meta.dirname, "..", "data", "corpus");
const texts = readdirSync(CORPUS).filter((d) => existsSync(join(CORPUS, d, "verses.json")));
const json = <T,>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const versesOf = (id: string) => json<Verse[]>(join(CORPUS, id, "verses.json"));
const overlayOf = (id: string): Overlay | null => (existsSync(join(CORPUS, id, "words.json")) ? json<Overlay>(join(CORPUS, id, "words.json")) : null);
const IAST = /^[a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]+$/;

test("every non-śānti passage of the thirteen Upanishads has a word-by-word analysis", () => {
  const missing: string[] = [];
  let total = 0;
  for (const id of texts) {
    const o = overlayOf(id);
    for (const v of versesOf(id)) {
      if (v.shanti) continue;
      total++;
      if (!v.words?.length && !o?.words[v.id]?.length) missing.push(v.id);
    }
  }
  assert.equal(total, 1693);
  assert.deepEqual(missing, []);
});

test("the overlay only fills passages the primary source left empty, and says where each analysis came from", () => {
  for (const id of texts) {
    const o = overlayOf(id);
    if (!o) continue;
    const byId = new Map(versesOf(id).map((v) => [v.id, v]));
    for (const [vid, ws] of Object.entries(o.words)) {
      const v = byId.get(vid);
      assert.ok(v, `${vid} is not in the corpus`);
      assert.ok(!v.shanti, `${vid} is a śānti passage`);
      assert.equal(v.words?.length ?? 0, 0, `${vid} already has the primary source's analysis`);
      assert.ok(ws.length > 0, `${vid} has an empty analysis`);
      assert.ok(o.src[vid] === "dcs" || o.src[vid] === "auto", `${vid} has no provenance`);
    }
    assert.deepEqual(Object.keys(o.src).sort(), Object.keys(o.words).sort());
  }
});

test("overlay words have the primary source's shape: Devanagari, IAST, gloss, lemma", () => {
  for (const id of texts) {
    const o = overlayOf(id);
    if (!o) continue;
    for (const [vid, ws] of Object.entries(o.words))
      for (const w of ws) {
        assert.equal(w.length, 4, `${vid}: ${JSON.stringify(w)}`);
        assert.ok(w.every((x) => typeof x === "string"), `${vid}: ${JSON.stringify(w)}`);
        assert.match(w[1], IAST, `${vid}: form ${w[1]}`);
        assert.match(w[0], /^[ऀ-ॿ]+$/, `${vid}: Devanagari ${w[0]}`);
        assert.equal(devaToIast(w[0]), w[1], `${vid}: ${w[0]} does not transliterate back to ${w[1]}`);
        assert.ok(w[3] === "" || /^√?[a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]+$/.test(w[3]), `${vid}: lemma ${w[3]}`);
      }
  }
});

test("the gold DCS annotation covers the Chāndogya, Bṛhadāraṇyaka and Śvetāśvatara; the Maitrī is automatic", () => {
  const count = (id: string, src: string) => Object.values(overlayOf(id)?.src ?? {}).filter((s) => s === src).length;
  assert.ok(count("brihadaranyaka", "dcs") >= 170);
  assert.ok(count("chandogya", "dcs") >= 250);
  assert.ok(count("shvetashvatara", "dcs") >= 80);
  assert.equal(count("maitri", "auto"), 88);
});

test("merging keeps the primary source's analysis and fills only empty passages", async () => {
  const dir = join(CORPUS, "chandogya");
  const verses = versesOf("chandogya");
  const merged = (await withWordOverlay(dir, verses)) as Verse[];
  const o = overlayOf("chandogya")!;
  verses.forEach((v, i) => {
    if (v.words?.length) assert.deepEqual(merged[i].words, v.words);
    else if (o.words[v.id]) assert.deepEqual(merged[i].words, o.words[v.id]);
  });
  assert.equal(merged.filter((v) => !v.shanti && !v.words?.length).length, 0);
});
