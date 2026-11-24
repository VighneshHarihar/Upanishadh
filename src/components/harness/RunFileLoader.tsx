"use client";
// Open a report produced by the downloadable harness: drop its .json here and it renders like any recorded run.
// The file is read in this browser only.
import { useState } from "react";
import { loadEngine } from "@/lib/client/data";
import type { HarnessRun } from "@/lib/core/pipeline";
import type { Rubric } from "@/lib/core/types";
import { RunView, type RunContext } from "./RunView";
import { IconFile } from "@/components/ui/Icons";

const isRun = (x: unknown): x is HarnessRun => !!x && typeof x === "object" && "prompt" in x && "baseline" in x && "realigned" in x && "judge" in x && "diagnosis" in x;

export function RunFileLoader({ axes, corpusSize }: { axes: Rubric["axes"]; corpusSize: number }) {
  const [runs, setRuns] = useState<HarnessRun[] | null>(null);
  const [i, setI] = useState(0);
  const [ctx, setCtx] = useState<RunContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const open = async (file: File) => {
    setErr(null);
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const list = (Array.isArray(data) ? data : [data]).filter(isRun);
      if (!list.length) throw new Error("This file is not a harness report (expected the .json written next to the HTML report).");
      const { E } = await loadEngine();
      const nodes = Object.fromEntries(E.graph.nodes.map((n) => [n.id, n]));
      const verses = Object.fromEntries(E.kb.verses.map((v) => [v.id, { label: `${E.kb.texts.find((t) => t.id === v.up)!.abbrev} ${v.ref}`, tr: v.tr, trBy: v.trBy, audio: v.audio, text: v.sa }]));
      setCtx({ nodes, verses, axes, corpusSize });
      setRuns(list);
      setI(0);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-line-2 bg-surface hover:border-line-3"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) open(f);
        }}
      >
        <IconFile size={26} className="text-text-3" />
        <span className="text-[15px] font-semibold">Drop a harness report (.json) here</span>
        <span className="text-[13px] text-text-3">or click to choose a file · read in this browser only, never uploaded</span>
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
      </label>
      {err && <p className="mt-3 rounded-lg bg-[var(--preyas-soft)] px-3 py-2 text-[13px] text-[var(--preyas)]">{err}</p>}
      {runs && ctx && (
        <div className="mt-6">
          {runs.length > 1 && (
            <div className="seg mb-4 flex-wrap">
              {runs.map((r, k) => (
                <button key={k} aria-pressed={k === i} onClick={() => setI(k)}>
                  {r.title ?? `Run ${k + 1}`} · {r.judge.totals.baseline}→{r.judge.totals.realigned}
                </button>
              ))}
            </div>
          )}
          <RunView key={i} run={runs[i]} ctx={ctx} mode="static" />
        </div>
      )}
    </div>
  );
}
