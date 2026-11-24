// The only server code: a stateless relay for bring-your-own-key completions (Claude, OpenAI, Gemini, Groq,
// OpenRouter, local Ollama, any OpenAI-compatible endpoint). No database, no stored keys, no retrieval.
import { PROVIDERS, isProvider, LlmError, type LlmRequest } from "@/lib/core/llm";
import { complete } from "@/lib/core/complete";
import { isLocalRequest } from "@/lib/server/guard";

export const runtime = "edge";

const META_SEP = "\u0000";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (e: LlmError) => json({ error: { code: e.code, message: e.message, retryAfterMs: e.retryAfterMs } }, e.status && e.status >= 400 && e.status < 600 ? e.status : e.code === "no-key" ? 401 : e.code === "refusal" ? 422 : 502);

function resolveKey(req: Request, provider: LlmRequest["provider"]): string | null {
  const local = isLocalRequest(req);
  const env = PROVIDERS[provider].envKey;
  return req.headers.get("x-upasarathi-key")?.trim() || (local && env ? process.env[env]?.trim() || null : null);
}

export async function POST(req: Request) {
  let body: Partial<LlmRequest> & { baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return fail(new LlmError("bad-request", "Invalid JSON body", 400));
  }
  if (!isProvider(body.provider)) return fail(new LlmError("bad-request", "Unknown provider", 400));
  if (!body.model || !Array.isArray(body.messages) || !body.messages.length) return fail(new LlmError("bad-request", "Missing model or messages", 400));
  const provider = body.provider;
  const local = isLocalRequest(req);
  const key = resolveKey(req, provider);
  if (PROVIDERS[provider].keyPrefix && !key) return fail(new LlmError("no-key", `No ${PROVIDERS[provider].name} key. Add one in Settings.`, 401));
  // Local model servers and custom endpoints only for requests from this machine: a deployment is never an open relay.
  if ((provider === "ollama" || provider === "compatible") && !local) return fail(new LlmError("bad-request", `${PROVIDERS[provider].name} is only available when UpaSārathi runs on your own computer.`, 400));
  const baseUrl = provider === "ollama" ? body.baseUrl || process.env.OLLAMA_BASE_URL : provider === "compatible" ? body.baseUrl : null;

  const request: LlmRequest = {
    provider,
    model: String(body.model).slice(0, 120),
    messages: body.messages.slice(0, 16).map((m) => ({ role: m.role, content: String(m.content).slice(0, 24000) })),
    temperature: body.temperature,
    maxTokens: body.maxTokens,
    json: body.json,
    reasoning: body.reasoning,
    stream: Boolean(body.stream),
  };

  if (!request.stream) {
    try {
      return json(await complete(request, { key, baseUrl, signal: req.signal }));
    } catch (e) {
      return fail(e instanceof LlmError ? e : new LlmError("upstream", (e as Error).message, 502));
    }
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const r = await complete(request, { key, baseUrl, signal: req.signal, onToken: (d) => controller.enqueue(enc.encode(d.replace(/\u0000/g, ""))) });
        controller.enqueue(enc.encode(META_SEP + JSON.stringify({ model: r.model, finish: r.finish })));
      } catch (e) {
        const err = e instanceof LlmError ? e : new LlmError("upstream", (e as Error).message);
        controller.enqueue(enc.encode(META_SEP + JSON.stringify({ model: request.model, finish: null, error: { code: err.code, message: err.message, retryAfterMs: err.retryAfterMs } })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
