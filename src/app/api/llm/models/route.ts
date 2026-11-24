// Lists the models a visitor's key can use, live from the provider.
import { PROVIDERS, isProvider, LlmError } from "@/lib/core/llm";
import { listModels } from "@/lib/core/complete";
import { isLocalRequest } from "@/lib/server/guard";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; baseUrl?: string };
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!isProvider(body.provider)) return out({ error: { code: "bad-request", message: "Unknown provider" } }, 400);
  const p = PROVIDERS[body.provider];
  const local = isLocalRequest(req);
  if ((body.provider === "ollama" || body.provider === "compatible") && !local) return out({ error: { code: "bad-request", message: `${p.name} only works on your own computer.` } }, 400);
  const key = req.headers.get("x-upasarathi-key")?.trim() || (local && p.envKey ? process.env[p.envKey]?.trim() : undefined) || null;
  try {
    return out({ models: await listModels(body.provider, { key, baseUrl: body.baseUrl }) });
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError("upstream", (e as Error).message);
    return out({ error: { code: err.code, message: err.message } }, err.status && err.status >= 400 ? err.status : 502);
  }
}
