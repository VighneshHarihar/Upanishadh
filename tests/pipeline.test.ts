// The whole harness with a scripted transport: no network, every failure path exercised. Three conditions
// (baseline, honesty control, UpaSārathi) and a blind judge over A, B and C.
import { test } from "node:test";
import assert from "node:assert/strict";
import { E, ci, rubric } from "./helpers.ts";
import { runHarness, type Transport } from "../src/lib/core/pipeline.ts";
import { LlmError, type LlmRequest } from "../src/lib/core/llm.ts";

const models = { provider: "groq" as const, model: "test-20b", judgeProvider: "groq" as const, judgeModel: "test-120b" };
const PROMPT = rubric.presets.find((p) => p.id === "scripture-quote")!.prompt;
const CONTROL_ANSWER = "A plain, honest answer without any quotation.";

type Kind = "baseline" | "control" | "realigned" | "judge";
const kindOf = (req: LlmRequest): Kind =>
  req.model === models.judgeModel ? "judge" : req.messages[0].content === rubric.baselineSystem ? "baseline" : req.messages[0].content === rubric.controlSystem ? "control" : "realigned";

function scripted(handlers: { baseline?: () => string; control?: () => string; realigned?: (n: number, req: LlmRequest) => string; judge?: (req: LlmRequest) => string }): Transport & { calls: Kind[] } {
  let realignedCalls = 0;
  const calls: Kind[] = [];
  return {
    calls,
    async complete(req) {
      const kind = kindOf(req);
      calls.push(kind);
      const text =
        kind === "baseline" ? handlers.baseline!() : kind === "control" ? (handlers.control ?? (() => CONTROL_ANSWER))() : kind === "realigned" ? handlers.realigned!(++realignedCalls, req) : handlers.judge!(req);
      return { text, model: req.model, ms: 5, finish: "stop", usage: { in: 100, out: 20 } };
    },
  };
}
const LETTERS = ["A", "B", "C"] as const;
const SCORE = { good: 4, ok: 2, bad: 0 } as const;
/** A judge that reads the three answers it was shown and scores each by `pick`, quoting it verbatim. */
function judgeFor(req: LlmRequest, pick: (answer: string) => keyof typeof SCORE) {
  const body = req.messages[1].content;
  const answer = (L: string) => body.split(`RESPONSE ${L}:\n<<<`)[1].split(">>>")[0];
  const picks = LETTERS.map((L) => pick(answer(L)));
  return JSON.stringify({
    scores: Object.fromEntries(rubric.axes.map((a) => [a.id, Object.fromEntries(LETTERS.map((L, i) => [L, { score: SCORE[picks[i]], evidence: answer(L).slice(0, 30) }]))])),
    verdict: LETTERS[picks.indexOf("good")] ?? "tie",
    summary: "test",
  });
}

test("a fabricated baseline, an honest control, a repaired UpaSārathi answer and a blind verdict", async () => {
  const goodAnswer = "There is no such verse. The Kaṭha says the opposite [KaU 1.1.27]: a person is not satisfied by wealth.";
  const t = scripted({
    baseline: () => "रजः धनः सर्वधनानां श्रेष्ठः (कथोपनिषद् ४.११)",
    realigned: (n) => (n === 1 ? "Wealth is not the goal [MaU 7]. Would you like me to find more quotes?" : goodAnswer),
    judge: (req) => judgeFor(req, (a) => (a.startsWith("There is no") ? "good" : a.startsWith("A plain") ? "ok" : "bad")),
  });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(run.status, "complete");
  assert.equal(run.v, 2);
  assert.equal(run.checks.baseline.unverifiedQuotes, 1);
  assert.equal(run.checks.control.unverifiedQuotes, 0);
  assert.equal(run.control_.text, CONTROL_ANSWER);
  assert.equal(run.realigned.repaired, true);
  assert.equal(run.realigned.text, goodAnswer);
  assert.deepEqual(run.realigned.citations.map((c) => c.id), ["KaU_1.1.27"]);
  assert.equal(run.judge.status, "ok");
  assert.equal(run.judge.verdict, "realigned");
  assert.equal(run.judge.totals.realigned, rubric.axes.length * 4);
  assert.equal(run.judge.totals.control, rubric.axes.length * 2);
  assert.equal(run.judge.totals.baseline, 0);
  assert.equal(run.models.sameJudge, false);
  assert.equal(t.calls.filter((c) => c === "realigned").length, 2);
  assert.equal(t.calls.filter((c) => c === "control").length, 1);
  // Token accounting: baseline, control, UpaSārathi twice (repair) and the judge, 100 in / 20 out each.
  assert.deepEqual(run.tokens, { in: 500, out: 100 });
});

test("the honesty control prompt carries no scripture", () => {
  assert.doesNotMatch(rubric.controlSystem, /upani|veda|gīt|git[aā]|śaṅkara|shankara|brahman|ātman|atman|sanskrit|scripture/i);
});

test("a multi-turn preset sends the follow-up to every condition and keeps the first answer", async () => {
  const preset = rubric.presets.find((p) => p.followUp)!;
  const seen: Kind[] = [];
  const t: Transport = {
    async complete(req) {
      const kind = kindOf(req);
      if (kind !== "judge" && req.messages.some((m) => m.role === "user" && m.content === preset.followUp)) seen.push(kind);
      const first = !req.messages.some((m) => m.role === "assistant");
      const text = kind === "judge" ? judgeFor(req, () => "ok") : kind === "realigned" ? (first ? "First [KaU 1.2.2]." : "Still no [KaU 1.2.2].") : first ? "First answer." : "Second answer.";
      return { text, model: req.model, ms: 3, finish: "stop" };
    },
  };
  const run = await runHarness(E, ci, t, models, preset.prompt, { preset });
  assert.equal(run.followUp, preset.followUp);
  assert.deepEqual([...new Set(seen)].sort(), ["baseline", "control", "realigned"]);
  assert.equal(run.baseline.first, "First answer.");
  assert.equal(run.baseline.text, "Second answer.");
});

test("citations that survive the repair outside the packet are stripped, not shown", async () => {
  const t = scripted({ baseline: () => "Here is a fine answer.", realigned: () => "Truth wins [MuU 3.1.6] and [MaU 7].", judge: (req) => judgeFor(req, () => "good") });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.deepEqual(run.realigned.stripped, ["[MaU 7]"]);
  assert.doesNotMatch(run.realigned.text, /2\.3\.10/);
});

test("a daily quota and an empty answer become explicit stage errors; the judge is skipped", async () => {
  const t: Transport = {
    async complete(req) {
      if (req.messages[0].content === rubric.baselineSystem) throw new LlmError("rate-daily", "Daily limit reached", 429);
      throw new LlmError("empty", "The model used its whole token budget (likely on reasoning) and returned no answer.");
    },
  };
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(run.status, "partial");
  assert.equal(run.baseline.error?.code, "rate-daily");
  assert.equal(run.control_.error?.code, "empty");
  assert.equal(run.realigned.error?.code, "empty");
  assert.equal(run.judge.status, "skipped");
});

test("judge JSON failures are retried once, then reported as unavailable rather than invented", async () => {
  let judgeCalls = 0;
  const t = scripted({ baseline: () => "Fine.", realigned: () => "Fine [MuU 3.1.6].", judge: () => { judgeCalls++; return "I think B is better."; } });
  const run = await runHarness(E, ci, t, models, PROMPT);
  assert.equal(judgeCalls, 2);
  assert.equal(run.judge.status, "unavailable");
  assert.deepEqual(run.judge.scores, {});
  assert.equal(run.status, "partial");
});

test("same-model judging is detected and labelled", async () => {
  const same = { ...models, judgeModel: models.model };
  const t: Transport = { async complete(req) { return { text: req.messages[0].content === rubric.baselineSystem ? "ok" : "ok [MuU 3.1.6]", model: req.model, ms: 1, finish: "stop" }; } };
  const run = await runHarness(E, ci, t, same, PROMPT);
  assert.equal(run.models.sameJudge, true);
  assert.equal(run.judge.sameModel, true);
});

test("crisis language asks no model at all", async () => {
  let calls = 0;
  const t: Transport = { async complete() { calls++; return { text: "", model: "", ms: 0, finish: null }; } };
  const run = await runHarness(E, ci, t, models, "I want to end my life");
  assert.equal(run.status, "crisis");
  assert.equal(calls, 0);
});
