// Phase 0 lessons: per-minute vs daily rate limits, empty answers, reasoning-token headroom.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatBody, classifyHttp, readCompletion, withRateRetry, LlmError, REASONING_MIN_TOKENS } from "../src/lib/core/llm.ts";

const groq = (msg: string) => JSON.stringify({ error: { message: msg } });

test("a per-minute 429 is retryable, with the provider's wait time", () => {
  const e = classifyHttp(429, groq("Rate limit reached for model `openai/gpt-oss-20b` on tokens per minute (TPM): Limit 8000. Please try again in 2.35s."));
  assert.equal(e.code, "rate-minute");
  assert.equal(e.retryAfterMs, 2350);
  assert.equal(classifyHttp(429, "{}", "7").retryAfterMs, 7000);
});

test("a daily quota stops cleanly instead of retrying", async () => {
  const e = classifyHttp(429, groq("Rate limit reached on requests per day (RPD): Limit 1000, Used 1000."));
  assert.equal(e.code, "rate-daily");
  let calls = 0;
  await assert.rejects(withRateRetry(async () => { calls++; throw e; }), (x: LlmError) => x.code === "rate-daily");
  assert.equal(calls, 1);
});

test("per-minute limits are retried, then succeed", async () => {
  let calls = 0;
  const v = await withRateRetry(async () => {
    calls++;
    if (calls < 2) throw new LlmError("rate-minute", "wait", 429, 5);
    return "ok";
  });
  assert.equal(v, "ok");
  assert.equal(calls, 2);
});

test("an empty completion is an explicit error, with the reason when the budget ran out", () => {
  assert.throws(() => readCompletion({ choices: [{ message: { content: "" }, finish_reason: "length" }] }, "m", 1), (e: LlmError) => e.code === "empty" && /budget/.test(e.message));
  assert.equal(readCompletion({ choices: [{ message: { content: " hi " }, finish_reason: "stop" }] }, "m", 1).text, "hi");
});

test("reasoning models get token headroom; JSON mode only where supported", () => {
  const b = chatBody({ provider: "groq", model: "openai/gpt-oss-20b", messages: [], maxTokens: 300, json: true, reasoning: "low" });
  assert.equal(b.max_tokens, REASONING_MIN_TOKENS);
  assert.deepEqual(b.response_format, { type: "json_object" });
  assert.equal(b.reasoning_effort, "low");
  const o = chatBody({ provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", messages: [], maxTokens: 300, json: true });
  assert.equal(o.max_tokens, 300);
  assert.equal(o.response_format, undefined);
});

test("auth and model errors are named", () => {
  assert.equal(classifyHttp(401, "{}").code, "auth");
  assert.equal(classifyHttp(404, groq("The model `x` does not exist")).code, "model");
});
