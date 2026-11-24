"use client";
// Video-ready comparison of the three conditions: side by side at landscape ratios, stacked at portrait ratios (9:16,
// 4:5). The product itself highlights the flagged phrases and pairs them with a counter-verse, so films never add
// claims it lacks.
import { answerOf, type HarnessRun } from "@/lib/core/pipeline";
import { SIDES, SIDE_LABEL, type Side } from "@/lib/core/judge";
import { SIDE_COLOR, type RunContext } from "./RunView";
import { RichAnswer, type Highlight } from "./RichAnswer";
import { CiteChip } from "@/components/verse/Drawer";
import { useReady } from "@/lib/client/capture";
import { ShareButton } from "@/components/ui/Share";

export function Compare({ run, ctx, counterVerse }: { run: HarnessRun; ctx: RunContext; counterVerse: string | null }) {
  useReady(true);
  const flags = (side: Side): Highlight[] => {
    const c = run.checks[side];
    return [
      ...c.quotes.filter((q) => !q.found && q.scope !== "outside").map((q) => ({ text: q.quote, kind: "flag" as const, title: "Not found in the verified corpus" })),
      ...(c.flatteryOpener ? [{ text: c.flatteryOpener, kind: "flag" as const }] : []),
      ...c.flatteryPhrases.map((p) => ({ text: p, kind: "flag" as const })),
      ...(c.engagementBait ? [{ text: c.engagementBait, kind: "flag" as const }] : []),
    ];
  };
  const v = counterVerse ? ctx.verses[counterVerse] : null;
  const date = new Date(run.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="compare gutter py-6">
      <style>{`
        .compare-grid { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-aspect-ratio: 1/1) { .compare-grid { grid-template-columns: 1fr; } }
        .compare .answer { font-size: clamp(14.5px, 1.05vw, 18px); }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <span className="replay-chip">Replay · {run.models.model} · sample {run.sample} · {date}</span>
        <span className="text-[13px] text-text-3">{run.title} · judged blind by {run.models.judgeModel}</span>
        <div className="ml-auto capture-hide">
          <ShareButton title={`${run.title}: three answers compared`} subtitle={run.prompt} lines={SIDES.map((s) => `${SIDE_LABEL[s]}: ${run.judge.totals?.[s] ?? "–"}/${run.judge.max}`)} />
        </div>
      </div>
      <p className="mt-3 max-w-[1200px] text-[clamp(17px,1.5vw,24px)] font-medium leading-snug">“{run.prompt}”</p>
      {run.followUp && <p className="mt-1 text-[clamp(15px,1.2vw,19px)] text-preyas">then: “{run.followUp}”</p>}
      <div className="compare-grid mt-5">
        {SIDES.map((side) => (
          <section key={side} className="card p-5" style={{ borderTop: `3px solid ${SIDE_COLOR[side]}` }}>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow" style={{ color: SIDE_COLOR[side] }}>{SIDE_LABEL[side]}</p>
              {run.judge.status === "ok" && <span className="num font-semibold" style={{ color: SIDE_COLOR[side] }}>{run.judge.totals[side]}/{run.judge.max}</span>}
            </div>
            <RichAnswer text={answerOf(run, side).text} cites={side === "realigned" ? run.realigned.citations : []} highlights={flags(side)} />
            {side === "baseline" && run.checks.baseline.unverifiedQuotes > 0 && (
              <p className="mt-3"><span className="stamp">Fabricated</span> <span className="ml-2 text-[13.5px] text-text-2">not in any of the 13 Principal Upanishads ({ctx.corpusSize.toLocaleString("en")} passages)</span></p>
            )}
            {side === "realigned" && v && counterVerse && (
              <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-[12px] text-text-3">Counter-verse <CiteChip id={counterVerse} label={v.label} /></p>
                <p className="deva mt-1 text-[16px]">{v.text}</p>
                <p className="reading mt-1 text-[14px] text-text-2">“{v.tr}” <span className="text-[12px] text-text-3">({v.trBy})</span></p>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
