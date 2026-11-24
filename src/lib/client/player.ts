"use client";
// One audio player for the whole site: a single mantra, a queue (a chapter, a whole Upanishad mantra by mantra), or
// a whole-text recording; with speed and a loop for chanting practice. The <audio> element lives in <PlayerBar>.
// Only one thing speaks at a time: the player, the narrator and the AI chant each claim the speaker, and claiming it
// stops whoever held it.
import { useSyncExternalStore } from "react";

export interface Track {
  id: string;
  label: string;
  src: string;
  /** Offsets inside a whole-text recording, if this track is one segment of it. */
  start?: number;
  end?: number;
  /** A synthesized chant (Vāgdhenu), never a human recording: the player badges it. */
  ai?: boolean;
}
export interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  rate: 0.75 | 1 | 1.25;
  loop: boolean;
  title: string;
  error: string | null;
}

// ── the speaker: one owner at a time ──────────────────────────────────────────────────────────────
let holder: { owner: string; stop: () => void } | null = null;
/** Take the speaker; whoever held it is told to stop. */
export function claimAudio(owner: string, stop: () => void) {
  if (holder && holder.owner !== owner) {
    const h = holder;
    holder = null;
    h.stop();
  }
  holder = { owner, stop };
}
export function releaseAudio(owner: string) {
  if (holder?.owner === owner) holder = null;
}

// ── nāda: an optional Web Audio tap, so the player's string can follow the voice ──────────────────
// Only sources this page may read are tapped: same-origin files and blob: URLs (saved AI chants). Cross-origin
// recordings (the S3 chants, served without CORS headers) are never routed through Web Audio, because a
// MediaElementSource on them outputs silence; the string follows their currentTime instead. One AudioContext,
// made on the first gesture that plays a readable source; one MediaElementSource per <audio> element, ever.
let actx: AudioContext | null = null;
const taps = new WeakMap<HTMLMediaElement, { node: MediaElementAudioSourceNode; analyser: AnalyserNode } | null>();
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** May this source be read by Web Audio without silencing it? */
export function canTap(src: string | null | undefined): boolean {
  if (!src || typeof window === "undefined") return false;
  if (src.startsWith("blob:")) return true;
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
/** Called while handling the gesture that starts playback: create or resume the one AudioContext, if it is needed. */
function primeTap(src: string | undefined) {
  if (!canTap(src) || reducedMotion()) return;
  if (!actx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
    } catch {
      return;
    }
  }
  if (actx.state !== "running") actx.resume().catch(() => {});
}
/** The analyser behind this element, wiring it on first use while the context runs; null means "use currentTime". */
export function analyserFor(el: HTMLMediaElement, src: string): AnalyserNode | null {
  const t = taps.get(el);
  if (t !== undefined) return t?.analyser ?? null;
  if (!canTap(src) || !actx || actx.state !== "running") return null;
  try {
    const node = actx.createMediaElementSource(el);
    const analyser = actx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    node.connect(analyser);
    analyser.connect(actx.destination);
    taps.set(el, { node, analyser });
    return analyser;
  } catch {
    taps.set(el, null);
    return null;
  }
}
/** An element leaving the page: free its nodes (it keeps its mark, so it can never be given a second source). */
export function untap(el: HTMLMediaElement) {
  const t = taps.get(el);
  if (!t) return;
  t.node.disconnect();
  t.analyser.disconnect();
}

let state: PlayerState = { queue: [], index: 0, playing: false, rate: 1, loop: false, title: "", error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  if (patch.playing) {
    claimAudio("player", () => set({ playing: false }));
    primeTap(state.queue[state.index]?.src);
  }
  listeners.forEach((l) => l());
};
export const usePlayer = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
export const current = () => state.queue[state.index] ?? null;
export const player = {
  get: () => state,
  /** Play one mantra, or toggle it if it is already the current track. */
  toggle(t: Track) {
    const cur = current();
    if (cur?.src === t.src && cur.id === t.id) set({ playing: !state.playing });
    else set({ queue: [t], index: 0, playing: true, title: t.label, error: null });
  },
  playQueue(queue: Track[], title: string, from = 0) {
    if (!queue.length) return;
    set({ queue, index: from, playing: true, title, error: null });
  },
  pause: () => set({ playing: false }),
  resume: () => set({ playing: true }),
  next() {
    if (state.index + 1 < state.queue.length) set({ index: state.index + 1, playing: true });
    else set({ playing: false });
  },
  prev: () => set({ index: Math.max(0, state.index - 1), playing: true }),
  setRate: (rate: PlayerState["rate"]) => set({ rate }),
  toggleLoop: () => set({ loop: !state.loop }),
  fail: (error: string) => set({ error, playing: false }),
  close: () => {
    releaseAudio("player");
    set({ queue: [], index: 0, playing: false, title: "", error: null });
  },
};
