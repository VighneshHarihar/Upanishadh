"use client";
// Motion for the Living Plates: one eased tween per plate, an optional ambient clock, both stilled by
// prefers-reduced-motion and by capture mode (html[data-capture="1"]), where every change lands at once.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const still = () => window.matchMedia(QUERY).matches || document.documentElement.dataset.capture === "1";

/** True when motion should be replaced by instant change. */
export function useStill(): boolean {
  return useSyncExternalStore(subscribe, still, () => false);
}

export const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Follows `target` with an eased glide of `ms`; jumps when motion is stilled. */
export function useTween(target: number, ms = 760): number {
  const reduced = useStill();
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduced || cur.current === target) {
      cur.current = target;
      setV(target);
      return;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = clamp((now - t0) / ms);
      cur.current = lerp(from, target, ease(k));
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return v;
}

/** True while the element is on screen (ambient motion runs only then). */
export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on];
}

/**
 * An ambient angle (degrees) that turns at `speed` deg/s and eases between speeds, so a change of speed reads as
 * slowing down rather than a jump. Stops entirely when stilled or off screen.
 */
export function useSpin(speed: number, running: boolean): number {
  const reduced = useStill();
  const [a, setA] = useState(0);
  const st = useRef({ a: 0, v: 0 });
  const live = running && !reduced;
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      s.v += (speed - s.v) * Math.min(1, dt * 1.6);
      s.a = (s.a + s.v * dt) % 360;
      setA(s.a);
      if (Math.abs(s.v) > 0.01 || speed !== 0) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, live]);
  return a;
}
