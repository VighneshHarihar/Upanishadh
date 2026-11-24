"use client";
// "Chant with Vāgdhenu (Local AI)": for passages with no human recording only (where one exists, "Hear the chant"
// plays it and this button is not shown). The first time, the reader is told what the model is, what it is not (no
// Vedic svaras), and how large the download is, before anything is fetched.
import { useEffect, useState } from "react";
import { VAGDHENU } from "@/lib/tts/config";
import { chant, hasWebGpu, isSaved, useChant } from "@/lib/tts/chant";
import { AiBadge, IconSpark, fmtMB } from "./TtsBits";
import { IconPause, IconPlay } from "@/components/ui/Icons";

export function AiChantButton({ id, up, label, className = "" }: { id: string; up: string; label: string; className?: string }) {
  const c = useChant();
  useEffect(() => {
    void isSaved(id);
  }, [id]);
  const mine = c.key === id;
  const busy = mine && (c.phase === "loading" || c.phase === "generating" || c.phase === "done");
  const saved = Boolean(c.saved[id]);
  const text =
    mine && c.phase === "loading"
      ? `Preparing Vāgdhenu… ${c.pct}%`
      : mine && c.phase === "generating" && c.held
        ? `Chanting… ${c.parts ? `${c.part}/${c.parts}` : `${c.pct}%`}`
        : busy
          ? c.paused
            ? "AI chant paused"
            : "AI chant playing"
          : saved
            ? "Play AI chant (saved)"
            : "Chant with Vāgdhenu (Local AI)";
  return (
    <>
      <button
        type="button"
        data-tts="ai-chant"
        className={`btn btn-sm ${busy ? "btn-accent" : ""} ${className}`}
        aria-pressed={busy}
        title="No human recording of this passage yet. Vāgdhenu, an AI model, can chant it in classical meter, on this device."
        onClick={() => chant.request(id, up, label)}
      >
        {busy && !c.paused && !c.held ? <IconPause size={14} /> : saved ? <IconPlay size={14} /> : <IconSpark size={14} />} {text}
      </button>
      {mine && c.phase === "confirm" && <ChantConsent />}
      {mine && c.phase === "error" && (
        <div className="tts-card" role="alert">
          <h3>The AI chant did not work here</h3>
          <p>{c.error}</p>
          <div className="tts-actions">
            <button type="button" className="btn btn-sm" onClick={() => chant.request(id, up, label)}>Try again</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => chant.dismiss()}>Dismiss</button>
          </div>
        </div>
      )}
    </>
  );
}

function ChantConsent() {
  const [gpu, setGpu] = useState<boolean | null>(null);
  useEffect(() => {
    void hasWebGpu().then(setGpu);
  }, []);
  const bytes = gpu === false ? VAGDHENU.bytes.wasm : VAGDHENU.bytes.webgpu;
  return (
    <div className="tts-card" role="dialog" aria-label="Chant with Vāgdhenu">
      <h3>No human recording of this passage yet</h3>
      <p>
        Vāgdhenu, an AI model from IISc Bengaluru, can chant it on this device. It chants in classical meter and does not
        reproduce the Vedic svaras (udātta, anudātta, svarita), so take it as a reading aid, not a Vedic recitation.
      </p>
      <div className="mt-2"><AiBadge /></div>
      <p>
        One-time download of about {fmtMB(bytes + VAGDHENU.bytes.runtime)}, kept in this browser.{" "}
        {gpu === null
          ? ""
          : gpu
            ? "This browser has WebGPU, so a line takes roughly 10 to 25 seconds to make."
            : "This browser has no WebGPU, so it runs on the processor: slow, a minute or more per line."}{" "}
        Best on a desktop. Each passage is saved after its first chant, so a replay is instant.
      </p>
      <div className="tts-actions">
        <button type="button" className="btn btn-sm btn-accent" data-tts="ai-chant-confirm" onClick={() => chant.confirm()}>
          Download (≈{fmtMB(bytes + VAGDHENU.bytes.runtime)}) and chant
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => chant.dismiss()}>Not now</button>
      </div>
    </div>
  );
}
