"use client";
// Plate II · The Golden Lid (Īśā 15). "The face of truth is covered with a golden vessel": a flat brass disc lies over
// the verse. Drag it aside (pointer), or press the button (keyboard), and the line it hides is read. The same plate,
// compact and without its frame, is the ornament in the header of /harness.
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { PlateFrame, ReadLink } from "./PlateFrame";
import { clamp } from "./motion";
import type { LidData, PlateCommon } from "./types";

/** Two balanced lines from one verse line (danda and verse number removed); `from` starts at the word containing it. */
function twoLines(line: string, from?: string): [string, string] {
  const all = line.replace(/[।॥|]+.*$/, "").trim().split(/\s+/);
  const at = from ? all.findIndex((w) => w.includes(from)) : -1;
  const words = at > 0 ? all.slice(at) : all;
  let best = 1;
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < diff) [best, diff] = [i, d];
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}
const clean = (line: string) => line.replace(/\s*[।॥|]+.*$/, "").trim();

const RAYS = Array.from({ length: 48 }, (_, i) => i);

function Disc() {
  return (
    <svg viewBox="-50 -50 100 100" className="lp-disc-svg" aria-hidden="true">
      <circle r={49.4} className="lp-disc-face" />
      <circle r={45.5} className="lp-disc-engrave" />
      <circle r={33} className="lp-disc-engrave" />
      {RAYS.filter((i) => i % 2 === 0).map((i) => {
        const a = (i / 48) * Math.PI * 2;
        return <line key={i} className="lp-disc-engrave" x1={Math.cos(a) * 36} y1={Math.sin(a) * 36} x2={Math.cos(a) * (i % 4 === 0 ? 42 : 39.5)} y2={Math.sin(a) * (i % 4 === 0 ? 42 : 39.5)} />;
      })}
      <circle r={7} className="lp-disc-engrave" />
      <circle r={1.8} className="lp-disc-boss" />
    </svg>
  );
}

export function GoldenLidPlate({ data, compact = false, tone, level }: { data: LidData; compact?: boolean; tone?: "art" } & PlateCommon) {
  const v = data.verse;
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const st = useRef({ x: 0, k: 0, w: 1, moved: false });
  const face = useId();
  const k = drag ?? (open ? 1 : 0);
  /** The verse counts as uncovered once the lid is more than half aside, mid-drag included. */
  const shown = k > 0.5;
  // The compact aperture is small: it holds the line's second half, "the face of truth, covered".
  const [l1, l2] = twoLines(v.sa[0] ?? "", compact ? "सत्य" : undefined);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    st.current = { x: e.clientX, k: open ? 1 : 0, w: e.currentTarget.getBoundingClientRect().width * 0.9, moved: false };
    setDrag(open ? 1 : 0);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const dx = e.clientX - st.current.x;
    if (Math.abs(dx) > 3) st.current.moved = true;
    setDrag(clamp(st.current.k + dx / st.current.w));
  };
  const onUp = () => {
    if (drag === null) return;
    const was = st.current.k === 1;
    // A tap toggles; a drag settles to whichever side it was carried past a quarter of the way.
    setOpen(st.current.moved ? (was ? drag > 0.75 : drag > 0.25) : !was);
    setDrag(null);
  };

  const stage = (
    <div className="lp-lid-stage" data-open={shown ? "1" : undefined} data-drag={drag !== null ? "1" : undefined} style={{ "--k": k } as React.CSSProperties}>
      <svg className="lp-lid-rays" viewBox="-100 -100 200 200" aria-hidden="true">
        {RAYS.map((i) => {
          const a = (i / 48) * Math.PI * 2;
          const r2 = i % 4 === 0 ? 96 : i % 2 === 0 ? 90 : 86;
          return <line key={i} x1={Math.cos(a) * 80} y1={Math.sin(a) * 80} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} />;
        })}
        <circle r={73.5} className="lp-lid-rim" />
      </svg>
      <div className="lp-lid-rest" aria-hidden="true" />
      <div className="lp-lid-face" id={face}>
        <p className="lp-lid-deva" lang="sa">
          <span>{l1}</span>
          <span>{l2}</span>
        </p>
      </div>
      <div className="lp-lid-disc" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} title={open ? "Drag back to cover" : "Drag aside to uncover"}>
        <Disc />
      </div>
    </div>
  );
  const button = (
    <button type="button" className="lp-btn" aria-pressed={open} aria-controls={face} onClick={() => setOpen(!open)}>
      {open ? "Cover again" : <>Uncover <span className="lp-btn-sa">apāvṛṇu</span></>}
    </button>
  );

  if (compact) {
    return (
      <figure className="lp lp-lid lp-lid-compact" data-theme={tone === "art" ? "dark" : undefined} aria-label="The golden lid, Īśā Upaniṣad 15">
        {stage}
        <figcaption className="lp-lid-compact-text">
          <p className="lp-eyebrow">
            <span>The golden lid</span>
            <Link href={v.href} className="lp-eyebrow-src lp-eyebrow-link">Īśā 15 →</Link>
          </p>
          <p className="lp-lid-iast">{clean(v.iast[0] ?? "")}</p>
          <p className="lp-lid-en">{data.veiled}</p>
          <div className="lp-lid-row">{button}</div>
        </figcaption>
      </figure>
    );
  }

  return (
    <PlateFrame numeral="II" title="The Golden Lid" source="Īśā Upaniṣad 15" level={level} className="lp-lid">
      <div className="lp-lid-body">
        <div className="lp-lid-art">
          {stage}
          <p className="lp-hint">Drag the lid aside, or use the button.</p>
        </div>
        <div className="lp-lid-text">
          <div className="lp-lid-line" data-open={shown ? "1" : undefined}>
            <p className="lp-lid-iast">{clean(v.iast[0] ?? "")}</p>
            <p className="lp-lid-en">{data.veiled}</p>
          </div>
          <div className="lp-lid-row">{button}</div>
          <div className="lp-lid-prayer" data-open={shown ? "1" : undefined}>
            <p className="lp-lid-iast lp-lid-iast-2">{clean(v.iast[1] ?? "")}</p>
            <p className="lp-lid-en">{data.prayer}</p>
          </div>
          {v.gloss && <p className="lp-gloss"><span className="lp-gloss-by">Śaṅkara</span> {v.gloss}</p>}
          <div className="lp-cap-links">
            <ReadLink href={v.href} label={v.label} />
          </div>
          <p className="lp-credit">Translation: {v.by}. Gloss: {data.glossBy}.</p>
        </div>
      </div>
    </PlateFrame>
  );
}
