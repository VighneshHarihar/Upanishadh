// Server-side completion for every provider: the edge relay (/api/llm) and the downloadable harness use this.
// Claude goes through the official Anthropic SDK; every other provider speaks OpenAI chat-completions over fetch.
// Not imported by browser code (the browser always talks to /api/llm).
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDERS, LlmError, chatBody, classifyHttp, emptyError, readCompletion, sseDeltas, stripThinking, type LlmRequest, type LlmResult, type ProviderId } from "./llm.ts";

export interface CompleteOptions {
  key?: string | null;
  /** Base URL for Ollama or an OpenAI-compatible endpoint. */
  baseUrl?: string | null;
  onToken?: (delta: string, full: string) => void;
  signal?: AbortSignal;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
}

export async function complete(req: LlmRequest, opts: CompleteOptions = {}): Promise<LlmResult> {
  return PROVIDERS[req.provider].kind === "anthropic" ? completeClaude(req, opts) : completeOpenAI(req, opts);
}

export function baseFor(provider: ProviderId, baseUrl?: string | null): string {
  const p = PROVIDERS[provider];
  if (provider === "ollama") return `${(baseUrl || "http://localhost:11434").replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
  if (provider === "compatible") {
    if (!baseUrl) throw new LlmError("bad-request", "An OpenAI-compatible provider needs a base URL.", 400);
    return baseUrl.replace(/\/+$/, "");
  }
  return p.base;
}

// ── OpenAI-compatible (OpenAI, Gemini, Groq, OpenRouter, Ollama, any compatible endpoint) ──────────────
async function completeOpenAI(req: LlmRequest, o: CompleteOptions): Promise<LlmResult> {
  const f = o.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(o.key ? { Authorization: `Bearer ${o.key}` } : {}) };
  if (req.provider === "openrouter") Object.assign(headers, { "HTTP-Referer": "https://github.com/upasarathi", "X-Title": "UpaSarathi" });
  const url = `${baseFor(req.provider, o.baseUrl)}/chat/completions`; // a missing base URL is a bad request, not a network failure
  const t0 = Date.now();
  let res: Response;
  try {
    res = await f(url, { method: "POST", headers, body: JSON.stringify(chatBody(req)), signal: o.signal });
  } catch (e) {
    throw new LlmError("network", (e as Error).message);
  }
  if (!res.ok) throw classifyHttp(res.status, await res.text(), res.headers.get("retry-after"));
  if (!req.stream || !res.body) return readCompletion(await res.json(), req.model, Date.now() - t0);
  let text = "";
  let finish: string | null = null;
  let usage: { in: number; out: number } | undefined;
  for await (const d of sseDeltas(res.body)) {
    if (d.delta) {
      text += d.delta;
      o.onToken?.(d.delta, stripThinking(text));
    }
    if (d.finish) finish = d.finish;
    if (d.usage) usage = d.usage;
  }
  const clean = stripThinking(text);
  if (!clean) throw emptyError(finish);
  return { text: clean, model: req.model, ms: Date.now() - t0, finish, ...(usage ? { usage } : {}) };
}

// ── Claude (Anthropic SDK) ─────────────────────────────────────────────────────────────────────────────
/** Models that accept output_config.effort. */
const CLAUDE_EFFORT = /claude-(fable|mythos|opus-5|opus-4-[5-8]|sonnet-5|sonnet-4-6|haiku-5)/;
/** Models where server-side refusal fallbacks are available in the "default" form. */
const CLAUDE_FALLBACK = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-mythos-5-2", "claude-mythos-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function claudeParams(req: LlmRequest): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // Sampling parameters are not sent: current Claude models reject non-default temperature. Thinking is left at the
  // model default (adaptive on current models); depth is steered with effort when the caller asks for it.
  return {
    model: req.model,
    max_tokens: req.stream ? 32000 : 16000,
    ...(system ? { system } : {}),
    messages,
    ...(req.reasoning && CLAUDE_EFFORT.test(req.model) ? { output_config: { effort: req.reasoning } } : {}),
    ...(CLAUDE_FALLBACK.has(req.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };
}

async function completeClaude(req: LlmRequest, o: CompleteOptions): Promise<LlmResult> {
  if (!o.key) throw new LlmError("no-key", "No Claude API key.");
  const client = new Anthropic({ apiKey: o.key, maxRetries: 0, ...(o.fetchImpl ? { fetch: o.fetchImpl } : {}) });
  const params = claudeParams(req);
  const t0 = Date.now();
  try {
    let message: Anthropic.Beta.BetaMessage;
    if (req.stream) {
      const stream = client.beta.messages.stream(params, { signal: o.signal });
      let full = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          full += event.delta.text;
          o.onToken?.(event.delta.text, full);
        }
      }
      message = await stream.finalMessage();
    } else {
      message = await client.beta.messages.create(params, { signal: o.signal });
    }
    // A safety decline is an answer of its own kind: report it, never present it as model text.
    if (message.stop_reason === "refusal") {
      const cat = message.stop_details && "category" in message.stop_details ? message.stop_details.category : null;
      throw new LlmError("refusal", `Claude declined this request${cat ? ` (${cat})` : ""}.`);
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw emptyError(message.stop_reason ?? null);
    return { text, model: message.model, ms: Date.now() - t0, finish: message.stop_reason ?? null, usage: { in: message.usage?.input_tokens ?? 0, out: message.usage?.output_tokens ?? 0 } };
  } catch (e) {
    throw claudeError(e);
  }
}

/** Typed SDK errors → harness error codes, most specific first. */
export function claudeError(e: unknown): LlmError {
  if (e instanceof LlmError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new LlmError("auth", "Anthropic rejected the API key.", e.status);
  if (e instanceof Anthropic.NotFoundError) return new LlmError("model", `Model unavailable: ${e.message}`, 404);
  if (e instanceof Anthropic.RateLimitError) {
    const ra = e.headers?.get?.("retry-after");
    const body = JSON.stringify(e.error ?? {});
    if (!ra || /enforced_spend_limit|spend/i.test(body)) return new LlmError("rate-daily", "Anthropic spend or usage limit reached for this key.", 429);
    return new LlmError("rate-minute", "Rate limited by Anthropic for a moment.", 429, Math.ceil(Number(ra) * 1000) || 6000);
  }
  if (e instanceof Anthropic.BadRequestError) return new LlmError("bad-request", e.message, 400);
  if (e instanceof Anthropic.APIConnectionError) return new LlmError("network", e.message);
  if (e instanceof Anthropic.APIError) return new LlmError("upstream", `Anthropic error ${e.status ?? ""}: ${e.message}`, typeof e.status === "number" ? e.status : 502);
  return new LlmError("network", (e as Error)?.message || String(e));
}

/** Models a key can use, live from the provider (so retired model names never strand anyone). */
export async function listModels(provider: ProviderId, opts: { key?: string | null; baseUrl?: string | null; fetchImpl?: typeof fetch } = {}): Promise<string[]> {
  if (PROVIDERS[provider].kind === "anthropic") {
    if (!opts.key) throw new LlmError("no-key", "No Claude API key.");
    const client = new Anthropic({ apiKey: opts.key, maxRetries: 0, ...(opts.fetchImpl ? { fetch: opts.fetchImpl } : {}) });
    const ids: string[] = [];
    try {
      for await (const m of client.models.list()) ids.push(m.id);
    } catch (e) {
      throw claudeError(e);
    }
    return ids;
  }
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${baseFor(provider, opts.baseUrl)}/models`, { headers: opts.key ? { Authorization: `Bearer ${opts.key}` } : {} }).catch((e: Error) => {
    throw new LlmError("network", e.message);
  });
  if (!res.ok) throw classifyHttp(res.status, await res.text(), res.headers.get("retry-after"));
  const j = (await res.json()) as { data?: { id: string }[]; models?: { name?: string; id?: string }[] };
  const ids = (j.data ?? j.models ?? []).map((m) => ("id" in m && m.id ? m.id : (m as { name?: string }).name ?? "")).filter(Boolean);
  return ids.map((id) => id.replace(/^models\//, "")).sort();
}
