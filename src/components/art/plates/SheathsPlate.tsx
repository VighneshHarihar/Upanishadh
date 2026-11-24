"use client";
// Plate III · The Five Sheaths (Taittirīya 2.1–2.5). A cross-section of five selves, each filled by the one within
// it, around Brahman, the tail that stabilises (2.5). Choosing a layer widens it in the section and opens the line of
// its passage that names it, with a sentence of Śaṅkara on it. Layers take focus; Enter or Space opens one, the
// arrow keys move between them.
import { useId, useRef, useState } from "react";
import { PlateFrame, ReadLink } from "./PlateFrame";
import { useTween } from "./motion";
import type { PlateCommon, SheathsData } from "./types";

const C = 200;
const OUTER = 190;
const CORE = 27;
const BASE = 26;
const GROW = 34;
const r1 = (v: number) => Math.round(v * 100) / 100;
const ORDINAL = ["first", "second", "third", "fourth", "fifth"];
const SHORT_EN: Record<string, string> = { anna: "food", prana: "breath", manas: "mind", vijnana: "understanding", ananda: "bliss" };

const ring = (r: number) => `M${C - r} ${C}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
/** Upper half-circle, left to right (text on it stands upright, outside the line). */
const topArc = (r: number) => `M${r1(C - r)} ${C}A${r1(r)} ${r1(r)} 0 0 1 ${r1(C + r)} ${C}`;
/** Lower half-circle, left to right (text on it stands upright, inside the line). */
const lowArc = (r: number) => `M${r1(C - r)} ${C}A${r1(r)} ${r1(r)} 0 0 0 ${r1(C + r)} ${C}`;

export function SheathsPlate({ data, focus, level }: { data: SheathsData } & PlateCommon) {
  const s = data.sheaths;
  const start = s.findIndex((x) => `TU_${x.ref}` === focus);
  const [sel, setSel] = useState<number | null>(start >= 0 ? start : null);
  const [hover, setHover] = useState<number | null>(null);
  const uid = `lp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const refs = useRef<(SVGGElement | null)[]>([]);
  // One eased weight per layer: the chosen one grows, the others give way, the outer edge stays put.
  const w = [useTween(sel === 0 ? 1 : 0, 820), useTween(sel === 1 ? 1 : 0, 820), useTween(sel === 2 ? 1 : 0, 820), useTween(sel === 3 ? 1 : 0, 820), useTween(sel === 4 ? 1 : 0, 820)];
  const th = w.map((x) => BASE + GROW * x);
  const scale = (OUTER - CORE) / th.reduce((a, b) => a + b, 0);
  const radii: { out: number; inn: number }[] = [];
  let r = OUTER;
  for (const x of th) {
    const inn = r - x * scale;
    radii.push({ out: r, inn });
    r = inn;
  }
  const pick = (i: number) => setSel((cur) => (cur === i ? null : i));
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    const go = (j: number) => {
      e.preventDefault();
      refs.current[(j + s.length) % s.length]?.focus();
    };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(i);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(s.length - 1);
  };

  return (
    <PlateFrame numeral="III" title="The Five Sheaths" source="Taittirīya Upaniṣad 2.1–2.5" level={level} className="lp-sheaths">
      <div className="lp-split">
        <div className="lp-split-art">
          <svg className="lp-svg lp-sheaths-svg" viewBox="0 0 400 400" role="group" aria-label="Five sheaths in cross-section, outermost first. Enter opens a layer.">
            <defs>
              <pattern id={`${uid}-hatch-anna`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" className="lp-hatch" />
              </pattern>
              <pattern id={`${uid}-hatch-prana`} width="16" height="9" patternUnits="userSpaceOnUse">
                <path d="M0 4.5q4 -3 8 0t8 0" className="lp-hatch" />
              </pattern>
              <pattern id={`${uid}-hatch-manas`} width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="4" cy="4" r="0.9" className="lp-hatch-dot" />
              </pattern>
              <pattern id={`${uid}-hatch-vijnana`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" className="lp-hatch" />
                <line x1="0" y1="0" x2="10" y2="0" className="lp-hatch" />
              </pattern>
              {radii.map((b, i) => (
                <g key={i}>
                  <path id={`${uid}-top-${i}`} d={topArc((b.out + b.inn) / 2 - 3.6)} />
                  <path id={`${uid}-low-${i}`} d={lowArc((b.out + b.inn) / 2 + 3.4)} />
                </g>
              ))}
            </defs>
            {radii.map((b, i) => {
              const x = s[i];
              const on = sel === i;
              return (
                <g
                  key={x.key}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className="lp-band"
                  data-on={on ? "1" : undefined}
                  data-hover={hover === i ? "1" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`${x.name}, ${x.en}. ${x.label}`}
                  onClick={() => pick(i)}
                  onKeyDown={onKey(i)}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                >
                  <path className="lp-band-fill" d={`${ring(b.out)}${ring(b.inn)}`} fillRule="evenodd" />
                  {x.key !== "ananda" && <path className="lp-band-hatch" d={`${ring(b.out)}${ring(b.inn)}`} fillRule="evenodd" fill={`url(#${uid}-hatch-${x.key})`} />}
                  <path className="lp-band-edge" d={`${ring(b.out)}${ring(b.inn)}`} fillRule="evenodd" />
                  <text className="lp-band-name">
                    <textPath href={`#${uid}-top-${i}`} startOffset="50%" textAnchor="middle">{x.name.toUpperCase()}</textPath>
                  </text>
                  <text className="lp-band-en">
                    <textPath href={`#${uid}-low-${i}`} startOffset="50%" textAnchor="middle">{x.ref} · {SHORT_EN[x.key]}</textPath>
                  </text>
                </g>
              );
            })}
            <g className="lp-core" aria-hidden="true">
              <circle cx={C} cy={C} r={CORE} className="lp-core-ring" />
              <circle cx={C} cy={C} r={2.4} className="lp-core-dot" />
              <text x={C} y={C + 13} className="lp-core-label" textAnchor="middle">brahman</text>
            </g>
          </svg>
        </div>
        <div className="lp-split-text lp-stack" aria-live="polite">
          <div className="lp-cap-item" data-show={sel === null ? "1" : undefined}>
            <p className="lp-cap-kicker">Taittirīya 2.1–2.5 · Brahmānanda Vallī</p>
            <p className="lp-cap-title">Five selves, each within the last</p>
            <p className="lp-cap-tr">Each passage finds “another inner self” within the last, and says of the outer one, “by that is this one filled” (2.2). At the centre: “Brahman is the tail that stabilises” (<i>brahma pucchaṃ pratiṣṭhā</i>, 2.5).</p>
            {data.centre && <p className="lp-gloss"><span className="lp-gloss-by">Śaṅkara</span> {data.centre}</p>}
            <p className="lp-hint">Choose a layer to open its passage.</p>
          </div>
          {s.map((x, i) => (
            <div key={x.key} className="lp-cap-item" data-show={sel === i ? "1" : undefined} aria-hidden={sel !== i}>
              <p className="lp-cap-kicker"><span className="lp-ref">{x.label}</span> · the {ORDINAL[i]} sheath</p>
              <p className="lp-cap-title">
                {x.name} <span className="lp-deva-inline" lang="sa">{x.deva}</span>
              </p>
              <p className="lp-cap-sub">{x.en}</p>
              <p className="lp-sa" lang="sa">{x.sa}</p>
              <p className="lp-iast">{x.iast}</p>
              {x.gloss && <p className="lp-gloss"><span className="lp-gloss-by">Śaṅkara</span> {x.gloss}</p>}
              <div className="lp-cap-links">
                <ReadLink href={x.href} label={x.label} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="lp-credit">The line shown is the one in each passage that names its sheath. Glosses: {data.glossBy}.</p>
    </PlateFrame>
  );
}
