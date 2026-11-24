// Provider registry and request shaping for every bring-your-own-key model. Browser-safe: no SDK imports here.
// Server-side calls (the edge relay, the downloadable harness) go through ./complete.ts.

export type ProviderId = "anthropic" | "openai" | "gemini" | "groq" | "openrouter" | "ollama" | "compatible";
export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** "anthropic" uses the Anthropic SDK; everything else speaks the OpenAI chat-completions protocol. */
  kind: "anthropic" | "openai";
  base: string;
  envKey: string | null;
  keyPrefix: string | null;
  keyUrl: string;
  json: boolean;
  defaultModel: string;
  defaultJudge: string;
  models: { id: string; label: string }[];
  note?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic", name: "Claude", kind: "anthropic", base: "https://api.anthropic.com", envKey: "ANTHROPIC_API_KEY", keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys", json: false,
    defaultModel: "claude-opus-5-5", defaultJudge: "claude-sonnet-5-5",
    models: [
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
      { id: "claude-fable-5-2", label: "Claude Fable 5.2" },
    ],
  },
  openai: {
    id: "openai", name: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY", keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys", json: true,
    defaultModel: "gpt-4o-mini", defaultJudge: "gpt-4o",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ],
    note: "Use “Load models” to see every model your key can use.",
  },
  gemini: {
    id: "gemini", name: "Gemini", kind: "openai", base: "https://generativelanguage.googleapis.com/v1beta/openai", envKey: "GEMINI_API_KEY", keyPrefix: null,
    keyUrl: "https://aistudio.google.com/apikey", json: true,
    defaultModel: "gemini-2.5-flash", defaultJudge: "gemini-2.5-pro",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    note: "Use “Load models” to see every model your key can use.",
  },
  groq: {
    id: "groq", name: "Groq", kind: "openai", base: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY", keyPrefix: "gsk_", keyUrl: "https://console.groq.com/keys", json: true,
    defaultModel: "openai/gpt-oss-20b", defaultJudge: "openai/gpt-oss-120b",
    models: [
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
    ],
    note: "Free tier with daily limits.",
  },
  openrouter: {
    id: "openrouter", name: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY", keyPrefix: "sk-or-", keyUrl: "https://openrouter.ai/keys", json: false,
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free", defaultJudge: "google/gemma-3-27b-it:free",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
      { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)" },
      { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (free)" },
    ],
    note: "Hundreds of models, including free ones.",
  },
  ollama: {
    id: "ollama", name: "Ollama", kind: "openai", base: "http://localhost:11434/v1", envKey: null, keyPrefix: null, keyUrl: "https://ollama.com/download", json: true,
    defaultModel: "llama3.1", defaultJudge: "qwen2.5",
    models: [
      { id: "llama3.1", label: "Llama 3.1 8B" },
      { id: "qwen2.5", label: "Qwen 2.5 7B" },
    ],
    note: "Runs on your own computer; no key.",
  },
  compatible: {
    id: "compatible", name: "Any OpenAI-compatible", kind: "openai", base: "", envKey: "OPENAI_COMPAT_API_KEY", keyPrefix: null, keyUrl: "", json: false,
    defaultModel: "", defaultJudge: "",
    models: [],
    note: "vLLM, LM Studio, Together, Fireworks, Azure… give a base URL.",
  },
};
export const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "gemini", "groq", "openrouter", "ollama", "compatible"];
export const isProvider = (s: unknown): s is ProviderId => typeof s === "string" && s in PROVIDERS;
/** Providers that need a key (Ollama and some self-hosted endpoints do not). */
export const needsKey = (p: ProviderId) => p !== "ollama" && p !== "compatible";

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  messages: Msg[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  /** Reasoning depth for models that support it (Claude effort, OpenAI/Groq reasoning_effort). Omitted = model default. */
  reasoning?: "low" | "medium" | "high";
  stream?: boolean;
}
export interface LlmResult {
  text: string;
  /** The model that actually answered (a server-side fallback can differ from the one requested). */
  model: string;
  ms: number;
  finish: string | null;
  /** Tokens billed for this call, when the provider reports them. */
  usage?: { in: number; out: number };
}
export type LlmErrorCode = "no-key" | "auth" | "model" | "rate-minute" | "rate-daily" | "empty" | "refusal" | "upstream" | "network" | "bad-request";

export class LlmError extends Error {
  code: LlmErrorCode;
  status: number;
  retryAfterMs: number | null;
  constructor(code: LlmErrorCode, message: string, status = 0, retryAfterMs: number | null = null) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Reasoning models spend tokens thinking before they answer; give them headroom or they return nothing. */
export const isReasoningModel = (m: string) => /gpt-oss|qwen3|deepseek-r1|^o\d|\bo[134]\b|gpt-5|reason|think/i.test(m);
export const REASONING_MIN_TOKENS = 4096;
/** OpenAI's reasoning families take max_completion_tokens and only the default temperature. */
const openaiReasoning = (provider: ProviderId, model: string) => provider === "openai" && /^(o\d|gpt-5)/i.test(model);

/** Body for an OpenAI-compatible /chat/completions request. */
export function chatBody(req: LlmRequest): Record<string, unknown> {
  const p = PROVIDERS[req.provider];
  const max = isReasoningModel(req.model) ? Math.max(req.maxTokens ?? 0, REASONING_MIN_TOKENS) : req.maxTokens ?? 1400;
  const oaiR = openaiReasoning(req.provider, req.model);
  return {
    model: req.model,
    messages: req.messages,
    ...(oaiR ? { max_completion_tokens: max } : { max_tokens: max, temperature: req.temperature ?? 0.7 }),
    stream: Boolean(req.stream),
    ...(req.stream && (req.provider === "openai" || req.provider === "groq" || req.provider === "openrouter") ? { stream_options: { include_usage: true } } : {}),
    ...(req.json && p.json ? { response_format: { type: "json_object" } } : {}),
    ...(req.reasoning && ((req.provider === "groq" && /gpt-oss/.test(req.model)) || oaiR) ? { reasoning_effort: req.reasoning } : {}),
  };
}

function parseRetryAfter(header: string | null, body: string): number | null {
  if (header && /^\d+(\.\d+)?$/.test(header.trim())) return Math.ceil(Number(header) * 1000);
  const m = body.match(/try again in\s+(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?\s*(?:(\d+)ms)?/i);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Math.ceil(Number(m[1] || 0) * 60000 + Number(m[2] || 0) * 1000 + Number(m[3] || 0));
}

/** Turn a provider HTTP failure into a typed error. A per-minute 429 is retryable; a daily quota or spend cap is not. */
export function classifyHttp(status: number, body: string, retryAfter: string | null = null): LlmError {
  let msg = body.slice(0, 400);
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    msg = (typeof j.error === "string" ? j.error : j.error?.message) || j.message || msg;
  } catch {
    /* not JSON */
  }
  if (status === 401 || status === 403) return new LlmError("auth", `The provider rejected the API key (${status}).`, status);
  if (status === 404 || /model[_ ]not[_ ]found|does not exist|decommissioned|no endpoints found/i.test(msg)) return new LlmError("model", `Model unavailable: ${msg}`, status);
  if (status === 429) {
    if (/per day|\(RPD\)|\(TPD\)|daily|free-models-per-day|requests per day|tokens per day|quota|spend.?(cap|limit)|enforced_spend_limit/i.test(body)) return new LlmError("rate-daily", `Daily or spend limit reached for this key: ${msg}`, status);
    return new LlmError("rate-minute", `Rate limited for a moment: ${msg}`, status, parseRetryAfter(retryAfter, msg) ?? 6000);
  }
  if (status >= 500) return new LlmError("upstream", `Provider error ${status}: ${msg}`, status);
  return new LlmError("bad-request", msg || `HTTP ${status}`, status);
}

export function readCompletion(json: unknown, model: string, ms: number): LlmResult {
  const j = json as { model?: string; choices?: { message?: { content?: string | null }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  // Some open models print their reasoning inline as <think>…</think>; it is never part of the answer.
  const text = stripThinking(j.choices?.[0]?.message?.content ?? "");
  const finish = j.choices?.[0]?.finish_reason ?? null;
  if (!text) throw emptyError(finish);
  return { text, model: j.model || model, ms, finish, ...(j.usage ? { usage: { in: j.usage.prompt_tokens ?? 0, out: j.usage.completion_tokens ?? 0 } } : {}) };
}

export const stripThinking = (s: string) => s.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();

export function emptyError(finish: string | null): LlmError {
  return new LlmError(
    "empty",
    finish === "length" || finish === "max_tokens" ? "The model used its whole token budget (likely on reasoning) and returned no answer." : "The model returned an empty answer.",
  );
}

/** Text deltas from an OpenAI-compatible SSE stream. */
export async function* sseDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<{ delta: string; finish: string | null; usage?: { in: number; out: number } }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          error?: { message?: string };
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
        };
        if (j.error) throw new LlmError("upstream", j.error.message || "stream error");
        const c = j.choices?.[0];
        const u = j.usage || j.x_groq?.usage;
        if (c?.delta?.content || c?.finish_reason || u) yield { delta: c?.delta?.content || "", finish: c?.finish_reason ?? null, ...(u ? { usage: { in: u.prompt_tokens ?? 0, out: u.completion_tokens ?? 0 } } : {}) };
      } catch (e) {
        if (e instanceof LlmError) throw e;
      }
    }
  }
}

/** Retry per-minute rate limits (bounded); stop immediately on a daily quota or any other error. */
export async function withRateRetry<T>(fn: () => Promise<T>, onWait?: (ms: number) => void, max = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof LlmError) || e.code !== "rate-minute" || attempt >= max) throw e;
      const ms = Math.min(e.retryAfterMs ?? 6000, 30000) + 400;
      onWait?.(ms);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}
