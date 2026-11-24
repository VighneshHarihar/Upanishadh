"use client";
import { useEffect, useState } from "react";
import type { PathStep } from "@/lib/core/types";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { Gloss } from "@/components/ui/Glossary";
import { IconChat, IconCheck } from "@/components/ui/Icons";
import { useReady } from "@/lib/client/capture";
import { askStore } from "@/lib/client/ask-store";

export interface StepData extends PathStep {
  verse?: { id: string; label: string; up: string; ref: string; sa: string[]; iast: string[]; tr: string; trBy: string; audio: string | null; hasBhashya: boolean };
  concept?: { id: string; iast: string; sa: string; en: string; desc: string };
}

const KIND: Record<PathStep["kind"], string> = { read: "Read", contrast: "Contrast", story: "Story", reflect: "Reflect" };

export function PathView({ pathId, steps, header, footer, plate, plateAt = -1 }: { pathId: string; steps: StepData[]; header?: React.ReactNode; footer?: React.ReactNode; /** A Living Plate, shown in step `plateAt`. */ plate?: React.ReactNode; plateAt?: number }) {
  const key = `upasarathi:path:${pathId}`;
  const [done, setDone] = useState<number[]>([]);
  useReady(true);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* keep in memory */
    }
  };
  const pct = Math.round((done.length / steps.length) * 100);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:gap-16">
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+28px)] lg:h-fit">
        {header}
        <div className="mt-7 flex items-center gap-3 text-[12.5px] text-text-3">
          <span className="num">{done.length}/{steps.length}</span>
          <span className="bar flex-1"><span style={{ width: `${pct}%`, background: "var(--accent)" }} /></span>
        </div>
        <ol className="mt-4 hidden space-y-0.5 lg:block">
          {steps.map((s, i) => (
            <li key={i}>
              <a href={`#step-${i + 1}`} className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-[13.5px] text-text-3 hover:bg-surface-2 hover:text-text">
                <span className={`num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] ${done.includes(i) ? "bg-accent text-[var(--accent-ink)]" : "border border-line-2"}`}>{done.includes(i) ? <IconCheck size={11} /> : i + 1}</span>
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </aside>
      <div className="min-w-0">
        <ol className="space-y-6">
          {steps.map((s, i) => (
            <li key={i} id={`step-${i + 1}`} className="tile scroll-mt-[calc(var(--nav-h)+24px)] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className={`num grid h-8 w-8 place-items-center rounded-full text-[13px] ${done.includes(i) ? "bg-accent text-[var(--accent-ink)]" : "border border-line-2 text-text-3"}`}>{done.includes(i) ? <IconCheck size={15} /> : i + 1}</span>
                <p className="eyebrow">{KIND[s.kind]}{s.verse ? ` · ${s.verse.label}` : ""}</p>
              </div>
              <h2 className="display mt-4 text-[28px] leading-tight">{s.title}</h2>
              {s.verse && (
                <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <div className="deva text-[21px]">{s.verse.sa.map((l, k) => <div key={k}>{l}</div>)}</div>
                    <div className="iast mt-2 text-[14.5px]">{s.verse.iast.map((l, k) => <div key={k}>{l}</div>)}</div>
                  </div>
                  <div>
                    <p className="reading text-[17px]">“{s.verse.tr}”</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-text-3">
                      <span>{s.verse.trBy}</span>
                      <CiteChip id={s.verse.id} label={s.verse.hasBhashya ? `${s.verse.label} · with Śaṅkara` : s.verse.label} />
                      <AudioButton src={s.verse.audio} label="Chant" />
                    </div>
                  </div>
                </div>
              )}
              {s.concept && (
                <div className="mt-5 rounded-xl bg-surface-2 p-5">
                  <p className="text-[19px] font-semibold">{s.concept.iast} <span className="deva text-[18px] font-normal text-text-3">{s.concept.sa}</span></p>
                  <p className="text-[13px] text-text-3">{s.concept.en}</p>
                  <p className="reading mt-2 text-[16px]">{s.concept.desc}</p>
                  <div className="mt-3"><CiteChip id={s.concept.id} label="Connections" /></div>
                </div>
              )}
              {i === plateAt && plate}
              <div className="mt-5 border-l-2 border-line-3 pl-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-4">Editorial note · not a translation</p>
                <p className="mt-1 text-[15.5px] leading-relaxed text-text-2"><Gloss max={3}>{s.note}</Gloss></p>
              </div>
              <p className="mt-5 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-[15.5px]"><span className="font-semibold text-accent">Reflect · </span>{s.prompt}</p>
              <div className="capture-hide mt-5 flex flex-wrap gap-2">
                <button className={`btn btn-sm ${done.includes(i) ? "btn-accent" : ""}`} onClick={() => toggle(i)} aria-pressed={done.includes(i)}>
                  {done.includes(i) ? <><IconCheck size={14} /> Done</> : "Mark as done"}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => askStore.ask(s.verse ? `Explain ${s.verse.label} in the light of this: ${s.prompt}` : `Help me reflect on this: ${s.prompt}`)}>
                  <IconChat size={14} /> Talk it through
                </button>
              </div>
            </li>
          ))}
        </ol>
        {footer}
      </div>
    </div>
  );
}
