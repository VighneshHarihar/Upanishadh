"use client";
import { useState } from "react";
import { RunView, type RunContext } from "./RunView";
import { BlindJudge } from "./BlindJudge";
import type { HarnessRun } from "@/lib/core/pipeline";
import { useReady } from "@/lib/client/capture";

/** A recorded run: the full replay, or "be the blind judge" — the same three answers, anonymised, for your own vote. */
export function ReplayPage({ run, ctx }: { run: HarnessRun; ctx: RunContext }) {
  useReady(true);
  const canJudge = run.status !== "crisis" && run.judge.order?.length === 3;
  const [mode, setMode] = useState<"replay" | "blind">("replay");
  return (
    <>
      {canJudge && (
        <div className="seg capture-hide mb-5" role="tablist" aria-label="How to view this run">
          <button role="tab" aria-selected={mode === "replay"} aria-pressed={mode === "replay"} onClick={() => setMode("replay")}>Replay</button>
          <button role="tab" aria-selected={mode === "blind"} aria-pressed={mode === "blind"} onClick={() => setMode("blind")}>Be the blind judge</button>
        </div>
      )}
      {mode === "blind" && canJudge ? <BlindJudge run={run} /> : <RunView run={run} ctx={ctx} mode="replay" layout="full" />}
    </>
  );
}
