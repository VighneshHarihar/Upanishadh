"use client";
// One-click sharing: copy a deep link, or download an image card: an engraved editorial plate drawn on a canvas in the
// site's own fonts (parchment ground, a double hairline border, the Upanishad's emblem, the Devanagari, the English).
import { useEffect, useRef, useState } from "react";
import { emblemDataUrl } from "@/components/art/UpanishadEmblem";
import { IconCheck, IconCopy, IconDownload, IconExternal } from "./Icons";

export interface CardSpec {
  title: string;
  subtitle?: string;
  deva?: string;
  iast?: string;
  /** Short lines: for a passage, its English and the translator (unless given below); otherwise set as a row (a run's scores). */
  lines?: string[];
  url?: string;
  /** An Upanishad id: its emblem is engraved on the card. */
  emblem?: string;
  /** The Veda-Sāra root, e.g. "Rooted in the Yajurveda · Kṛṣṇa section". */
  root?: string;
  /** The passage in English; the IAST stands in when there is none. */
  translation?: string;
  /** Who translated it. */
  credit?: string;
}

/** The plate's inks: parchment and iron-gall black, with one deep gold. */
const INK = { ground: "#f3ede1", ink: "#221d15", ink2: "#4a4234", ink3: "#7b6f5b", rule: "rgba(34,29,21,0.5)", soft: "rgba(34,29,21,0.2)", gold: "#8a5a12" };

function cssFont(v: string, fallback: string) {
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f ? `${f}, ${fallback}` : fallback;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}
/** Wrap to at most `n` lines, closing the last with an ellipsis when the text runs on. */
function clampLines(ctx: CanvasRenderingContext2D, text: string, max: number, n: number): string[] {
  const all = wrap(ctx, text, max);
  if (all.length <= n) return all;
  const out = all.slice(0, n);
  let last = out[n - 1].replace(/[\s,;:.—–-]+$/, "");
  while (last.includes(" ") && ctx.measureText(`${last}…`).width > max) last = last.replace(/[\s,;:.—–-]*\S+$/, "");
  out[n - 1] = `${last}…`;
  return out;
}
function rule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
/** Letter-spacing where the canvas supports it (small capitals read better tracked). */
function track(ctx: CanvasRenderingContext2D, em: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${em}em`;
}
async function image(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** Draw the share card (1200 × 630) and return it as a PNG data URL. */
export async function drawCard(spec: CardSpec): Promise<string> {
  const serif = cssFont("--font-source-serif", "Georgia, serif");
  const sans = cssFont("--font-inter", "system-ui, sans-serif");
  const deva = cssFont("--font-tiro", "'Nirmala UI', serif");
  const fonts = document.fonts;
  if (fonts) {
    const want = [`34px ${deva}`, `400 28px ${serif}`, `italic 400 20px ${serif}`, `600 30px ${serif}`, `600 13px ${sans}`, `400 14px ${sans}`];
    await Promise.all(want.map((f, i) => fonts.load(f, i === 0 ? spec.deva || "ॐ" : "UpaSārathi Ṛṣi").catch(() => [])));
    await fonts.ready;
  }
  const W = 1200, H = 630, P = 72;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // ground, and the double border
  ctx.fillStyle = INK.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24.75, 24.75, W - 49.5, H - 49.5);
  ctx.strokeStyle = INK.soft;
  ctx.lineWidth = 1;
  ctx.strokeRect(32.5, 32.5, W - 65, H - 65);

  // head: the imprint, and where the passage stands
  const passage = Boolean(spec.emblem || spec.deva);
  ctx.fillStyle = INK.ink3;
  ctx.font = `600 12.5px ${sans}`;
  track(ctx, 0.26);
  ctx.fillText("UPASĀRATHI", P, 84);
  track(ctx, 0);
  if (passage && spec.subtitle) {
    ctx.font = `italic 400 18px ${serif}`;
    ctx.fillStyle = INK.ink2;
    ctx.textAlign = "right";
    ctx.fillText(clampLines(ctx, spec.subtitle, 760, 1)[0], W - P, 84);
    ctx.textAlign = "left";
  }
  rule(ctx, P, 104.5, W - P, 104.5, 1, INK.soft);

  // foot: the Veda it is rooted in, and where it lives
  rule(ctx, P, 532.5, W - P, 532.5, 1, INK.soft);
  ctx.font = `italic 400 19px ${serif}`;
  ctx.fillStyle = INK.gold;
  ctx.fillText(spec.root || "The thirteen Principal Upanishads", P, 568);
  ctx.font = `400 14px ${sans}`;
  ctx.fillStyle = INK.ink3;
  ctx.textAlign = "right";
  ctx.fillText((spec.url || location.href).replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 72), W - P, 567);
  ctx.textAlign = "left";

  const top = 136, bottom = 504;
  const emblem = spec.emblem ? await image(emblemDataUrl(spec.emblem, { stroke: INK.ink, accent: INK.gold, size: 176, weight: 1.7 })) : null;
  let x = P;
  if (emblem) {
    // the left column: the emblem over the reference; a hairline divides it from the text
    const cx = 192, ey = 164;
    ctx.drawImage(emblem, cx - 88, ey, 176, 176);
    ctx.fillStyle = INK.ink;
    ctx.font = `600 30px ${serif}`;
    ctx.textAlign = "center";
    ctx.fillText(clampLines(ctx, spec.title, 230, 1)[0], cx, ey + 176 + 62);
    ctx.textAlign = "left";
    rule(ctx, cx - 16, ey + 176 + 86.5, cx + 16, ey + 176 + 86.5, 1, INK.gold);
    rule(ctx, 336.5, top, 336.5, bottom, 1, INK.soft);
    x = 380;
  }
  const w = W - P - x;

  // the text, measured first so the block sits in the middle of its field
  type Run = { font: string; color: string; lines: string[]; lh: number; gap: number };
  const runs: Run[] = [];
  const add = (font: string, color: string, text: string, n: number, lh: number, gap: number) => {
    ctx.font = font;
    runs.push({ font, color, lines: clampLines(ctx, text, w, n), lh, gap: runs.length ? gap : 0 });
  };
  if (!emblem) add(`500 ${passage ? 44 : 52}px ${serif}`, INK.ink, spec.title, 2, passage ? 54 : 62, 0);
  if (spec.deva) add(`400 34px ${deva}`, INK.ink, spec.deva, 3, 56, 20);
  const english = spec.translation || (passage ? spec.lines?.[0] : undefined);
  if (english) {
    let size = 30;
    for (; size > 24; size -= 2) {
      ctx.font = `400 ${size}px ${serif}`;
      if (wrap(ctx, english, w).length <= 4) break;
    }
    add(`400 ${size}px ${serif}`, INK.ink, english, 4, Math.round(size * 1.42), 26);
    const credit = spec.credit || (spec.translation ? undefined : spec.lines?.[1]);
    if (credit) add(`400 14px ${sans}`, INK.ink3, credit, 1, 20, 14);
  } else if (spec.iast && passage) add(`italic 400 24px ${serif}`, INK.ink2, spec.iast, 3, 34, 22);
  if (!passage && spec.subtitle) add(`400 26px ${serif}`, INK.ink2, spec.subtitle, 3, 38, 20);
  if (!passage && spec.lines?.length) add(`600 17px ${sans}`, INK.ink2, spec.lines.join("   ·   "), 2, 26, 26);
  const height = runs.reduce((h, r) => h + r.gap + r.lines.length * r.lh, 0);
  let y = top + Math.max(0, (bottom - top - height) / 2);
  for (const r of runs) {
    y += r.gap;
    ctx.font = r.font;
    ctx.fillStyle = r.color;
    for (const l of r.lines) {
      ctx.fillText(l, x, y + r.lh * 0.76);
      y += r.lh;
    }
  }
  return c.toDataURL("image/png");
}

export function ShareButton({ label = "Share", ...spec }: CardSpec & { label?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const flash = (m: string) => {
    setDone(m);
    setTimeout(() => setDone(null), 1600);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(spec.url || location.href);
      flash("Link copied");
    } catch {
      flash("Could not copy");
    }
  };
  const download = async () => {
    const url = await drawCard(spec);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upasarathi-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;
    a.click();
    flash("Card downloaded");
  };
  const native = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div ref={ref} className="relative inline-block">
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {done ? <IconCheck size={14} /> : <IconExternal size={14} />} {done ?? label}
      </button>
      {open && (
        <div className="menu reveal absolute right-0 z-30 mt-1.5 w-56 p-1.5" role="menu">
          <button className="menu-item" onClick={() => { setOpen(false); copy(); }} role="menuitem"><IconCopy size={14} /> Copy link</button>
          <button className="menu-item" onClick={() => { setOpen(false); download(); }} role="menuitem"><IconDownload size={14} /> Download card (PNG)</button>
          {native && (
            <button className="menu-item" onClick={() => { setOpen(false); navigator.share({ title: spec.title, text: spec.subtitle, url: spec.url || location.href }).catch(() => {}); }} role="menuitem">
              <IconExternal size={14} /> Share…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
