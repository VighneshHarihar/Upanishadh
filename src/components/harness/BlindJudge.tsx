"use client";
// "Be the blind judge": read the three answers as the judge saw them (A, B, C in the run's fixed shuffled order),
// cast your own vote, then reveal which was the baseline, the honesty control and UpaSārathi, and how the model
// judge scored them. Your vote stays in this browser.
import { useEffect, useState } from "react";
import type { HarnessRun } from "@/lib/core/pipeline";
import { answerOf } from "@/lib/core/pipeline";
import { SIDE_LABEL, type Side } from "@/lib/core/judge";
import { RichAnswer } from "./RichAnswer";

const KEY = "upasarathi:blind";
type Vote = number | "tie";
const LETTERS = ["A", "B", "C"];
const COLOR: Record<Side, string> = { baseline: "var(--preyas)", control: "var(--control)", realigned: "var(--accent)" };
const readVotes = (): Record<string, Vote> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

export function BlindJudge({ run }: { run: HarnessRun }) {
  const order = run.judge.order;
  const [vote, setVote] = useState<Vote | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const v = readVotes()[run.id];
    if (v !== undefined) {
      setVote(v);
      setRevealed(true);
    }
  }, [run.id]);
  const cast = (v: Vote) => {
    setVote(v);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readVotes(), [run.id]: v }));
    } catch {}
  };
  const judgeLetter = run.judge.verdict && run.judge.verdict !== "tie" ? order.indexOf(run.judge.verdict) : null;
  const yourSide = typeof vote === "number" ? order[vote] : null;
  const agreed = vote === "tie" ? run.judge.verdict === "tie" : yourSide !== null && yourSide === run.judge.verdict;
  const judgeModel = (run.judge.model ?? run.models.judgeModel).replace(/^.*\//, "");

  return (
    <section className="blind" aria-label="Be the blind judge">
      <p className="max-w-[78ch] text-[14.5px] leading-relaxed text-text-2">
        The prompt was: <span className="reading text-text">“{run.prompt}”</span>
        {run.followUp && <> Then the user pushed back: <span className="reading text-text">“{run.followUp}”</span> These are the final answers.</>}
        {" "}Read the three answers exactly as the judge saw them, in the same shuffled order, and choose the one that best serves the person.
      </p>
      <div className="blind-grid mt-6">
        {order.map((side, i) => (
          <article key={i} className={`blind-card${vote === i ? " is-picked" : ""}`} aria-label={`Answer ${LETTERS[i]}`}>
            <header className="flex items-baseline justify-between gap-3">
              <span className="blind-letter">{LETTERS[i]}</span>
              {revealed && <span className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLOR[side] }}>{SIDE_LABEL[side]}</span>}
            </header>
            <div className="blind-text scroll-thin"><RichAnswer text={answerOf(run, side).text || "(no answer)"} /></div>
            <footer className="mt-4 flex items-center justify-between gap-3">
              <button className={`btn btn-sm${vote === i ? " btn-accent" : ""}`} aria-pressed={vote === i} onClick={() => cast(i)}>{vote === i ? "Your pick" : `Pick ${LETTERS[i]}`}</button>
              {revealed && <span className="num text-[12.5px] text-text-3">{run.judge.totals[side] ?? "–"} / {run.judge.max}</span>}
            </footer>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className={`btn btn-sm${vote === "tie" ? " btn-accent" : ""}`} aria-pressed={vote === "tie"} onClick={() => cast("tie")}>No clear winner</button>
        <button className="btn btn-sm" disabled={vote === null || revealed} onClick={() => setRevealed(true)}>Reveal</button>
        {revealed && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setRevealed(false); setVote(null); try { const v = readVotes(); delete v[run.id]; localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }}>Judge again</button>
        )}
      </div>
      {revealed && vote !== null && (
        <div className="blind-reveal mt-6 max-w-[78ch]" role="status">
          <p className="text-[15px] leading-relaxed">
            {vote === "tie" ? "You saw no clear winner." : <>You picked <b>{LETTERS[vote]}</b>: the <b style={{ color: COLOR[order[vote]] }}>{SIDE_LABEL[order[vote]]}</b>.</>}{" "}
            The model judge ({judgeModel}) {run.judge.verdict === "tie" ? "called it a tie" : judgeLetter !== null ? <>picked <b>{LETTERS[judgeLetter]}</b>, the <b style={{ color: COLOR[order[judgeLetter]] }}>{SIDE_LABEL[order[judgeLetter]]}</b></> : "gave no verdict"}.{" "}
            {agreed ? "You agree." : "You disagree, which is worth knowing: the judge is a model too."}
          </p>
          <p className="mt-2 text-[13px] text-text-3">
            Its totals over the {run.judge.comparableAxes} comparable axes: {order.map((s) => `${SIDE_LABEL[s]} ${run.judge.totals[s] ?? "–"}`).join(" · ")} (of {run.judge.max}).
          </p>
        </div>
      )}
    </section>
  );
}
