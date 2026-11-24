// The chat-with-the-graph retrieval, the multi-provider adapters (Claude through the official SDK, OpenAI reasoning
// models), and the downloadable harness's report and arguments.
import { test } from "node:test";
import assert from "node:assert/strict";
import { E } from "./helpers.ts";
import { askNames, askRetrieve, askThemes, auditAnswer, composeOfflineAnswer } from "../src/lib/core/ask.ts";
import { claudeParams, complete } from "../src/lib/core/complete.ts";
import { chatBody, LlmError, needsKey, PROVIDER_ORDER, PROVIDERS } from "../src/lib/core/llm.ts";
import { md } from "../harness/report.ts";
import { parseArgs } from "../harness/args.ts";

// ── Ask: everyday questions reach the ideas that answer them ──
test("a plain-language life question finds the Kaṭha's two roads", () => {
  const d = askRetrieve(E, "I was offered a job that pays double but I would stop doing work I care about");
  assert.notEqual(d.status, "INSUFFICIENT_EVIDENCE");
  assert.ok(d.verses.some((v) => v.id === "KaU_1.2.2"), d.verses.map((v) => v.id).join(","));
  assert.ok(d.concepts.some((c) => c.id === "concept:shreyas"));
});

test("naming a person leads to their story", () => {
  assert.deepEqual(askNames(E, "Why did Virocana leave satisfied?").map((x) => x.id), ["story:indra-virocana"]);
  const d = askRetrieve(E, "Why did Virocana leave satisfied and Indra return?");
  assert.ok(d.stories.some((s) => s.id === "story:indra-virocana"));
  assert.ok(d.verses.some((v) => v.id.startsWith("ChU_8.")));
});

test("'who am I' is about the Self, not about the job it mentions", () => {
  const ids = askThemes("Who am I, if not my body, my mind or my job?").map((t) => t.id);
  assert.ok(ids.includes("concept:atman"));
  assert.ok(!ids.includes("concept:preyas"));
});

test("an unrelated question still fails closed", () => {
  const d = askRetrieve(E, "how do I bake sourdough bread");
  assert.equal(d.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(d.verses.length, 0);
  assert.match(composeOfflineAnswer(E, d), /could not find/);
});

test("every theme points at a node that exists in the graph", () => {
  const all = askThemes("money choose fear who am i anger desire phone happy truth teacher knowledge pride sleep god witness give discipline love chariot");
  assert.ok(all.length > 0);
  for (const t of askThemes("money")) assert.ok(E.gi.nodes.has(t.id), t.id);
  const every = ["concept:shreyas", "concept:preyas", "story:naciketas", "concept:viveka", "concept:atman", "story:indra-virocana", "concept:sakshin", "concept:kama", "concept:da", "concept:indriya", "concept:buddhi-sarathi", "concept:pratyak", "concept:bhuman", "concept:satya", "concept:anrta", "concept:acarya", "concept:svadhyaya", "story:satyakama", "concept:vidya", "concept:avidya", "concept:avijnata", "concept:abhimana", "story:shvetaketu", "concept:turiya", "concept:brahman", "concept:bhoktr", "concept:tapas", "story:maitreyi"];
  for (const id of every) assert.ok(E.gi.nodes.has(id), id);
});

test("the offline answer cites only what the packet allows, and the audit keeps it that way", () => {
  const d = askRetrieve(E, "What is the difference between śreyas and preyas?");
  const a = auditAnswer(E, composeOfflineAnswer(E, d), d);
  assert.ok(a.citations.length >= 2);
  assert.equal(a.stripped.length, 0);
  const forged = auditAnswer(E, `${a.text} See also [MuU 3.1.1].`, d);
  assert.ok(d.allowed.includes("MuU_3.1.1") || forged.stripped.includes("[MuU 3.1.1]"));
});

// ── Providers ──
test("seven providers; only local and self-hosted ones may go without a key", () => {
  assert.deepEqual(PROVIDER_ORDER, ["anthropic", "openai", "gemini", "groq", "openrouter", "ollama", "compatible"]);
  assert.equal(needsKey("ollama"), false);
  assert.equal(needsKey("compatible"), false);
  for (const p of PROVIDER_ORDER.filter(needsKey)) assert.ok(PROVIDERS[p].envKey, p);
});

test("Claude requests: no sampling parameters, effort when asked, refusal fallback on supported models", () => {
  const p = claudeParams({ provider: "anthropic", model: "claude-opus-5-5", temperature: 0.3, reasoning: "low", messages: [{ role: "system", content: "S" }, { role: "user", content: "Q" }] });
  assert.equal(p.system, "S");
  assert.deepEqual(p.messages, [{ role: "user", content: "Q" }]);
  assert.equal("temperature" in p, false);
  assert.deepEqual(p.output_config, { effort: "low" });
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  const haiku = claudeParams({ provider: "anthropic", model: "claude-haiku-5-5", messages: [{ role: "user", content: "Q" }] });
  assert.equal("fallbacks" in haiku, false);
});

const claudeReply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });

test("Claude through the SDK: text comes back, the request carries the key and the fallback beta", async () => {
  let seen: { url: string; headers: Headers; body: Record<string, unknown> } | null = null;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = { url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
    return claudeReply({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 3, output_tokens: 1 } });
  }) as typeof fetch;
  const r = await complete({ provider: "anthropic", model: "claude-opus-5-5", messages: [{ role: "user", content: "Say OK" }] }, { key: "sk-ant-test", fetchImpl });
  assert.equal(r.text, "OK");
  assert.equal(r.model, "claude-opus-5-5");
  assert.ok(seen);
  const s = seen as { url: string; headers: Headers; body: Record<string, unknown> };
  assert.match(s.url, /\/v1\/messages/);
  assert.equal(s.headers.get("authorization") ?? s.headers.get("x-api-key"), s.headers.get("authorization") ? "Bearer sk-ant-test" : "sk-ant-test");
  assert.match(s.headers.get("anthropic-beta") ?? "", /server-side-fallback-2026-07-01/);
  assert.equal(s.body.fallbacks, "default");
});

test("Claude: a refusal is reported as a refusal, never shown as an answer", async () => {
  const fetchImpl = (async () => claudeReply({ id: "msg_2", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: "refusal", stop_sequence: null, usage: { input_tokens: 3, output_tokens: 0 } })) as unknown as typeof fetch;
  await assert.rejects(complete({ provider: "anthropic", model: "claude-opus-5-5", messages: [{ role: "user", content: "x" }] }, { key: "k", fetchImpl }), (e: LlmError) => e.code === "refusal");
});

test("Claude: a bad key and a spend limit map to the harness's error codes", async () => {
  const auth = (async () => claudeReply({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401)) as unknown as typeof fetch;
  await assert.rejects(complete({ provider: "anthropic", model: "claude-sonnet-5-5", messages: [{ role: "user", content: "x" }] }, { key: "bad", fetchImpl: auth }), (e: LlmError) => e.code === "auth");
  const spend = (async () => claudeReply({ type: "error", error: { type: "rate_limit_error", message: "enforced_spend_limit reached" } }, 429)) as unknown as typeof fetch;
  await assert.rejects(complete({ provider: "anthropic", model: "claude-sonnet-5-5", messages: [{ role: "user", content: "x" }] }, { key: "k", fetchImpl: spend }), (e: LlmError) => e.code === "rate-daily");
});

test("OpenAI reasoning models get max_completion_tokens and no temperature; chat models keep both", () => {
  const r = chatBody({ provider: "openai", model: "gpt-5", messages: [], maxTokens: 300, temperature: 0.2, reasoning: "low" });
  assert.equal(r.max_tokens, undefined);
  assert.ok((r.max_completion_tokens as number) >= 300);
  assert.equal("temperature" in r, false);
  assert.equal(r.reasoning_effort, "low");
  const c = chatBody({ provider: "openai", model: "gpt-4o-mini", messages: [], maxTokens: 300, temperature: 0.2 });
  assert.equal(c.max_tokens, 300);
  assert.equal(c.temperature, 0.2);
});

test("OpenAI-compatible endpoints: a base URL is required, and the request goes there", async () => {
  await assert.rejects(complete({ provider: "compatible", model: "m", messages: [{ role: "user", content: "x" }] }, {}), (e: LlmError) => e.code === "bad-request");
  let url = "";
  const fetchImpl = (async (u: string | URL | Request) => {
    url = String(u);
    return new Response(JSON.stringify({ model: "m", choices: [{ message: { content: "hi" }, finish_reason: "stop" }] }), { status: 200 });
  }) as typeof fetch;
  const r = await complete({ provider: "compatible", model: "m", messages: [{ role: "user", content: "x" }] }, { baseUrl: "https://llm.example/v1/", fetchImpl });
  assert.equal(r.text, "hi");
  assert.equal(url, "https://llm.example/v1/chat/completions");
});

// ── The downloadable harness ──
test("report markdown escapes model output (no HTML injection) and keeps citations", () => {
  const html = md('**Bold** and <script>alert(1)</script> [KaU 1.2.2]\n- one\n- two');
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<b>Bold</b>"));
  assert.ok(html.includes('<span class="cite">KaU 1.2.2</span>'));
  assert.ok(html.includes("<ul><li>one</li><li>two</li></ul>"));
});

test("harness arguments: positionals, values, = values and flags", () => {
  const { pos, opt } = parseArgs(["run", "Back me up", "--provider", "openai", "--model=gpt-4o", "--json", "--judge-model", "gpt-4o-mini", "-h"]);
  assert.deepEqual(pos, ["run", "Back me up"]);
  assert.equal(opt.provider, "openai");
  assert.equal(opt.model, "gpt-4o");
  assert.equal(opt.json, true);
  assert.equal(opt["judge-model"], "gpt-4o-mini");
  assert.equal(opt.help, true);
});
