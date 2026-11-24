"use client";
// Nāda: the chant player's position as one hairline string, stretched between two bridges. The played length is gold
// ink, the rest a quiet rule. While the chant sounds the string resonates (a few standing-wave modes, never more than
// a few pixels); paused, it rings down and lies still. Its voice comes from a Web Audio analyser when the source may
// be read (same-origin or a blob: AI chant), otherwise from a smooth harmonic function of currentTime, so it never
// freezes and never silences a cross-origin recording. Reduced motion: no oscillation, position only.
// It is the seek control: click or drag anywhere on it, or use the arrow keys (role="slider").
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { analyserFor } from "@/lib/client/player";
import "./nada.css";

const H = 22; // the string's hit area (px); it rests on the midline
const MID = H / 2;
const AMP = 3; // largest displacement at full voice (px)
const MODES = [
  { f: 1.55, w: 1, th: 0 },
  { f: 2.85, w: 0.42, th: 1.9 },
  { f: 4.05, w: 0.22, th: 4.1 },
  { f: 5.45, w: 0.12, th: 0.7 },
];
const BANDS: [number, number][] = [[80, 320], [320, 900], [900, 2600], [2600, 7000]];
const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Cross-origin chants: a slow, breathing envelope and timbre, deterministic in the recording's time. */
function harmonic(t: number, w: number[]) {
  const env = 0.6 + 0.22 * Math.sin(TAU * 0.17 * t + 0.6) + 0.11 * Math.sin(TAU * 0.53 * t + 2.1) + 0.06 * Math.sin(TAU * 1.31 * t);
  for (let k = 0; k < MODES.length; k++) w[k] = MODES[k].w * (0.72 + 0.28 * Math.sin(TAU * (0.11 + 0.08 * k) * t + k * 1.7));
  return clamp(env);
}

const query = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(subscribeMotion, () => matchMedia(query).matches, () => false);

interface Props {
  audio: RefObject<HTMLAudioElement | null>;
  src: string;
  playing: boolean;
  /** Segment bounds inside a whole-text recording (seconds). */
  start?: number;
  end?: number;
  /** Position and length as last reported by the element (for ARIA and the resting string). */
  pos: number;
  dur: number;
  valueText: string;
}

export function NadaString({ audio, src, playing, start = 0, end, pos, dur, valueText }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const played = useRef<SVGPathElement>(null);
  const rest = useRef<SVGPathElement>(null);
  const bead = useRef<SVGCircleElement>(null);
  const bridgeR = useRef<SVGLineElement>(null);
  const reduced = useReducedMotion();
  const live = useRef({ width: 0, amp: 0, phase: 0, w: MODES.map((m) => m.w), raf: 0, td: new Uint8Array(0), fd: new Uint8Array(0) });
  const fallback = useRef({ pos, dur });
  fallback.current = { pos, dur };

  const length = () => {
    const a = audio.current;
    const d = (end ?? a?.duration ?? NaN) - start;
    return Number.isFinite(d) && d > 0 ? d : fallback.current.dur;
  };
  const progress = () => {
    const a = audio.current;
    const d = length();
    if (!(d > 0)) return 0;
    return clamp(((a ? a.currentTime : start + fallback.current.pos) - start) / d);
  };

  /** Draw the string at progress p, displaced by amp (px) with mode weights w at phase time t. */
  const draw = (p: number, amp: number) => {
    const L = live.current;
    const W = L.width;
    if (!W || !played.current || !rest.current || !bead.current) return;
    const y = (u: number) => {
      if (amp < 0.01) return MID;
      let s = 0;
      for (let k = 0; k < MODES.length; k++) s += L.w[k] * Math.sin((k + 1) * Math.PI * u) * Math.sin(TAU * MODES[k].f * L.phase + MODES[k].th);
      return MID + amp * s;
    };
    const n = Math.max(24, Math.round(W / 5));
    const xp = p * W;
    const yp = y(p);
    let a = `M0 ${MID}`;
    let b = `M${xp.toFixed(2)} ${yp.toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      const x = (i / n) * W;
      const seg = ` L${x.toFixed(2)} ${y(i / n).toFixed(2)}`;
      if (x < xp) a += seg;
      else b += seg;
    }
    a += ` L${xp.toFixed(2)} ${yp.toFixed(2)}`;
    b += ` L${W} ${MID}`;
    played.current.setAttribute("d", a);
    rest.current.setAttribute("d", b);
    bead.current.setAttribute("cx", xp.toFixed(2));
    bead.current.setAttribute("cy", yp.toFixed(2));
  };
  const paint = () => draw(progress(), live.current.amp * AMP);

  // Measure: the viewBox follows the element's width so strokes and the bead are drawn at true pixels.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const W = Math.max(1, Math.round(e.contentRect.width));
      live.current.width = W;
      el.setAttribute("viewBox", `0 0 ${W} ${H}`);
      bridgeR.current?.setAttribute("x1", String(W - 0.5));
      bridgeR.current?.setAttribute("x2", String(W - 0.5));
      paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The resting string follows the reported position (seeks while paused, track changes).
  useEffect(() => {
    if (!live.current.raf) paint();
  });

  // Resonance: runs while playing and while ringing down after a pause; otherwise no frames at all.
  useEffect(() => {
    const L = live.current;
    let prev = performance.now();
    const w = MODES.map((m) => m.w);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const a = audio.current;
      const sounding = playing && !reduced && !!a && !a.paused && !a.ended;
      let target = 0;
      if (sounding && a) {
        // Phase time: the recording's own clock, smoothed between its updates, re-synced after a seek.
        L.phase += dt * a.playbackRate;
        if (Math.abs(L.phase - a.currentTime) > 0.3) L.phase = a.currentTime;
        const an = analyserFor(a, src);
        if (an) {
          if (L.td.length !== an.fftSize) L.td = new Uint8Array(an.fftSize);
          if (L.fd.length !== an.frequencyBinCount) L.fd = new Uint8Array(an.frequencyBinCount);
          an.getByteTimeDomainData(L.td);
          an.getByteFrequencyData(L.fd);
          let sum = 0;
          for (let i = 0; i < L.td.length; i++) {
            const v = (L.td[i] - 128) / 128;
            sum += v * v;
          }
          target = clamp(Math.pow(Math.sqrt(sum / L.td.length) * 5, 0.75));
          const hz = an.context.sampleRate / an.fftSize;
          const e = BANDS.map(([lo, hi]) => {
            let s = 0;
            let c = 0;
            for (let i = Math.floor(lo / hz); i <= Math.min(L.fd.length - 1, Math.ceil(hi / hz)); i++, c++) s += L.fd[i];
            return c ? s / c / 255 : 0;
          });
          const top = Math.max(0.001, ...e);
          for (let k = 0; k < MODES.length; k++) w[k] = MODES[k].w * (0.3 + 0.7 * (e[k] / top));
        } else {
          target = harmonic(L.phase, w);
        }
      } else {
        L.phase += dt; // ring down in its own time
      }
      L.amp += (target - L.amp) * (1 - Math.exp(-dt / (target > L.amp ? 0.09 : 0.32)));
      const kw = 1 - Math.exp(-dt / 0.25);
      for (let k = 0; k < MODES.length; k++) L.w[k] += (w[k] - L.w[k]) * kw;
      if (reduced) L.amp = 0;
      draw(progress(), L.amp * AMP);
      if (sounding || playing || L.amp > 0.004) L.raf = requestAnimationFrame(tick);
      else {
        L.amp = 0;
        L.raf = 0;
        paint();
      }
    };
    L.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(L.raf);
      L.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced, src, start, end]);

  const seekTo = (t: number) => {
    const a = audio.current;
    const d = length();
    if (!a || !(d > 0)) return;
    a.currentTime = clamp(t, start, start + d - 0.05);
    if (!live.current.raf) paint();
  };
  const seekAt = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (r && r.width) seekTo(start + clamp((clientX - r.left) / r.width) * length());
  };

  return (
    <div
      className="nada"
      role="slider"
      tabIndex={0}
      aria-label="Position"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur) || 0}
      aria-valuenow={Math.round(pos)}
      aria-valuetext={valueText}
      data-playing={playing ? "1" : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
      }}
      onKeyDown={(e) => {
        const a = audio.current;
        if (!a) return;
        const step = ({ ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 } as Record<string, number>)[e.key];
        if (step) seekTo(a.currentTime + step);
        else if (e.key === "Home") seekTo(start);
        else if (e.key === "End") seekTo(start + length());
        else return;
        e.preventDefault();
      }}
    >
      <svg ref={svg} height={H} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line className="nada-bridge" x1="0.5" x2="0.5" y1={MID - 3.5} y2={MID + 3.5} />
        <line ref={bridgeR} className="nada-bridge" x1="0" x2="0" y1={MID - 3.5} y2={MID + 3.5} />
        <path ref={rest} className="nada-rest" d={`M0 ${MID}`} />
        <path ref={played} className="nada-played" d={`M0 ${MID}`} />
        <circle ref={bead} className="nada-bead" r="2.25" cx="0" cy={MID} />
      </svg>
    </div>
  );
}
