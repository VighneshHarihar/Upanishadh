// The blind judge: three answers in a hashed order, strict JSON, verbatim evidence or the score is dropped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rubric } from "./helpers.ts";
import { evidenceOccurs, judgeOrder, parseJudge, resolveJudge, SIDES, type Side } from "../src/lib/core/judge.ts";

const ids = rubric.axes.map((a) => a.id);
/** A judge reply scoring letters A, B, C with the given evidence and scores. */
const raw = (ev: [string, string, string], scores: [number, number, number] = [1, 2, 4], verdict = "C") =>
  JSON.stringify({
    scores: Object.fromEntries(ids.map((id) => [id, Object.fromEntries(["A", "B", "C"].map((L, i) => [L, { score: scores[i], evidence: ev[i] }]))])),
    verdict,
    summary: "ok",
  });

test("evidence must occur verbatim; quotation marks and end punctuation are tolerated", () => {
  const text = "Your idea taps a growing appetite for instant, personalized guidance, and the rest.";
  assert.equal(evidenceOccurs("\"Your idea taps a growing appetite for instant, personalized guidance.\"", text), true);
  assert.equal(evidenceOccurs("taps a growing … personalized guidance", text), true);
  assert.equal(evidenceOccurs("Your idea is certain to become a unicorn", text), false);
});

test("judge JSON is validated axis by axis, for all three letters", () => {
  assert.throws(() => parseJudge("not json", ids), /no JSON/);
  assert.throws(() => parseJudge(JSON.stringify({ scores: {} }), ids), /missing axis/);
  const two = JSON.stringify({ scores: Object.fromEntries(ids.map((id) => [id, { A: { score: 1, evidence: "a" }, B: { score: 2, evidence: "b" } }])), verdict: "B" });
  assert.throws(() => parseJudge(two, ids), /malformed/);
  assert.doesNotThrow(() => parseJudge(`Here you go: ${raw(["x", "y", "z"])}`, ids));
});

test("the order is a deterministic permutation of the three conditions, undone when scoring", () => {
  const order = judgeOrder("some prompt");
  assert.deepEqual(order, judgeOrder("some prompt"));
  assert.deepEqual([...order].sort(), [...SIDES].sort());
  const texts: Record<Side, string> = { baseline: "baseline says this exactly", control: "control says so plainly", realigned: "realigned says that exactly" };
  // The judge gives letter C (whatever condition sits there) the top score.
  const r = resolveJudge(parseJudge(raw([texts[order[0]], texts[order[1]], texts[order[2]]]), ids), rubric, order, texts);
  assert.equal(r.verdict, order[2]);
  assert.equal(r.totals[order[2]], ids.length * 4);
  assert.equal(r.totals[order[0]], ids.length * 1);
  assert.equal(r.comparableAxes, ids.length);
  // Different prompts do not all share one order: position bias is spread across conditions.
  const seen = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map((p) => judgeOrder(`prompt ${p}`).join(",")));
  assert.ok(seen.size >= 3);
});

test("scores with invented evidence are discarded and totals stay comparable across all three", () => {
  const order: Side[] = ["baseline", "control", "realigned"];
  const texts: Record<Side, string> = { baseline: "only this text", control: "a plain honest answer", realigned: "and this one" };
  const r = resolveJudge(parseJudge(raw(["only this text", "a plain honest answer", "words that were never written"]), ids), rubric, order, texts);
  assert.equal(r.rejectedEvidence, ids.length);
  // One side lost its evidence on every axis, so no axis is comparable and no total may favour anyone.
  assert.equal(r.comparableAxes, 0);
  assert.equal(r.max, 0);
  for (const s of SIDES) assert.equal(r.totals[s], 0);
});

test("a missing verdict is derived from the totals and marked as derived", () => {
  const order: Side[] = ["baseline", "control", "realigned"];
  const texts: Record<Side, string> = { baseline: "aaa bbb", control: "eee fff", realigned: "ccc ddd" };
  const r = resolveJudge(parseJudge(raw(["aaa bbb", "eee fff", "ccc ddd"], [1, 2, 4], ""), ids), rubric, order, texts);
  assert.equal(r.verdict, "realigned");
  assert.equal(r.verdictDerived, true);
});
