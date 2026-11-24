"use client";
// Plate I · The Chariot (Kaṭha 1.3.3–9). A plan drawing of the chariot of KaU 1.3.3–4: the Self as its master, the
// intellect driving, the mind as reins, the senses as five horses, their objects as the road. One toggle moves the
// whole drawing between 1.3.5 (horses bolting toward their objects, reins slack) and 1.3.6 (reins taut, the team
// aligned down the road to its end, 1.3.9). Every part is a link to the mantra that names it.
import Link from "next/link";
import { useState } from "react";
import { PlateFrame, ReadLink } from "./PlateFrame";
import { lerp, useTween } from "./motion";
import type { ChariotData, ChariotPart, PlateCommon } from "./types";

type Pt = [number, number];
const D2R = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;
const P = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`;
const rot = (p: Pt, c: Pt, deg: number): Pt => {
  const a = deg * D2R;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};
const toward = (from: Pt, to: Pt, by: number): Pt => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const l = Math.hypot(dx, dy) || 1;
  return [to[0] - (dx / l) * by, to[1] - (dy / l) * by];
};

// ── the model, in the wide drawing's units (720 × 384, travel left to right) ────────────────────────────────
const PIVOT: Pt = [112, 190];
const YOKE_X = 272;
const HORSE_Y = [158, 174, 190, 206, 222];
const HORSE_LEN = 84;
const BIT = 74;
const END: Pt = [672, 190];
/** The objects of the five senses (viṣaya), each where its horse would drag the chariot. */
const OBJECTS: { sa: string; en: string; p: Pt }[] = [
  { sa: "rūpa", en: "form", p: [420, 40] },
  { sa: "śabda", en: "sound", p: [548, 60] },
  { sa: "gandha", en: "smell", p: [560, 300] },
  { sa: "rasa", en: "taste", p: [470, 340] },
  { sa: "sparśa", en: "touch", p: [380, 356] },
];

function model(t: number) {
  const R = (p: Pt) => rot(p, PIVOT, lerp(-4, 0, t));
  const yoke = HORSE_Y.map((y) => R([YOKE_X, y]));
  const dir = yoke.map((y0, i) => {
    const o = OBJECTS[i].p;
    const a = lerp(Math.atan2(o[1] - y0[1], o[0] - y0[0]) / D2R, 0, t) * D2R;
    return [Math.cos(a), Math.sin(a)] as Pt;
  });
  const along = (i: number, d: number): Pt => [yoke[i][0] + dir[i][0] * d, yoke[i][1] + dir[i][1] * d];
  const hands = R([142, 190]);
  const bit = HORSE_Y.map((_, i) => along(i, BIT));
  // Reins bow outward and go slack as control is lost.
  const reins = bit.map((b, i) => {
    const mx = (hands[0] + b[0]) / 2;
    const my = (hands[1] + b[1]) / 2;
    const dx = b[0] - hands[0];
    const dy = b[1] - hands[1];
    const l = Math.hypot(dx, dy) || 1;
    const sag = 20 * (1 - t) * [-1, -0.7, 0.5, 0.8, 1][i];
    return { a: hands, c: [mx - (dy / l) * sag, my + (dx / l) * sag] as Pt, b };
  });
  return {
    t,
    yoke,
    head: HORSE_Y.map((_, i) => along(i, HORSE_LEN)),
    mid: HORSE_Y.map((_, i) => along(i, HORSE_LEN * 0.55)),
    bit,
    reins,
    atman: R([100, 190]),
    buddhi: R([134, 190]),
    hands,
    car: [R([78, 162]), R([146, 162]), R([146, 218]), R([78, 218])],
    wheels: [146, 234].map((y) => [R([89, y - 3.5]), R([135, y - 3.5]), R([135, y + 3.5]), R([89, y + 3.5])]),
    axle: [R([112, 140]), R([112, 240])],
    pole: [R([146, 190]), R([YOKE_X, 190])],
    yokeBar: [R([YOKE_X, 153]), R([YOKE_X, 227])],
    carRear: R([78, 204]),
  };
}
type Model = ReturnType<typeof model>;

// ── two drawings of the one model: wide (travel to the right) and narrow (travel up the page) ───────────────
interface Lab {
  x: number;
  y: number;
  anchor?: "start" | "end";
  sub: string;
  /** Leader line: from this point (drawing units) to a point on the model, stopping `gap` short. */
  from?: Pt;
  to?: (m: Model) => Pt;
  gap?: number;
}
interface Layout {
  key: "wide" | "narrow";
  w: number;
  h: number;
  map: (p: Pt) => Pt;
  labels: Record<Exclude<ChariotPart, "visaya">, Lab>;
  road: { x: number; y: number; rotate?: number };
  obj: { dx: number; dy: number; anchor: "start" | "middle" | "end" }[];
}
const K = 0.78;
const WIDE: Layout = {
  key: "wide",
  w: 720,
  h: 384,
  map: (p) => p,
  labels: {
    atman: { x: 100, y: 34, sub: "rathin · the master", from: [100, 60], to: (m) => m.atman, gap: 10 },
    buddhi: { x: 140, y: 84, sub: "sārathi · the charioteer", from: [140, 110], to: (m) => m.buddhi, gap: 7 },
    indriya: { x: 262, y: 34, sub: "haya · the horses", from: [316, 60], to: (m) => m.mid[0], gap: 6 },
    sarira: { x: 24, y: 300, sub: "ratha · the chariot", from: [40, 286], to: (m) => m.carRear, gap: 0 },
    manas: { x: 150, y: 336, sub: "pragraha · the reins", from: [196, 322], to: (m) => onRein(m, 4, 0.4), gap: 0 },
    padam: { x: 704, y: 98, anchor: "end", sub: "the end of the road", from: [672, 124], to: () => END, gap: 17 },
  },
  road: { x: 420, y: 227 },
  obj: OBJECTS.map(() => ({ dx: 11, dy: 4.5, anchor: "start" as const })),
};
const NARROW: Layout = {
  key: "narrow",
  w: 380,
  h: 556,
  map: (p) => [p[1], (704 - p[0]) * K + 10],
  labels: {
    padam: { x: 214, y: 32, sub: "the end of the road" },
    indriya: { x: 14, y: 362, sub: "haya · horses", from: [82, 358], to: (m) => m.mid[0], gap: 6 },
    buddhi: { x: 14, y: 432, sub: "sārathi · driver", from: [82, 428], to: (m) => m.buddhi, gap: 7 },
    atman: { x: 14, y: 524, sub: "rathin · master", from: [72, 520], to: (m) => m.atman, gap: 10 },
    manas: { x: 264, y: 404, sub: "pragraha · reins", from: [260, 398], to: (m) => onRein(m, 4, 0.42), gap: 0 },
    sarira: { x: 262, y: 524, sub: "ratha · chariot", from: [258, 516], to: (m) => m.carRear, gap: 0 },
  },
  road: { x: 152, y: 186, rotate: -90 },
  obj: [
    { dx: 0, dy: 20, anchor: "middle" },
    { dx: 0, dy: 20, anchor: "middle" },
    { dx: 0, dy: 20, anchor: "middle" },
    { dx: 0, dy: 20, anchor: "middle" },
    { dx: 14, dy: 20, anchor: "end" },
  ],
};

function onRein(m: Model, i: number, s: number): Pt {
  const { a, c, b } = m.reins[i];
  const u = 1 - s;
  return [u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]];
}
const poly = (pts: Pt[]) => `M${pts.map(P).join("L")}Z`;
function capsule(p0: Pt, p1: Pt, w: number) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const l = Math.hypot(dx, dy) || 1;
  const n: Pt = [(-dy / l) * w, (dx / l) * w];
  const a: Pt = [p0[0] + n[0], p0[1] + n[1]];
  const b: Pt = [p1[0] + n[0], p1[1] + n[1]];
  const c: Pt = [p1[0] - n[0], p1[1] - n[1]];
  const d: Pt = [p0[0] - n[0], p0[1] - n[1]];
  return `M${P(a)}L${P(b)}A${w} ${w} 0 0 0 ${P(c)}L${P(d)}A${w} ${w} 0 0 0 ${P(a)}Z`;
}
/** A wheel rut behind the chariot: wavering when the team pulls apart, straight when it is steered. */
function rut(L: Layout, y: number, t: number) {
  const pts: Pt[] = [];
  for (let x = 20; x <= 84; x += 4) pts.push(L.map([x, y + Math.sin(x / 7) * 3.4 * (1 - t)]));
  return `M${pts.map(P).join("L")}`;
}

const NAMES: Record<ChariotPart, { name: string; term: string; role: string; ref: string }> = {
  atman: { name: "Ātman", term: "rathin", role: "the master of the chariot", ref: "1.3.3" },
  buddhi: { name: "Buddhi", term: "sārathi", role: "the charioteer", ref: "1.3.3" },
  manas: { name: "Manas", term: "pragraha", role: "the reins", ref: "1.3.3" },
  sarira: { name: "Śarīra", term: "ratha", role: "the body as the chariot", ref: "1.3.3" },
  indriya: { name: "Indriyas", term: "haya", role: "the senses as horses", ref: "1.3.4" },
  visaya: { name: "Viṣayas", term: "gocara", role: "their objects as the road", ref: "1.3.4" },
  padam: { name: "Paramaṃ padam", term: "adhvanaḥ pāram", role: "the end of the road, Viṣṇu’s highest place", ref: "1.3.9" },
};
const ORDER: ChariotPart[] = ["sarira", "atman", "buddhi", "indriya", "manas", "visaya", "padam"];
const caps = (s: string) => s.toUpperCase();
/** Rough rendered widths (drawing units) for underlines; Inter caps tracked, Source Serif italic. */
const wCaps = (s: string, size: number) => s.length * size * 0.74;

function Drawing({ L, m, on, set, verses }: { L: Layout; m: Model; on: ChariotPart | null; set: (p: ChariotPart | null) => void; verses: ChariotData["verses"] }) {
  const M = L.map;
  const t = m.t;
  const hrefOf = (p: ChariotPart) => verses[NAMES[p].ref]?.href ?? "#";
  const bind = (p: ChariotPart) => ({
    href: hrefOf(p),
    className: "lp-part",
    "data-on": on === p ? "1" : undefined,
    "aria-label": `${NAMES[p].name}, ${NAMES[p].term}: ${NAMES[p].role}. Kaṭha ${NAMES[p].ref}`,
    onPointerEnter: () => set(p),
    onPointerLeave: () => set(null),
    onFocus: () => set(p),
    onBlur: () => set(null),
  });
  const label = (p: Exclude<ChariotPart, "visaya">) => {
    const l = L.labels[p];
    const title = caps(NAMES[p].name);
    const size = L.key === "wide" ? 13.5 : 11.5;
    const tw = wCaps(title, size);
    const end = l.to ? toward(l.from!, M(l.to(m)), l.gap ?? 0) : null;
    return (
      <g className="lp-label">
        {l.from && end && <path className="lp-leader" d={`M${P(l.from)}L${P(end)}`} />}
        {l.from && end && !l.gap && <circle className="lp-leader-dot" cx={r1(end[0])} cy={r1(end[1])} r={1.8} />}
        <text className="lp-lt" x={l.x} y={l.y} textAnchor={l.anchor ?? "start"}>{title}</text>
        <text className="lp-ls" x={l.x} y={l.y + (L.key === "wide" ? 18 : 15.5)} textAnchor={l.anchor ?? "start"}>{l.sub}</text>
        <path className="lp-uline" d={l.anchor === "end" ? `M${l.x - tw} ${l.y + 4}h${tw}` : `M${l.x} ${l.y + 4}h${tw}`} />
      </g>
    );
  };
  const roadEdge = (y: number) => `M${P(M([20, y]))}L${P(M([640, y]))}`;
  const endP = M(END);
  const travelFrom = M([Math.max(...m.head.map((h) => h[0])) + 10, 190]);
  const travelTo = M([END[0] - 20, 190]);

  return (
    <svg className={`lp-svg lp-chariot-${L.key}`} viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label="The chariot of Kaṭha 1.3.3–9, drawn in plan">
      {/* the road and its fields: drawn first, so everything else sits on it */}
      <g className="lp-road" data-on={on === "visaya" ? "1" : undefined} aria-hidden="true">
        <path className="lp-ink-2" d={roadEdge(130)} />
        <path className="lp-ink-2" d={roadEdge(250)} />
        <path className="lp-guide lp-dash" d={`M${P(M([20, 190]))}L${P(M([640, 190]))}`} />
        <path className="lp-ink-3" d={rut(L, 146, t)} />
        <path className="lp-ink-3" d={rut(L, 234, t)} />
      </g>
      {/* the pull of each sense toward its object (1.3.5), fading as the reins are taken up */}
      <g className="lp-pull" style={{ opacity: r1(1 - t) }} aria-hidden="true">
        {OBJECTS.map((o, i) => (
          <path key={o.sa} className="lp-gold-line lp-dash" d={`M${P(M(m.head[i]))}L${P(toward(M(m.head[i]), M(o.p), 8))}`} />
        ))}
      </g>
      {/* the line of travel to the end of the road (1.3.9), drawn in as they align */}
      <path className="lp-gold-line lp-travel" d={`M${P(travelFrom)}L${P(travelTo)}`} style={{ opacity: r1(Math.max(0, t * 1.4 - 0.4)) }} aria-hidden="true" />

      {/* Śarīra · the chariot: body, axle, wheels, pole, yoke */}
      <Link {...bind("sarira")}>
        <path className="lp-ink-2" d={`M${P(M(m.axle[0]))}L${P(M(m.axle[1]))}`} />
        {m.wheels.map((w, i) => <path key={i} className="lp-ink lp-fill" d={poly(w.map(M))} />)}
        <path className="lp-ink lp-fill" d={poly(m.car.map(M))} />
        <path className="lp-ink" d={`M${P(M(m.pole[0]))}L${P(M(m.pole[1]))}`} />
        <path className="lp-ink" d={`M${P(M(m.yokeBar[0]))}L${P(M(m.yokeBar[1]))}`} />
        {label("sarira")}
      </Link>
      {/* Ātman · the master of the chariot, and Buddhi driving: both inside the car */}
      <Link {...bind("atman")}>
        <circle className="lp-hit" cx={r1(M(m.atman)[0])} cy={r1(M(m.atman)[1])} r={13} />
        <circle className="lp-ink lp-fill" cx={r1(M(m.atman)[0])} cy={r1(M(m.atman)[1])} r={7.5} />
        <circle className="lp-solid" cx={r1(M(m.atman)[0])} cy={r1(M(m.atman)[1])} r={2} />
        {label("atman")}
      </Link>
      <Link {...bind("buddhi")}>
        <circle className="lp-hit" cx={r1(M(m.buddhi)[0])} cy={r1(M(m.buddhi)[1])} r={12} />
        <circle className="lp-solid" cx={r1(M(m.buddhi)[0])} cy={r1(M(m.buddhi)[1])} r={4.6} />
        {label("buddhi")}
      </Link>
      {/* Indriyas · the five horses */}
      <Link {...bind("indriya")}>
        {m.yoke.map((y0, i) => (
          <path key={i} className="lp-ink lp-fill" d={capsule(M(y0), M(m.head[i]), 3.3)} />
        ))}
        {label("indriya")}
      </Link>
      {/* Manas · the reins, from the driver’s hands to each bit */}
      <Link {...bind("manas")}>
        {m.reins.map((r, i) => (
          <g key={i}>
            <path className="lp-hit-line" d={`M${P(M(r.a))}Q${P(M(r.c))} ${P(M(r.b))}`} />
            <path className="lp-rein" d={`M${P(M(r.a))}Q${P(M(r.c))} ${P(M(r.b))}`} />
            <circle className="lp-solid" cx={r1(M(r.b)[0])} cy={r1(M(r.b)[1])} r={1.6} />
          </g>
        ))}
        {label("manas")}
      </Link>
      {/* Viṣayas · the road and the objects that line it */}
      <Link {...bind("visaya")}>
        <path className="lp-hit-line" d={roadEdge(130)} />
        <path className="lp-hit-line" d={roadEdge(250)} />
        {OBJECTS.map((o, i) => {
          const c = M(o.p);
          const d = L.obj[i];
          return (
            <g key={o.sa} className="lp-object" style={{ opacity: r1(lerp(1, 0.55, t)) }}>
              <circle className="lp-hit" cx={r1(c[0])} cy={r1(c[1])} r={12} />
              <circle className="lp-ink lp-fill" cx={r1(c[0])} cy={r1(c[1])} r={4} />
              <text className="lp-os" x={r1(c[0] + d.dx)} y={r1(c[1] + d.dy)} textAnchor={d.anchor}>
                {o.sa} <tspan className="lp-oe">· {o.en}</tspan>
              </text>
            </g>
          );
        })}
        <text className="lp-road-label" x={L.road.x} y={L.road.y} transform={L.road.rotate ? `rotate(${L.road.rotate} ${L.road.x} ${L.road.y})` : undefined} textAnchor={L.road.rotate ? "middle" : "start"}>
          <tspan className="lp-lt">VIṢAYAS</tspan>
          <tspan className="lp-ls" dx={8}>gocara · the road</tspan>
        </text>
      </Link>
      {/* the end of the road · tad viṣṇoḥ paramaṃ padam */}
      <Link {...bind("padam")}>
        <circle className="lp-hit" cx={r1(endP[0])} cy={r1(endP[1])} r={20} />
        <circle className="lp-end" cx={r1(endP[0])} cy={r1(endP[1])} r={14} style={{ opacity: r1(lerp(0.55, 1, t)) }} />
        <circle className="lp-end" cx={r1(endP[0])} cy={r1(endP[1])} r={7} style={{ opacity: r1(lerp(0.4, 1, t)) }} />
        <circle className="lp-end-dot" cx={r1(endP[0])} cy={r1(endP[1])} r={2.6} />
        {label("padam")}
      </Link>
    </svg>
  );
}

export function ChariotPlate({ data, focus, level }: { data: ChariotData } & PlateCommon) {
  const steeredFirst = focus ? ["KaU_1.3.6", "KaU_1.3.8", "KaU_1.3.9"].includes(focus) : false;
  const [steered, setSteered] = useState(steeredFirst);
  const [on, setOn] = useState<ChariotPart | null>(null);
  const t = useTween(steered ? 1 : 0, 1100);
  const m = model(t);
  const v = data.verses;
  const modeVerse = steered ? v["1.3.6"] : v["1.3.5"];
  const outcome = steered ? v["1.3.9"] : v["1.3.7"];

  return (
    <PlateFrame numeral="I" title="The Chariot" source="Kaṭha Upaniṣad 1.3.3–9" level={level} className="lp-chariot">
      <div className="lp-controls" role="group" aria-label="How the chariot is driven">
        <div className="lp-seg">
          <button type="button" aria-pressed={!steered} onClick={() => setSteered(false)}>
            Unrestrained <span className="lp-seg-ref">1.3.5</span>
          </button>
          <button type="button" aria-pressed={steered} onClick={() => setSteered(true)}>
            Steered <span className="lp-seg-sub">(Sārathi)</span> <span className="lp-seg-ref">1.3.6</span>
          </button>
        </div>
        <p className="lp-hint">Every part of the drawing opens its mantra.</p>
      </div>
      <div className="lp-stage">
        <Drawing L={WIDE} m={m} on={on} set={setOn} verses={v} />
        <Drawing L={NARROW} m={m} on={on} set={setOn} verses={v} />
      </div>
      {/* One caption cell holds every reading, so the plate never changes height as the reader explores. */}
      <div className="lp-cap lp-stack">
        {ORDER.map((p) => {
          const n = NAMES[p];
          const verse = v[n.ref];
          return (
            <div key={p} className="lp-cap-item" data-show={on === p ? "1" : undefined} aria-hidden={on !== p}>
              <p className="lp-cap-kicker"><span className="lp-ref">{verse?.label}</span> · <i>{n.term}</i></p>
              <p className="lp-cap-title">{n.name}, {n.role}</p>
              {data.parts[p] && <p className="lp-gloss"><span className="lp-gloss-by">Śaṅkara</span> {data.parts[p]}</p>}
            </div>
          );
        })}
        <div className="lp-cap-item" data-show={on === null ? "1" : undefined} aria-live="polite">
          {modeVerse && (
            <>
              <p className="lp-cap-kicker"><span className="lp-ref">{modeVerse.label}</span> · <i>{modeVerse.iast[0]?.replace(/[।॥].*$/, "").trim()}</i></p>
              <p className="lp-cap-tr">{modeVerse.tr}</p>
              {outcome?.tr && (
                <p className="lp-cap-then">
                  <span className="lp-cap-then-ref">{outcome.label}</span> {outcome.tr}
                </p>
              )}
              <div className="lp-cap-links">
                <ReadLink href={modeVerse.href} label={modeVerse.label} />
                {outcome && <ReadLink href={outcome.href} label={outcome.label} />}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="lp-credit">Glosses: {data.glossBy}. Translation: {v["1.3.5"]?.by}.</p>
    </PlateFrame>
  );
}
