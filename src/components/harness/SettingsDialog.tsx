"use client";
// Connect a model: any of seven providers, your own key, kept in this browser only.
import { useState } from "react";
import { PROVIDERS, PROVIDER_ORDER, needsKey, type ProviderId } from "@/lib/core/llm";
import { getSettings, saveSettings, useSettings, type Settings } from "@/lib/client/settings";
import { browserTransport, fetchModels } from "@/lib/client/transport";
import { IconCheck, IconClose, IconExternal, IconKey } from "@/components/ui/Icons";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const saved = useSettings();
  const [s, setS] = useState<Settings>(saved);
  const [judgeOpen, setJudgeOpen] = useState(saved.judgeProvider !== saved.provider);
  const [models, setModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "busy"; text: string } | null>(null);
  const p = PROVIDERS[s.provider];
  const jp = PROVIDERS[s.judgeProvider];
  const local = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  const patch = (x: Partial<Settings>) => setS((cur) => ({ ...cur, ...x }));
  const setKey = (id: ProviderId, key: string) => setS((cur) => ({ ...cur, keys: { ...cur.keys, [id]: key } }));
  const choose = (id: ProviderId) => {
    setStatus(null);
    setS((cur) => ({
      ...cur,
      provider: id,
      model: PROVIDERS[id].defaultModel,
      ...(judgeOpen ? {} : { judgeProvider: id, judgeModel: PROVIDERS[id].defaultJudge }),
    }));
  };
  const clean = (x: Settings): Settings => ({ ...x, keys: Object.fromEntries(Object.entries(x.keys).map(([k, v]) => [k, (v ?? "").trim()]).filter(([, v]) => v)) });
  const save = () => {
    saveSettings(clean(s));
    onClose();
  };
  const load = async (id: ProviderId) => {
    saveSettings(clean(s));
    setStatus({ kind: "busy", text: `Asking ${PROVIDERS[id].name} which models this key can use…` });
    try {
      const list = await fetchModels(id);
      setModels((m) => ({ ...m, [id]: list }));
      setStatus({ kind: "ok", text: `${list.length} models available. Pick one from the list.` });
    } catch (e) {
      setStatus({ kind: "err", text: `Could not list models: ${(e as Error).message}` });
    }
  };
  const test = async () => {
    saveSettings(clean(s));
    setStatus({ kind: "busy", text: "Sending a one-word test…" });
    try {
      const r = await browserTransport().complete({ provider: s.provider, model: s.model, maxTokens: 64, temperature: 0, messages: [{ role: "user", content: "Reply with the single word OK." }] });
      setStatus({ kind: "ok", text: `Connected. ${r.model} replied in ${r.ms} ms.` });
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    }
  };
  const list = (id: ProviderId) => models[id] ?? PROVIDERS[id].models.map((m) => m.id);
  const keyMissing = needsKey(s.provider) && !(s.keys[s.provider] ?? "").trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/55 p-3 pt-[6vh] backdrop-blur-[2px] sm:p-4" onClick={onClose}>
      <div className="card reveal w-full max-w-[720px] !rounded-2xl p-5 shadow-[var(--shadow)] sm:p-7" role="dialog" aria-modal="true" aria-label="Connect a model" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Bring your own key</p>
            <h2 className="display mt-1 text-[28px]">Connect a model</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-text-3">
          The graph answers on its own without a key. A model writes fuller answers from the same evidence and runs the live harness. Your key stays in this browser and is sent with each request through this site&apos;s relay to the provider. Nothing is stored on the server.
        </p>

        <p className="mt-6 text-[13px] font-semibold">Provider</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROVIDER_ORDER.map((id) => {
            const on = s.provider === id;
            const has = !needsKey(id) || Boolean(saved.keys[id]);
            return (
              <button key={id} onClick={() => choose(id)} aria-pressed={on} className={`relative rounded-xl border px-3 py-2.5 text-left transition ${on ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-line-2 bg-surface-2 hover:border-line-3"}`}>
                <span className="block text-[14px] font-semibold">{PROVIDERS[id].name}</span>
                <span className="block truncate text-[11.5px] text-text-3">{id === "ollama" ? "local, no key" : id === "compatible" ? "your endpoint" : PROVIDERS[id].defaultModel}</span>
                {has && needsKey(id) && <IconCheck size={14} className="absolute right-2 top-2 text-accent" />}
              </button>
            );
          })}
        </div>
        {p.note && <p className="mt-2 text-[12.5px] text-text-3">{p.note}</p>}
        {(s.provider === "ollama" || s.provider === "compatible") && !local && (
          <p className="mt-2 rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-[12.5px] text-text-3">
            Local and self-hosted endpoints work when UpaSārathi runs on your machine (<code>npm run dev</code>) or with the downloadable harness. The public site cannot reach your computer.
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(needsKey(s.provider) || s.provider === "compatible") && (
            <div className={s.provider === "compatible" ? "" : "sm:col-span-2"}>
              <label className="block text-[13px] font-semibold" htmlFor="key">{PROVIDERS[s.provider].name} API key{s.provider === "compatible" ? " (if required)" : ""}</label>
              <div className="mt-1.5 flex gap-2">
                <input id="key" type="password" autoComplete="off" placeholder={p.keyPrefix ? `${p.keyPrefix}…` : "key"} value={s.keys[s.provider] ?? ""} onChange={(e) => setKey(s.provider, e.target.value)} />
              </div>
              {p.keyUrl && (
                <a className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-text-3 underline decoration-line-3 underline-offset-2 hover:text-text" href={p.keyUrl} target="_blank" rel="noreferrer">
                  Get a {p.name} key <IconExternal size={12} />
                </a>
              )}
            </div>
          )}
          {s.provider === "ollama" && (
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-semibold" htmlFor="ollama">Ollama address</label>
              <input id="ollama" className="mt-1.5" value={s.ollamaBaseUrl} onChange={(e) => patch({ ollamaBaseUrl: e.target.value })} />
            </div>
          )}
          {s.provider === "compatible" && (
            <div>
              <label className="block text-[13px] font-semibold" htmlFor="base">Base URL</label>
              <input id="base" className="mt-1.5" placeholder="https://host/v1" value={s.compatibleBaseUrl} onChange={(e) => patch({ compatibleBaseUrl: e.target.value })} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-[13px] font-semibold" htmlFor="model">Model</label>
            <div className="mt-1.5 flex gap-2">
              <input id="model" list="m-main" value={s.model} onChange={(e) => patch({ model: e.target.value })} placeholder="model id" />
              <button className="btn shrink-0" onClick={() => load(s.provider)} disabled={keyMissing}>Load models</button>
            </div>
            <datalist id="m-main">{list(s.provider).map((m) => <option key={m} value={m} />)}</datalist>
            {s.provider === "anthropic" && <p className="mt-1.5 text-[12px] text-text-3">Called through the official Anthropic SDK. If Claude declines a request, the server-side fallback answers instead where the model supports it.</p>}
          </div>
        </div>

        <details className="mt-5 rounded-xl border border-line-2 bg-surface-2 px-4 py-3" open={judgeOpen} onToggle={(e) => setJudgeOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="flex items-center justify-between text-[13.5px] font-semibold">
            <span>Harness judge</span>
            <span className="text-[12px] font-normal text-text-3">{PROVIDERS[s.judgeProvider].name} · {s.judgeModel || "not set"}</span>
          </summary>
          <p className="mt-2 text-[12.5px] text-text-3">The judge scores both answers blind. A different model is preferred; a same-model judge is marked on the result.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12.5px] font-semibold" htmlFor="jp">Provider</label>
              <select id="jp" className="mt-1" value={s.judgeProvider} onChange={(e) => patch({ judgeProvider: e.target.value as ProviderId, judgeModel: PROVIDERS[e.target.value as ProviderId].defaultJudge })}>
                {PROVIDER_ORDER.map((id) => <option key={id} value={id}>{PROVIDERS[id].name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold" htmlFor="jm">Model</label>
              <input id="jm" className="mt-1" list="m-judge" value={s.judgeModel} onChange={(e) => patch({ judgeModel: e.target.value })} />
              <datalist id="m-judge">{list(s.judgeProvider).map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            {s.judgeProvider !== s.provider && needsKey(s.judgeProvider) && (
              <div className="sm:col-span-2">
                <label className="block text-[12.5px] font-semibold" htmlFor="jk">{jp.name} API key</label>
                <input id="jk" className="mt-1" type="password" autoComplete="off" placeholder={jp.keyPrefix ? `${jp.keyPrefix}…` : "key"} value={s.keys[s.judgeProvider] ?? ""} onChange={(e) => setKey(s.judgeProvider, e.target.value)} />
              </div>
            )}
          </div>
        </details>

        {status && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-[13px] ${status.kind === "err" ? "bg-[var(--preyas-soft)] text-[var(--preyas)]" : status.kind === "ok" ? "bg-[var(--accent-soft)] text-accent" : "bg-surface-2 text-text-3"}`}>{status.text}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[12px] text-text-4">
            <IconKey size={12} /> Stored in this browser only
          </p>
          <div className="flex gap-2">
            <button className="btn" onClick={test} disabled={keyMissing || !s.model}>Test</button>
            <button className="btn btn-accent" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
