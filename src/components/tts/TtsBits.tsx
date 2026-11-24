"use client";
// Small shared pieces of the speech UI: the AI chant badge, icons, and the progress line.
import "./tts.css";
import { AI_CHANT_BADGE } from "@/lib/tts/config";

export function AiBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`tts-badge ${className}`} title="Synthesized by an AI model running in this browser. Not a traditional Vedic recitation.">
      {AI_CHANT_BADGE}
    </span>
  );
}

type P = { size?: number; className?: string };
const base = (size = 16) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });
export const IconSpeaker = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconSpark = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" /></svg>
);
export const IconStop = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" /></svg>
);

export function Progress({ pct, label, indeterminate = false }: { pct: number; label: string; indeterminate?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="tts-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : v} data-indeterminate={indeterminate ? "1" : undefined}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

export const fmtMB = (bytes: number) => `${(bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0)} MB`;
