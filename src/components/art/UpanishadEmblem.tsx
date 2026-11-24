// Thirteen emblems, one per Principal Upanishad: flat single-weight line drawings on a 64-unit square, each in the
// current ink with exactly one stroke in gold (the image the text turns on). Pure markup, no hooks: server pages,
// client views, the share card (via emblemSvg) and the edge OG route all draw from the same geometry below.

const VB = 64;
const WEIGHT = 1.25;

// ── geometry helpers (path data strings in viewBox units) ─────────────────────────────────────────────
const n = (v: number) => String(Math.round(v * 100) / 100);
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
const circle = (cx: number, cy: number, r: number) => `M${pt(cx - r, cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;
const line = (x1: number, y1: number, x2: number, y2: number) => `M${pt(x1, y1)}L${pt(x2, y2)}`;
const ray = (cx: number, cy: number, r1: number, r2: number, deg: number) => line(...polar(cx, cy, r1, deg), ...polar(cx, cy, r2, deg));
/** An arc of a circle from one angle to another (degrees, clockwise on screen). */
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M${pt(x1, y1)}A${n(r)} ${n(r)} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(x2, y2)}`;
};
const range = (k: number) => Array.from({ length: k }, (_, i) => i);

/** A plain weave: `k` warp and `k` weft threads; a thread breaks where it passes under another. */
function weave(k: number, step: number, reach: number, gap: number) {
  const c = VB / 2;
  const at = (i: number) => c + (i - (k - 1) / 2) * step;
  const thread = (i: number, horizontal: boolean) => {
    const under = range(k).filter((j) => ((i + j) % 2 === 0) !== horizontal).map(at);
    const cuts = [c - reach, ...under.flatMap((u) => [u - gap, u + gap]), c + reach];
    return range(cuts.length / 2)
      .map((s) => (horizontal ? line(cuts[2 * s], at(i), cuts[2 * s + 1], at(i)) : line(at(i), cuts[2 * s], at(i), cuts[2 * s + 1])))
      .join("");
  };
  return { warp: range(k).map((i) => thread(i, false)), weft: range(k).map((i) => thread(i, true)) };
}

/** An Archimedean spiral, unwinding outward from (cx, cy). */
function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, startDeg: number) {
  const steps = Math.round(turns * 36);
  return range(steps + 1)
    .map((i) => {
      const t = i / steps;
      const [x, y] = polar(cx, cy, r0 + (r1 - r0) * t, startDeg + t * turns * 360);
      return `${i ? "L" : "M"}${pt(x, y)}`;
    })
    .join("");
}

/** Catmull-Rom through the points, as cubic Béziers: a smooth hand-drawn line from a few anchors. */
function smooth(points: [number, number][]) {
  let d = `M${pt(...points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    d += `C${pt(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${pt(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${pt(...p2)}`;
  }
  return d;
}

/**
 * A candle-still flame standing on (bx, by): round at the root, its sides drawing in to a fine tip (`lean` moves the
 * tip sideways). With `core`, a smaller tongue inside.
 */
function flame(bx: number, by: number, h: number, w: number, { lean = 0, core = false } = {}): string {
  const r = w / 2;
  const outline = `M${pt(bx, by)}C${pt(bx - r * 0.62, by)} ${pt(bx - r, by - h * 0.13)} ${pt(bx - r, by - h * 0.3)}C${pt(bx - r, by - h * 0.48)} ${pt(bx - r * 0.2 + lean * 0.5, by - h * 0.6)} ${pt(bx + lean, by - h)}C${pt(bx + r * 0.2 + lean * 0.5, by - h * 0.6)} ${pt(bx + r, by - h * 0.48)} ${pt(bx + r, by - h * 0.3)}C${pt(bx + r, by - h * 0.13)} ${pt(bx + r * 0.62, by)} ${pt(bx, by)}Z`;
  return core ? outline + flame(bx, by - h * 0.13, h * 0.42, w * 0.38, { lean: lean * 0.4 }) : outline;
}

type Seg = [cmd: "M" | "L" | "C" | "Z", ...xy: number[]];
/** Place a drawing given in its own coordinates: rotate `deg` about (ax, ay), scale `k`, and move (ax, ay) to (x, y). */
function place(segs: Seg[], ax: number, ay: number, x: number, y: number, deg = 0, k = 1) {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return segs
    .map(([cmd, ...xy]) => {
      const out: string[] = [];
      for (let i = 0; i < xy.length; i += 2) {
        const dx = (xy[i] - ax) * k;
        const dy = (xy[i + 1] - ay) * k;
        out.push(pt(x + dx * c - dy * s, y + dx * s + dy * c));
      }
      return cmd + out.join(" ");
    })
    .join("");
}

/** A small perching bird facing left: beak, round head, back sweeping to the tail, breast and belly. */
const BIRD: Seg[] = [
  ["M", 40.9, 24.6], ["L", 38.3, 25.9], ["L", 41.2, 26.7],
  ["C", 40.3, 30.4, 40.4, 34.8, 42.8, 38], ["C", 44.6, 40.6, 47.4, 41.4, 50.6, 41],
  ["C", 52.8, 42.6, 55.4, 43.4, 57.2, 43.4], ["C", 55.5, 41.6, 54.6, 39.8, 54, 37.6],
  ["C", 53.4, 32.8, 50.4, 28.5, 47.3, 25.8], ["C", 47.3, 22.6, 45, 20.6, 42.6, 21],
  ["C", 41.4, 21.4, 40.9, 22.8, 40.9, 24.6], ["Z"],
];

/** The river of Kauṣītaki: one bank of a river that narrows as it winds back to the horizon. */
const RIVER: [x: number, y: number, half: number][] = [[27, 58, 11], [35.5, 48.5, 5.4], [30.6, 41.4, 2.8], [32, 37, 1.6]];
const bank = (side: -1 | 1) => smooth(RIVER.map(([x, y, h]) => [x + side * h, y]));

interface Emblem {
  /** Everything drawn in the current ink. */
  base: string[];
  /** The single gold stroke. */
  accent: string;
  /** What the drawing shows, for screen readers and tooltips. */
  motif: string;
}

const WOVEN = weave(4, 10, 22.5, 3);

const EMBLEMS: Record<string, Emblem> = {
  // The face of truth is covered with a golden lid (Īśā 15): the golden disc slides off the radiant sun.
  isha: {
    motif: "a golden lid sliding from the face of the sun",
    base: [circle(30.5, 33.5, 10.5), ...range(12).map((i) => ray(30.5, 33.5, 19.5, i % 2 ? 22 : 24, i * 30))],
    accent: circle(35.5, 28.5, 10.5),
  },
  // Agni could not burn it, Vāyu could not move it (Kena 3): a blade of grass between fire and wind.
  kena: {
    motif: "a blade of grass between fire and wind",
    base: [line(9, 51, 55, 51), flame(17, 48, 22, 11, { lean: 1.4, core: true }), "M40.5 31.5H50.5C54.5 31.5 55.6 26.4 52.4 24.9C50.2 23.9 48.1 25.7 49 27.7", line(43, 38.5, 55, 38.5)],
    accent: "M30.4 51C31 39.5 31.9 27 34.8 14.5C33.6 27.4 33.4 39.8 33.6 51",
  },
  // Naciketas and the chariot (Kaṭha 1.3.3): a spoked wheel beside a quiet flame.
  katha: {
    motif: "a chariot wheel beside a quiet flame",
    base: [line(8, 51, 56, 51), circle(25, 35, 16), circle(25, 35, 3), ...range(8).map((i) => ray(25, 35, 3, 16, i * 45 + 22.5))],
    accent: flame(48.5, 48, 21, 10, { core: true }),
  },
  // Six seekers ask Pippalāda (Praśna): six rays converge on the breath, prāṇa.
  prashna: {
    motif: "six questions converging on the breath",
    base: range(6).map((i) => ray(32, 32, 15.5, 26, i * 60 - 90)),
    accent: spiral(32, 32, 0.8, 9.8, 1.75, -90),
  },
  // Two birds on one tree (Muṇḍaka 3.1.1): one eats the sweet fruit, the other only watches.
  mundaka: {
    motif: "two birds on one branch, one eating, one watching",
    base: ["M6 41.5C22 40.4 42 40.4 58 41.5", place(BIRD, 47.6, 33, 22.5, 32.6, -40), line(27, 39.2, 27, 41), circle(9.6, 38.4, 2.5)],
    accent: place(BIRD, 0, 0, 0, -3) + line(47.6, 38.4, 47.6, 41),
  },
  // Waking, dream and deep sleep, and the fourth that has no mark (Māṇḍūkya 7, 12).
  mandukya: {
    motif: "three states opening into the unmarked fourth",
    base: [7, 13, 19].map((r) => arc(32, 32, r, -40, 220)),
    accent: "M24.5 12.4A9 9 0 0 0 39.5 12.4",
  },
  // The five sheaths, food to bliss (Taittirīya 2.1–5).
  taittiriya: {
    motif: "five sheaths around the self",
    base: [circle(32, 31, 22), circle(32, 31.8, 17.5), circle(32, 32.6, 13), circle(32, 33.4, 8.5)],
    accent: circle(32, 34.2, 4),
  },
  // "Break the seed. What do you see?" "Nothing." (Chāndogya 6.12): the fig split open on the subtlest essence.
  chandogya: {
    motif: "a banyan fig split open around a single seed",
    base: [
      "M29 13C24 13.6 19.6 19 17 24.5C14.6 29.5 13 33 13 38.5C13 46 19.4 51 29 51Z",
      "M35 13C40 13.6 44.4 19 47 24.5C49.4 29.5 51 33 51 38.5C51 46 44.6 51 35 51Z",
      "M29 13C29.3 10.6 30.4 8.8 32 7.8",
    ],
    accent: circle(32, 35, 1.9),
  },
  // Gārgī asks on what the worlds are woven, warp and woof (Bṛhadāraṇyaka 3.8): the imperishable.
  brihadaranyaka: {
    motif: "warp and woof, woven on the imperishable",
    base: [...WOVEN.warp, ...WOVEN.weft.filter((_, i) => i !== 1)],
    accent: WOVEN.weft[1],
  },
  // Prajñānaṃ brahma (Aitareya 3.3): the seeing eye, and the world it holds, a calm horizon.
  aitareya: {
    motif: "an eye holding a calm horizon",
    base: ["M8 32A27.11 27.11 0 0 1 56 32A27.11 27.11 0 0 1 8 32Z", "M24.5 34A7.5 7.5 0 0 1 39.5 34"],
    accent: line(15.5, 34, 48.5, 34),
  },
  // The wheel of Brahman turns; the one who knows it is still (Śvetāśvatara 1.4–6).
  shvetashvatara: {
    motif: "the turning wheel of Brahman around a still axle",
    base: [
      circle(32, 32, 23),
      ...range(8).map((i) => {
        const a = i * 45;
        return `M${pt(...polar(32, 32, 7.5, a))}Q${pt(...polar(32, 32, 16, a + 8))} ${pt(...polar(32, 32, 23, a + 34))}`;
      }),
    ],
    accent: circle(32, 32, 3.6),
  },
  // The path by the moon, and the ageless river crossed by the mind (Kauṣītaki 1).
  kaushitaki: {
    motif: "a waxing moon over a single river",
    base: [line(10, 37, 54, 37), bank(-1), bank(1)],
    accent: "M38 9A9.5 9.5 0 0 1 38 28A6 9.5 0 0 0 38 9Z",
  },
  // A lamp in a windless place does not flicker (Maitrī 6.24, after Gītā 6.19): the flame without smoke.
  maitri: {
    motif: "a still flame in a windless place",
    base: ["M16 44H48C46 51 40 54.5 32 54.5C24 54.5 18 51 16 44Z", line(32, 40.5, 32, 44), line(25.5, 58, 38.5, 58)],
    accent: flame(32, 40, 30, 12, { core: true }),
  },
};

export const EMBLEM_IDS = Object.keys(EMBLEMS) as readonly string[];

/** A short description of an emblem's drawing. */
export function emblemMotif(id: string): string | undefined {
  return EMBLEMS[id]?.motif;
}

/** The emblem of one Upanishad, drawn in currentColor with a single gold stroke. */
export function UpanishadEmblem({ id, size = 48, className, title }: { id: string; size?: number; className?: string; title?: string }) {
  const e = EMBLEMS[id];
  if (!e) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={WEIGHT}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={e.base.join("")} vectorEffect="non-scaling-stroke" />
      <path d={e.accent} stroke="var(--gold)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Standalone SVG markup for an emblem (canvas, OG images, downloads). Strokes are set in viewBox units so the drawn
 * weight is `weight` pixels at `size`, without relying on vector-effect support in the renderer.
 */
export function emblemSvg(id: string, opts: { stroke: string; accent: string; size: number; weight?: number }): string {
  const e = EMBLEMS[id];
  if (!e) return "";
  const sw = n(((opts.weight ?? WEIGHT) * VB) / opts.size);
  const esc = (s: string) => s.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.size}" height="${opts.size}" viewBox="0 0 ${VB} ${VB}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${e.base.join("")}" stroke="${esc(opts.stroke)}"/><path d="${e.accent}" stroke="${esc(opts.accent)}"/></svg>`;
}

/** emblemSvg as a data URL, ready for an <img> or a canvas Image. */
export function emblemDataUrl(id: string, opts: { stroke: string; accent: string; size: number; weight?: number }): string {
  const svg = emblemSvg(id, opts);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";
}
