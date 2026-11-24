"use client";
// Video capture support. ?capture=1 hides hints and transitions (handled in CSS via html[data-capture]);
// pages call useReady(condition) and, once fonts are loaded and the condition holds, the document reports
// window.__ready = true and <html data-ready="1"> for the recorder to wait on.
import { useEffect } from "react";

declare global {
  interface Window {
    __ready?: boolean;
    __replayDone?: boolean;
  }
}

export const isCapture = () => typeof document !== "undefined" && document.documentElement.dataset.capture === "1";

export function useReady(condition: boolean) {
  useEffect(() => {
    if (!condition) return;
    let live = true;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!live) return;
      requestAnimationFrame(() => {
        window.__ready = true;
        document.documentElement.dataset.ready = "1";
      });
    });
    return () => {
      live = false;
    };
  }, [condition]);
}

export function markReplayDone() {
  window.__replayDone = true;
  document.documentElement.dataset.replayDone = "1";
}

/** ?pace=realtime|fast|instant (default realtime on run pages; capture mode respects it exactly). */
export function readPace(fallback: Pace = "realtime"): Pace {
  if (typeof window === "undefined") return fallback;
  const p = new URLSearchParams(window.location.search).get("pace");
  return p === "fast" || p === "instant" || p === "realtime" ? p : fallback;
}
export type Pace = "realtime" | "fast" | "instant";
