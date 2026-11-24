"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RunView, type RunContext } from "./RunView";
import { ui } from "@/lib/client/ui-store";
import { loadEngine } from "@/lib/client/data";
import { browserTransport } from "@/lib/client/transport";
import { hasKey, useSettings } from "@/lib/client/settings";
import { runHarness, type HarnessRun } from "@/lib/core/pipeline";
import type { Preset, Rubric } from "@/lib/core/types";
import { LlmError } from "@/lib/core/llm";

export function LiveHarness({ presets, axes, corpusSize }: { presets: Preset[]; axes: Rubric["axes"]; corpusSize: number }) {
  const s = useSettings();
  const [prompt, setPrompt] = useState(presets[0]?.prompt ?? "");
  const [preset, setPreset] = useState<Preset | null>(presets[0] ?? null);
  const [run, setRun] = useState<HarnessRun | null>(null);
  const [ctx, setCtx] = useState<RunContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ready = hasKey(s);
  const recorded = useMemo(() => (preset && preset.prompt === prompt ? preset.id : null), [preset, prompt]);

  const go = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const { E, ci } = await loadEngine();
      const nodes = Object.fromEntries(E.graph.nodes.map((n) => [n.id, n]));
      const verses = Object.fromEntries(E.kb.verses.map((v) => [v.id, { label: `${E.kb.texts.find((t) => t.id === v.up)!.abbrev} ${v.ref}`, tr: v.tr, trBy: v.trBy, audio: v.audio, text: v.sa }]));
      setCtx({ nodes, verses, axes, corpusSize });
      const models = { provider: s.provider, model: s.model, judgeProvider: s.judgeProvider, judgeModel: s.judgeModel || s.model };
      const snapshot = (r: Partial<HarnessRun>) => setRun({ ...(r as HarnessRun) });
      const final = await runHarness(E, ci, browserTransport((ms) => setNote(`Rate limited for a moment; retrying in ${(ms / 1000).toFixed(0)} s…`)), models, prompt.trim(), {
        preset: recorded ? preset ?? undefined : undefined,
        events: {
          onStage: (_st, r) => snapshot(r),
          onToken: (side, full) => setRun((cur) => { if (!cur) return cur; const k = side === "control" ? "control_" : side; return { ...cur, [k]: { ...cur[k], text: full } }; }),
        },
      });
      setRun({ ...final });
      if (final.status === "partial") setNote("Some stages did not complete; see the panes for the exact errors.");
    } catch (e) {
      setNote(e instanceof LlmError && e.code === "rate-daily" ? `${e.message} Try another provider in Settings, or replay the recorded runs.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="eyebrow">Red-team presets</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.id} className={`btn btn-sm ${preset?.id === p.id && prompt === p.prompt ? "btn-accent" : ""}`} onClick={() => { setPreset(p); setPrompt(p.prompt); }}>
              {p.title}
            </button>
          ))}
        </div>
        <label htmlFor="prompt" className="mt-4 block text-[13px] font-semibold">Request to test</label>
        <textarea id="prompt" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ready ? (
            <button className="btn btn-accent" onClick={go} disabled={busy || !prompt.trim()}>{busy ? "Running…" : "Run the harness"}</button>
          ) : (
            <button className="btn btn-accent" onClick={ui.openSettings}>Connect a model to run live</button>
          )}
          {recorded && <Link className="btn" href={`/harness/run/${recorded}`}>Replay the recorded run (no key)</Link>}
          <span className="text-[12.5px] text-text-3">{ready ? `${s.model} · judge ${s.judgeModel}${s.judgeModel === s.model ? " (same model)" : ""} · 3 calls per run` : "Keys stay in this browser."}</span>
        </div>
        {note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{note}</p>}
      </div>
      {run && ctx && <RunView run={run} ctx={ctx} mode={busy ? "live" : "static"} />}
    </div>
  );
}
