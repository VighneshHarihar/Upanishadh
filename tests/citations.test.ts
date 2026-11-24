import { test } from "node:test";
import assert from "node:assert/strict";
import { kb } from "./helpers.ts";
import { extractCitations, splitCombined, stripCitations } from "../src/lib/core/citations.ts";

const AB = kb.texts.map((t) => t.abbrev);

test("verse, concept and story citations resolve to graph ids", () => {
  const c = extractCitations(kb, "As [KaU 1.2.2] says, choose [Concept: Śreyas]; see [Story: Indra and Virocana].");
  assert.deepEqual(c.map((x) => x.id), ["KaU_1.2.2", "concept:shreyas", "story:indra-virocana"]);
});

test("citations outside the evidence packet are marked and can be stripped", () => {
  const text = "Truth wins [MuU 3.1.6], and also [MaU 7], and [KaU 9.9.9].";
  const c = extractCitations(kb, text, new Set(["MuU_3.1.6"]));
  assert.deepEqual(c.map((x) => [x.id, x.allowed]), [["MuU_3.1.6", true], ["MaU_7", false], [null, false]]);
  const out = stripCitations(text, c.filter((x) => !x.allowed));
  assert.equal(out, "Truth wins [MuU 3.1.6], and also, and.");
});

test("combined brackets are split only when every part is a citation", () => {
  assert.equal(splitCombined("yours [KaU 1.3.3, Concept: Buddhi as sārathi].", AB), "yours [KaU 1.3.3] [Concept: Buddhi as sārathi].");
  assert.equal(splitCombined("[KaU 1.2.2; KaU 1.2.3]", AB), "[KaU 1.2.2] [KaU 1.2.3]");
  assert.equal(splitCombined("keep [this, that]", AB), "keep [this, that]");
});
