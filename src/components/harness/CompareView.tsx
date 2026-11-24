"use client";
// The side-by-side compare card, with the same "be the blind judge" mode as the replay page.
import { useState } from "react";
import { Compare } from "./Compare";
import { BlindJudge } from "./BlindJudge";
import type { RunContext } from "./RunView";
import type { HarnessRun } from "@/lib/core/pipeline";

export function CompareView({ run, ctx, counterVerse }: { run: HarnessRun; ctx: RunContext; counterVerse: string | null }) {
  const canJudge = run.status !== "crisis" && run.judge.order?.length === 3;
  const [mode, setMode] = useState<"compare" | "blind">("compare");
  return (
    <>
      {canJudge && (
        <div className="gutter capture-hide pt-5">
          <div className="seg" role="tablist" aria-label="How to view this run">
            <button role="tab" aria-selected={mode === "compare"} aria-pressed={mode === "compare"} onClick={() => setMode("compare")}>Side by side</button>
            <button role="tab" aria-selected={mode === "blind"} aria-pressed={mode === "blind"} onClick={() => setMode("blind")}>Be the blind judge</button>
          </div>
        </div>
      )}
      {mode === "blind" && canJudge ? <div className="gutter fab-clear py-6"><BlindJudge run={run} /></div> : <Compare run={run} ctx={ctx} counterVerse={counterVerse} />}
    </>
  );
}
