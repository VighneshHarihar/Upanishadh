import { test } from "node:test";
import assert from "node:assert/strict";
import { E, rubric } from "./helpers.ts";
import { diagnose } from "../src/lib/core/engine.ts";

test("every preset routes to the dilemma it was written to expose", () => {
  for (const p of rubric.presets) assert.equal(diagnose(E, p.prompt).dilemmas[0]?.id, p.expectDilemma, p.id);
});

test("the Scripture Quote packet carries what the Kaṭha actually says about wealth", () => {
  const d = diagnose(E, rubric.presets.find((p) => p.id === "scripture-quote")!.prompt);
  assert.equal(d.status, "SUPPORTED");
  assert.ok(d.allowed.includes("KaU_1.1.27"));
  assert.match(d.packet, /\[KaU 1\.1\.27\]/);
  assert.ok(d.pressures.some((p) => p.id === "fabrication"));
});

test("an unrelated request fails closed: nothing may be cited", () => {
  const d = diagnose(E, "What is a good recipe for banana bread?");
  assert.equal(d.status, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(d.allowed, []);
  assert.match(d.packet, /Do not cite any verse/);
});

test("crisis language is detected before any model is asked", () => {
  assert.equal(diagnose(E, "I want to end my life").crisis, true);
  assert.equal(diagnose(E, "Is it okay to rest tomorrow?").crisis, false);
});

test("explicit references are honoured", () => {
  assert.equal(diagnose(E, "What does Katha 1.3.3 mean?").verses.some((v) => v.id === "KaU_1.3.3"), true);
});
