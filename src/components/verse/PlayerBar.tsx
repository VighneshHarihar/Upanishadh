"use client";
// The one <audio> element of the site. Plays a single mantra, a queue (continuous chapter or whole-text play, mantra
// by mantra), or a whole-text recording; with 0.75 / 1 / 1.25 speed and a loop for chanting practice. Hidden when
// nothing is queued. A saved AI chant (Vāgdhenu) plays here too, always under its badge. While speech made on this
// device is active (narration, or an AI chant being made), the speech dock takes this place.
// Position is the nāda string (components/reader/NadaString). Sources Web Audio may read (same-origin, blob: AI
// chants) play in their own element, so an element ever wired to an analyser never plays a cross-origin recording.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { canTap, player, untap, usePlayer } from "@/lib/client/player";
import { narrator } from "@/lib/tts/narrator";
import { IconClose, IconLoop, IconNext, IconPause, IconPlay, IconPrev } from "@/components/ui/Icons";
import { TtsBar, useTtsActive } from "@/components/tts/TtsBar";
import { AiBadge } from "@/components/tts/TtsBits";
import { NadaString } from "@/components/reader/NadaString";

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");

export function PlayerBar() {
  const st = usePlayer();
  const ref = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState({ pos: 0, dur: 0 });
  const track = st.queue[st.index] ?? null;
  const tts = useTtsActive();
  const kind = track && canTap(track.src) ? "tap" : "plain";
  // Narration belongs to the page it was started on: going to another passage stops it (and drops what is queued).
  const path = usePathname();
  useEffect(() => narrator.leave(path), [path]);

  // Load the current track (a segment of a whole recording seeks to its start).
  useEffect(() => {
    const a = ref.current;
    if (!a || !track) return;
    if (a.dataset.src !== track.src) {
      a.src = track.src;
      a.dataset.src = track.src;
    }
    if (track.start !== undefined) a.currentTime = track.start;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.src, track?.id, st.index, kind]);
  useEffect(() => {
    const a = ref.current;
    if (!a || !track) return;
    a.playbackRate = st.rate;
    // An interrupted play() (paused at once, or its element swapped out) is not a broken recording.
    if (st.playing) a.play().catch((e: unknown) => ref.current === a && (e as Error)?.name !== "AbortError" && player.fail("Recording unavailable"));
    else a.pause();
  }, [st.playing, st.rate, track, kind]);
  // An element leaving (the source kind changed): release its Web Audio nodes, if it had any.
  useEffect(() => {
    const a = ref.current;
    return () => {
      if (a) untap(a);
    };
  }, [kind]);

  const onTime = () => {
    const a = ref.current!;
    const start = track?.start ?? 0;
    const end = track?.end ?? a.duration;
    setT({ pos: a.currentTime - start, dur: end - start });
    if (track?.end !== undefined && a.currentTime >= track.end) onEnded();
  };
  const onEnded = () => {
    const a = ref.current!;
    if (st.loop) {
      a.currentTime = track?.start ?? 0;
      a.play().catch(() => {});
    } else player.next();
  };

  // Always first and always the same element for a given kind of source, whether or not a track is queued.
  const audio = track ? (
    <audio key={kind} ref={ref} preload="metadata" onTimeUpdate={onTime} onEnded={onEnded} onError={() => player.fail(track.ai ? "Saved chant unavailable" : "Recording unavailable")} hidden />
  ) : (
    <audio key={kind} ref={ref} preload="none" hidden />
  );
  if (!track)
    return (
      <>
        {audio}
        {tts && <TtsBar />}
      </>
    );
  return (
    <>
    {audio}
    {tts && <TtsBar />}
    <div className="player capture-hide" role="region" aria-label="Audio player" style={tts ? { display: "none" } : undefined}>
      {st.queue.length > 1 && (
        <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={player.prev} disabled={st.index === 0} aria-label="Previous mantra"><IconPrev size={15} /></button>
      )}
      <button className="btn btn-accent btn-icon !h-10 !w-10 !rounded-full" onClick={st.playing ? player.pause : player.resume} aria-label={st.playing ? "Pause" : "Play"}>
        {st.playing ? <IconPause size={16} /> : <IconPlay size={15} />}
      </button>
      {st.queue.length > 1 && (
        <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={player.next} disabled={st.index >= st.queue.length - 1} aria-label="Next mantra"><IconNext size={15} /></button>
      )}
      <div className="min-w-0 flex-1 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold">
            {track.label}
            {st.queue.length > 1 && <span className="font-normal text-text-3"> · {st.index + 1} of {st.queue.length} · {st.title}</span>}
          </p>
          <span className="num shrink-0 text-[11.5px] text-text-3">{st.error ?? `${fmt(t.pos)} / ${fmt(t.dur)}`}</span>
        </div>
        {track.ai && <div className="mt-1"><AiBadge /></div>}
        <NadaString audio={ref} src={track.src} playing={st.playing} start={track.start} end={track.end} pos={t.pos} dur={t.dur} valueText={`${fmt(t.pos)} of ${fmt(t.dur)}`} />
      </div>
      <div className="seg hidden !rounded-[10px] !p-[2px] sm:inline-flex" role="group" aria-label="Speed">
        {([0.75, 1, 1.25] as const).map((r) => (
          <button key={r} aria-pressed={st.rate === r} onClick={() => player.setRate(r)} className="!h-7 !px-2 !text-[12px]">{r}×</button>
        ))}
      </div>
      <button className={`btn btn-icon !h-9 !w-9 ${st.loop ? "btn-accent" : "btn-ghost"}`} onClick={player.toggleLoop} aria-pressed={st.loop} aria-label="Loop this mantra" title={track.ai ? "Loop this AI chant" : "Loop this mantra (chanting practice)"}>
        <IconLoop size={15} />
      </button>
      <button className="btn btn-ghost btn-icon !h-9 !w-9" onClick={player.close} aria-label="Close player"><IconClose size={15} /></button>
    </div>
    </>
  );
}
