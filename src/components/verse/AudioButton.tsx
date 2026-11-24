"use client";
// Per-mantra chant, played through the site-wide player (speed, loop, continue). Renders nothing when a passage has
// no recording, so there is never a dead play button.
import { player, usePlayer } from "@/lib/client/player";
import { IconPause, IconPlay } from "@/components/ui/Icons";

export function AudioButton({ src, label = "Chant", className = "", track }: { src: string | null | undefined; label?: string; className?: string; track?: { id: string; label: string } }) {
  const st = usePlayer();
  if (!src) return null;
  const cur = st.queue[st.index];
  const mine = cur?.src === src;
  const playing = mine && st.playing;
  return (
    <button
      type="button"
      className={`btn btn-sm ${playing ? "btn-accent" : ""} ${className}`}
      onClick={() => player.toggle({ id: track?.id ?? src, label: track?.label ?? label, src })}
      aria-pressed={playing}
      data-audio={src}
    >
      {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
      {mine && st.error ? "Recording unavailable" : label}
    </button>
  );
}
