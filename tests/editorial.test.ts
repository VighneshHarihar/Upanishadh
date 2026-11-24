// The editorial pass: Darśana comparisons, the Prasthānatrayī data, new guided paths, links that never dead-end,
// and recorded runs carried forward to the current corpus only when they re-verify.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { read } from "./helpers.ts";
import { wikisourceUrl, externalUrl } from "../src/lib/config.ts";
import { buildEnglish, buildLexicon, restoreDiacritics } from "../scripts/lib/diacritics.mjs";
import type { Facts } from "../src/lib/core/types.ts";

const facts = read<Facts>("facts.json");

test("twelve landmark passages compare Advaita, Viśiṣṭādvaita and Dvaita, each reading attributed", () => {
  const d = read<{ passages: Record<string, unknown>[] }>("darshanas.json");
  assert.equal(d.passages.length, 12);
  for (const mv of ["ChU_6.8.7", "BU_1.4.10", "AiU_3.1.3", "MaU_2", "IU_1", "IU_15", "KaU_1.2.2", "KaU_1.3.3", "MuU_3.1.1", "BU_2.3.6", "MaU_7"]) assert.ok(d.passages.some((p) => p.verse === mv), mv);
  for (const p of d.passages) for (const s of ["advaita", "vishishtadvaita", "dvaita"]) {
    const r = p[s] as { text: string; source: string };
    assert.ok(r.text.length > 60 && r.source.length > 5, `${p.verse} ${s}`);
  }
});

test("the sheaths and four-states paths exist for the living plates", () => {
  const { paths } = read<{ paths: { id: string; steps: { node: string }[] }[] }>("paths.json");
  const sheaths = paths.find((p) => p.id === "sheaths");
  const states = paths.find((p) => p.id === "four-states");
  assert.deepEqual(sheaths?.steps.slice(0, 5).map((s) => s.node), ["TU_2.1", "TU_2.2", "TU_2.3", "TU_2.4", "TU_2.5"]);
  assert.ok(states?.steps.some((s) => s.node === "MaU_7"));
});

test("Saṃhitā references fall back to Sanskrit Wikisource, never to a dead link", () => {
  assert.equal(decodeURI(wikisourceUrl("RV 1.164.20")!), "https://sa.wikisource.org/wiki/ऋग्वेदः_सूक्तं_१.१६४");
  assert.equal(decodeURI(wikisourceUrl("YV 40.1")!), "https://sa.wikisource.org/wiki/शुक्लयजुर्वेदः/अध्यायः_४०");
  // with NEXT_PUBLIC_VEDANVAYA_URL unset, a VedAnvaya-sited reference resolves to Wikisource
  assert.match(decodeURI(externalUrl({ site: "vedanvaya", path: "/passage/RV%201.164.20", label: "RV 1.164.20" })!), /sa\.wikisource\.org\/wiki\/ऋग्वेदः/);
});

test("every recorded run is stamped with the current corpus fingerprint", () => {
  const dir = join(import.meta.dirname, "..", "public", "data", "runs");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "index.json")) {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
    assert.equal(r.corpusHash, facts.corpusHash, f);
  }
});

test("diacritic repair restores Sanskrit words and leaves English alone", () => {
  const lex = buildLexicon(["ātmānam ātmānam upaniṣad upaniṣad upaniṣad viṣṇuḥ viṣṇu viṣṇu ṛte ṛte"]);
  const en = buildEnglish(["the rite of the same rite is the same"]);
  const r = restoreDiacritics("the atmanam of the Upanisad and Visnu, the rite is the same", lex, en);
  assert.equal(r.text, "the ātmānam of the Upaniṣad and Viṣṇu, the rite is the same");
});
