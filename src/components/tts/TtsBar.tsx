"use client";
// The dock for speech made on this device: English narration (Piper or the browser voice) and the AI chant
// (Vāgdhenu) while it is being made. It takes the chant player's place at the bottom of the screen while active.
import { useEffect, useState } from "react";
import { PIPER, PIPER_BYTES, SPEEDS } from "@/lib/tts/config";
import { chant, useChant, type ChantState } from "@/lib/tts/chant";
import { browserVoices, narrator, useNarration, type NarrationState } from "@/lib/tts/narrator";
import { usePrefs } from "@/lib/tts/prefs";
import { AiBadge, IconStop, Progress, fmtMB } from "./TtsBits";
import { IconClose, IconPause, IconPlay } from "@/components/ui/Icons";

export const chantActive = (c: ChantState) => c.phase === "loading" || c.phase === "generating" || c.phase === "done" || c.phase === "error";
export const narrationActive = (n: NarrationState) => n.status === "loading" || n.status === "speaking" || n.status === "error";

/** True while the dock is showing (the chant player hides its own bar meanwhile). */
export function useTtsActive() {
  const n = useNarration();
  const c = useChant();
  return chantActive(c) || narrationActive(n);
}

export function TtsBar() {
  const n = useNarration();
  const c = useChant();
  useEffect(() => {
    const t = setInterval(() => {
      chant.poll();
    }, 400);
    return () => clearInterval(t);
  }, []);
  if (chantActive(c)) return <ChantDock c={c} />;
  if (narrationActive(n)) return <NarrationDock n={n} />;
  return null;
}

function ChantDock({ c }: { c: ChantState }) {
  const making = c.phase === "loading" || c.phase === "generating";
  const status =
    c.phase === "error"
      ? `The AI chant did not work here: ${c.error}`
      : c.phase === "loading"
      ? c.message || "Starting the chant model…"
      : c.phase === "done"
        ? c.message
        : c.held
          ? c.part > 0
            ? `${c.part} of ${c.parts} lines ready · playback starts when it can run without gaps · ${c.message}`
            : c.message || "Making the first line…"
          : c.starved
            ? "Making the next line…"
            : c.message;
  return (
    <div className="player tts-bar capture-hide" role="region" aria-label="AI chant">
      <button
        className="btn btn-accent btn-icon !h-10 !w-10 !rounded-full"
        onClick={() => (c.paused ? chant.resume() : chant.pause())}
        disabled={c.phase === "loading" || c.phase === "error" || c.held}
        aria-label={c.paused ? "Resume" : "Pause"}
      >
        {c.paused || c.held || c.phase === "loading" || c.phase === "error" ? <IconPlay size={15} /> : <IconPause size={16} />}
      </button>
      <div className="tts-main">
        <div className="tts-title">
          <span>{c.label}</span>
          {c.provider && <span className="text-[11px] font-normal text-text-4">{c.provider === "webgpu" ? "WebGPU" : "CPU"} · on this device</span>}
        </div>
        <div className="mt-1"><AiBadge /></div>
        <p className="tts-status" aria-live="polite" title={status} style={c.phase === "error" ? { whiteSpace: "normal" } : undefined}>{status}</p>
        {making && <Progress pct={c.phase === "generating" && c.parts ? Math.max(c.pct, (c.part / c.parts) * 100) : c.pct} label={c.phase === "loading" ? "Model download" : "Chant generation"} />}
      </div>
      {c.held && c.part > 0 && (
        <button className="btn btn-sm" data-tts="play-now" onClick={() => chant.playNow()}>Play what’s ready</button>
      )}
      <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={() => chant.stop()} aria-label="Stop the AI chant" title={making ? "Stop (abandons this chant)" : "Stop"}>
        <IconStop size={14} />
      </button>
    </div>
  );
}

function NarrationDock({ n }: { n: NarrationState }) {
  const p = usePrefs();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (n.engine === "browser") void browserVoices().then(setVoices);
  }, [n.engine]);
  const label = n.item ? `${n.item.label} · ${n.item.part === "commentary" ? "Śaṅkara’s commentary" : "translation"}` : "";
  const dl = n.download;
  const status =
    n.status === "error"
      ? n.error
      : n.status === "loading"
        ? n.engine === "piper"
          ? dl && dl.loaded > 0 && dl.loaded < dl.total
            ? `Downloading the voice, once · ${fmtMB(dl.loaded)} of ${fmtMB(dl.total)}`
            : dl && dl.loaded >= dl.total
              ? "Loading the voice from this browser…"
              : "Starting the voice…"
          : "Starting…"
        : n.sentence <= 0 && !n.starved
          ? "Starting…"
          : n.starved
          ? n.sentence <= 0
            ? "Preparing the first sentence…"
            : `Preparing the next sentence · ${n.sentence} of ${n.sentences}`
          : n.sentences
            ? `Sentence ${n.sentence} of ${n.sentences}`
            : "";
  const pct = n.status === "loading" && dl ? (dl.loaded / (dl.total || PIPER_BYTES)) * 100 : n.sentences ? (n.sentence / n.sentences) * 100 : 0;
  const chosen = voices.find((v) => v.voiceURI === p.browserVoice) ?? voices[0];
  return (
    <div className={`player tts-bar capture-hide ${n.engine === "piper" ? "tts-one-line" : ""}`} role="region" aria-label="Narration">
      <button
        className="btn btn-accent btn-icon !h-10 !w-10 !rounded-full"
        onClick={() => (n.paused ? narrator.resume() : narrator.pause())}
        disabled={n.status !== "speaking"}
        aria-label={n.paused ? "Resume" : "Pause"}
        data-tts="pause"
      >
        {n.paused || n.status !== "speaking" ? <IconPlay size={15} /> : <IconPause size={16} />}
      </button>
      <div className="tts-main">
        <div className="tts-title">
          <span>{label}</span>
          <span className="tts-engine shrink-0 text-[11px] font-normal text-text-4" title={n.engine === "piper" ? `Piper · ${PIPER.voiceLabel} · made on this device` : "Your system’s own voice"}>{n.engine === "piper" ? "Piper · Alan" : "Browser voice"}</span>
        </div>
        <p className="tts-status" aria-live="polite" data-tts="status" style={n.status === "error" ? { whiteSpace: "normal" } : undefined}>{status}</p>
        {n.status !== "error" && <Progress pct={pct} label={n.status === "loading" ? "Voice download" : "Narration"} indeterminate={n.status === "loading" && !dl?.loaded} />}
      </div>
      <button className="tts-stop btn btn-ghost btn-icon !h-9 !w-9" onClick={() => narrator.stop()} aria-label="Stop reading" data-tts="stop">
        {n.status === "error" ? <IconClose size={15} /> : <IconStop size={14} />}
      </button>
      <div className="tts-row">
        <div className="seg tts-speed !rounded-[10px] !p-[2px]" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} aria-pressed={p.speed === s} onClick={() => narrator.setSpeed(s)} className="!h-7 !px-2 !text-[12px]">{s}×</button>
          ))}
        </div>
        <div className="seg !rounded-[10px] !p-[2px]" role="group" aria-label="Voice">
          <button aria-pressed={n.engine === "piper"} data-tts="engine-piper" onClick={() => n.engine !== "piper" && narrator.switchEngine("piper")} className="!h-7 !px-2 !text-[12px]" title={`Natural voice, made on this device (about ${fmtMB(PIPER_BYTES)} once)`}>Piper</button>
          <button aria-pressed={n.engine === "browser"} data-tts="engine-browser" onClick={() => n.engine !== "browser" && narrator.switchEngine("browser")} className="!h-7 !px-2 !text-[12px]" title="Your system’s own voice: instant, no download">Browser</button>
        </div>
        {n.engine === "browser" && voices.length > 1 && (
          <select aria-label="Browser voice" className="tts-voice" value={chosen?.voiceURI ?? ""} onChange={(e) => narrator.setBrowserVoice(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
