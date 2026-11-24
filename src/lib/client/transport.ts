"use client";
// Browser transport: every call goes through the stateless /api/llm relay with the visitor's own key.
import { LlmError, emptyError, withRateRetry, type LlmRequest, type LlmResult, type ProviderId } from "@/lib/core/llm";
import type { Transport } from "@/lib/core/pipeline";
import { baseUrlFor, getSettings } from "./settings";

export const META_SEP = "\u0000";

export function browserTransport(onWait?: (ms: number, what: string) => void): Transport {
  return {
    complete(req: LlmRequest, onToken?: (delta: string, full: string) => void): Promise<LlmResult> {
      return withRateRetry(() => once(req, onToken), (ms) => onWait?.(ms, req.model));
    },
  };
}

async function once(req: LlmRequest, onToken?: (delta: string, full: string) => void): Promise<LlmResult> {
  const s = getSettings();
  const key = s.keys[req.provider];
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "x-upasarathi-key": key } : {}) },
      body: JSON.stringify({ ...req, baseUrl: baseUrlFor(s, req.provider) }),
    });
  } catch (e) {
    throw new LlmError("network", (e as Error).message);
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; retryAfterMs?: number } };
    throw new LlmError((j.error?.code as LlmError["code"]) || "upstream", j.error?.message || `HTTP ${res.status}`, res.status, j.error?.retryAfterMs ?? null);
  }
  if (!req.stream) {
    const j = (await res.json()) as { text: string; model: string; finish: string | null };
    if (!j.text?.trim()) throw emptyError(j.finish);
    return { text: j.text, model: j.model, finish: j.finish, ms: Math.round(performance.now() - t0) };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let raw = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
    onToken?.("", raw.split(META_SEP)[0]);
  }
  const [text, metaRaw] = raw.split(META_SEP);
  const meta = (metaRaw ? JSON.parse(metaRaw) : {}) as { model?: string; finish?: string | null; error?: { code: string; message: string; retryAfterMs?: number | null } };
  if (meta.error) throw new LlmError(meta.error.code as LlmError["code"], meta.error.message, 0, meta.error.retryAfterMs ?? null);
  if (!text.trim()) throw emptyError(meta.finish ?? null);
  return { text: text.trim(), model: meta.model || req.model, finish: meta.finish ?? null, ms: Math.round(performance.now() - t0) };
}

/** Models a key can use, live from the provider, via the relay. */
export async function fetchModels(provider: ProviderId): Promise<string[]> {
  const s = getSettings();
  const key = s.keys[provider];
  const res = await fetch("/api/llm/models", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "x-upasarathi-key": key } : {}) },
    body: JSON.stringify({ provider, baseUrl: baseUrlFor(s, provider) }),
  });
  const j = (await res.json().catch(() => ({}))) as { models?: string[]; error?: { message?: string } };
  if (!res.ok || !j.models) throw new Error(j.error?.message || `HTTP ${res.status}`);
  return j.models;
}
