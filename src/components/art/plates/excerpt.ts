// Cutting short, clean quotations out of the corpus: a sentence or two of commentary, a translation trimmed to its
// opening. Pure string work, shared by the server wrapper and the standalone plate check.

/** Where a quotation starts and ends in a commentary, and the scanning errors to mend inside it. */
export interface Cut {
  /** A literal, or a pattern where the commentary is still being cleaned (OCR spellings vary). */
  from: string | RegExp;
  /** Inclusive end marker; without it the quotation runs to the end of the sentence. */
  to?: string;
  fix?: [string, string][];
}

/** Footnote numerals glued to words ("rope is1 realised", "attains 1 the") are removed. */
export function stripNotes(s: string): string {
  return s
    .replace(/(?<=[\p{L}\p{M}),;’”'])\d{1,2}(?=[\s,.;:)’”]|$)/gu, "")
    .replace(/(?<=\p{L}) \d{1,2} (?=\p{Ll})/gu, " ")
    .replace(/\s{2,}/g, " ");
}

export function excerpt(text: string | undefined, cut: Cut): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ");
  const i = typeof cut.from === "string" ? flat.indexOf(cut.from) : flat.search(cut.from);
  if (i < 0) return null;
  let end: number;
  if (cut.to) {
    const j = flat.indexOf(cut.to, i);
    if (j < 0) return null;
    end = j + cut.to.length;
  } else {
    const m = /[.!?](?=\s|$)/.exec(flat.slice(i));
    end = m ? i + m.index + 1 : flat.length;
  }
  let out = flat.slice(i, end);
  for (const [a, b] of cut.fix ?? []) out = out.split(a).join(b);
  out = stripNotes(out).trim().replace(/[;,:]$/, ".");
  const before = flat.slice(Math.max(0, i - 3), i);
  const mid = i > 0 && !/[.!?”’)]\s*$/.test(before);
  return mid ? `… ${out}` : out;
}

/** Several cuts joined with an ellipsis; null if any is missing (the corpus changed). */
export function excerpts(text: string | undefined, cuts: Cut[]): string | null {
  const parts = cuts.map((c) => excerpt(text, c));
  if (parts.some((p) => !p)) return null;
  return parts.map((p, k) => (k ? p!.replace(/^…\s*/, "") : p)).join(" … ");
}

/** The sentences of a translation, split where a sentence ends and another begins. */
export const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z“"(])/);

/**
 * A translation trimmed for a plate: whole if short; else its first sentence; else its opening clauses, an ellipsis,
 * and the closing sentence when that is short (as in MaU 7, "That is the Self; that is to be known.").
 */
export function trimTr(s: string | null | undefined, max = 230): string | null {
  if (!s) return null;
  const text = s.trim();
  if (text.length <= max) return text;
  const ss = sentences(text);
  if (ss[0].length <= max) return `${ss[0]} …`;
  const head = ss[0].slice(0, max - 70);
  const cut = head.lastIndexOf(", ");
  const opening = (cut > 60 ? head.slice(0, cut) : head).trim();
  const last = ss[ss.length - 1];
  return ss.length > 1 && last.length <= 70 ? `${opening} … ${last}` : `${opening} …`;
}

/** The part of a verse line (split at dandas) that contains a word. */
export function segment(lines: string[], word: string): string | null {
  for (const l of lines) {
    if (!l.includes(word)) continue;
    const seg = l.split(/[।॥|]/).find((x) => x.includes(word));
    if (seg) return seg.trim();
  }
  return null;
}
