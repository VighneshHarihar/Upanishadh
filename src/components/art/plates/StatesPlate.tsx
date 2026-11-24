"use client";
// Plate IV · The Four States (Māṇḍūkya 3–7). A dial with the three sounded quarters (a, u, m) across its upper arc and
// the Fourth, which has no letter, opposite them. Waking turns outward and keeps moving; dream turns inward and
// slows; in deep sleep the marks gather into one mass; at the Fourth the motion stops and the marks recede, leaving
// the circle and its centre. Arrow keys or the buttons step through the states.
import Link from "next/link";
import { useRef, useState } from "react";
import { PlateFrame, ReadLink } from "./PlateFrame";
import { lerp, useInView, useSpin, useTween } from "./motion";
import type { PlateCommon, StatesData } from "./types";

const C = 220;
const R = 168;
const ANGLES = [-150, -90, -30, 90];
const SPEED = [9, 3.2, 0, 0];
const TICKS = Array.from({ length: 60 }, (_, i) => i);
/** A fixed scatter of lengths, so waking reads as restless attention rather than a clock face. */
const JIT = TICKS.map((k) => {
  const s = Math.sin(k * 12.9898 + 4.1) * 43758.5453;
  return s - Math.floor(s);
});
const ORDINAL = ["first", "second", "third", "fourth"];
const D2R = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;
const polar = (r: number, deg: number): [number, number] => [C + r * Math.cos(deg * D2R), C + r * Math.sin(deg * D2R)];

/** Piecewise-linear value along the four stations for a continuous position p ∈ [0, 3]. */
function at(p: number, values: number[]) {
  const i = Math.min(2, Math.floor(p));
  return lerp(values[i], values[i + 1], p - i);
}

export function StatesPlate({ data, focus, level }: { data: StatesData } & PlateCommon) {
  const st = data.states;
  const initial = Math.max(0, focus === "MaU_6" ? 2 : st.findIndex((x) => x.verse.id === focus));
  const [i, setI] = useState(initial);
  const p = useTween(i, 1000);
  const [ref, visible] = useInView<HTMLDivElement>();
  const spin = useSpin(SPEED[i], visible);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const step = (j: number, focusIt = false) => {
    const k = Math.max(0, Math.min(st.length - 1, j));
    setI(k);
    if (focusIt) btns.current[k]?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: st.length - 1 };
    if (e.key in map) {
      e.preventDefault();
      step(map[e.key], true);
    }
  };

  // The marks: outward and long in waking, inward and short in dream, a dense ring in deep sleep, gone at the Fourth.
  const rIn = at(p, [126, 92, 33, 33]);
  const rOut = at(p, [150, 104, 39, 39]);
  const tickOpacity = at(p, [0.9, 0.62, 0.75, 0]);
  const scatter = at(p, [1, 0.35, 0, 0]);
  const mass = Math.max(0, 1 - Math.abs(p - 2) * 1.5);
  const quiet = Math.max(0, p - 2); // 0 → 1 as the Fourth is reached
  const needle = at(p, ANGLES);
  const tip = polar(R - 26, needle);

  return (
    <PlateFrame numeral="IV" title="The Four States" source="Māṇḍūkya Upaniṣad 3–7" level={level} className="lp-states">
      <div className="lp-split" ref={ref}>
        <div className="lp-split-art">
          <svg className="lp-svg lp-dial" viewBox="0 0 440 440" aria-hidden="true">
            {/* the still circle: the Fourth underlies all three, and alone remains */}
            <circle cx={C} cy={C} r={R} className="lp-dial-ring" style={{ opacity: r1(lerp(0.75, 1, quiet)) }} />
            <circle cx={C} cy={C} r={R} className="lp-dial-ring-gold" style={{ opacity: r1(quiet) }} />
            {/* the marks of experience */}
            <g transform={`rotate(${r1(spin)} ${C} ${C})`} style={{ opacity: r1(tickOpacity) }}>
              {TICKS.map((k) => {
                const a = k * 6;
                const len = 1 - scatter * (0.72 - 0.72 * JIT[k]);
                const [x1, y1] = polar(rIn, a);
                const [x2, y2] = polar(lerp(rIn, rOut, len), a);
                return <line key={k} x1={r1(x1)} y1={r1(y1)} x2={r1(x2)} y2={r1(y2)} className={JIT[k] > 0.72 ? "lp-tick lp-tick-long" : "lp-tick"} />;
              })}
            </g>
            {/* deep sleep: "a mass of consciousness" (prajñānaghana) */}
            <circle cx={C} cy={C} r={30} className="lp-dial-mass" style={{ opacity: r1(mass) }} />
            {/* stations: the three letters above, the measureless Fourth below */}
            {st.map((x, k) => {
              const [sx1, sy1] = polar(R - 7, ANGLES[k]);
              const [sx2, sy2] = polar(R + 7, ANGLES[k]);
              const [lx, ly] = polar(R + 28, ANGLES[k]);
              const here = i === k;
              return (
                <g key={x.key} className="lp-station" data-on={here ? "1" : undefined} onClick={() => step(k)} style={{ opacity: r1(k === 3 ? 1 : lerp(1, 0.32, quiet)) }}>
                  <circle cx={r1(lx)} cy={r1(ly)} r={22} className="lp-hit" />
                  <line x1={r1(sx1)} y1={r1(sy1)} x2={r1(sx2)} y2={r1(sy2)} className="lp-station-tick" />
                  {x.letter ? (
                    <text x={r1(lx)} y={r1(ly + 8)} textAnchor="middle" className="lp-station-letter" lang="sa">{x.letter}</text>
                  ) : (
                    <circle cx={r1(lx)} cy={r1(ly)} r={6} className="lp-station-empty" />
                  )}
                </g>
              );
            })}
            {/* the needle, which falls silent at the Fourth */}
            <g style={{ opacity: r1(1 - quiet) }}>
              <line x1={C} y1={C} x2={r1(tip[0])} y2={r1(tip[1])} className="lp-needle" />
              <circle cx={r1(tip[0])} cy={r1(tip[1])} r={3.2} className="lp-needle-tip" />
            </g>
            <circle cx={C} cy={C} r={lerp(2.6, 3.4, quiet)} className="lp-dial-centre" />
          </svg>
          <div className="lp-steps" role="radiogroup" aria-label="State of consciousness" onKeyDown={onKey}>
            {st.map((x, k) => (
              <button
                key={x.key}
                ref={(el) => {
                  btns.current[k] = el;
                }}
                type="button"
                role="radio"
                aria-checked={i === k}
                tabIndex={i === k ? 0 : -1}
                onClick={() => step(k)}
              >
                {x.letter ? <span className="lp-step-letter" lang="sa">{x.letter}</span> : <span className="lp-step-empty" aria-hidden="true" />}
                <span className="lp-step-name">{x.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="lp-split-text lp-stack" aria-live="polite">
          {st.map((x, k) => (
            <div key={x.key} className="lp-cap-item" data-show={i === k ? "1" : undefined} aria-hidden={i !== k}>
              <p className="lp-cap-kicker"><span className="lp-ref">{x.verse.label}</span> · the {ORDINAL[k]} quarter{x.letter ? ` · ${x.knower}` : ""}</p>
              <p className="lp-cap-title">
                {x.name} <span className="lp-cap-title-en">{x.en}</span>
              </p>
              <p className="lp-sa" lang="sa">{x.verse.sa[0]?.replace(/\s*[।॥].*$/, "")}</p>
              <p className="lp-iast">{x.verse.iast[0]?.replace(/\s*[।॥].*$/, "")}</p>
              {x.verse.tr && <p className="lp-cap-tr">{x.verse.tr}</p>}
              {x.verse.gloss && <p className="lp-gloss"><span className="lp-gloss-by">Śaṅkara</span> {x.verse.gloss}</p>}
              {k === 2 && data.lord.tr && (
                <p className="lp-cap-then">
                  <span className="lp-cap-then-ref">{data.lord.label}</span> <i>{data.lord.iast[0]?.split(/\s+/).slice(0, 2).join(" ")}</i> · {data.lord.tr}
                </p>
              )}
              <div className="lp-cap-links">
                <ReadLink href={x.verse.href} label={x.verse.label} />
                {k === 2 && <ReadLink href={data.lord.href} label={data.lord.label} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="lp-credit">
        The letters a, u and m, and the Fourth that has none, are assigned in <Link href={data.lettersHref}>MaU 9–12</Link>. Translation: {st[0]?.verse.by}. Glosses: {data.glossBy}.
      </p>
    </PlateFrame>
  );
}
