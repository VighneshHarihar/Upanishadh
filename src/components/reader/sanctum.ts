// Passages set in the framed "sanctum" on the reader: the four mahāvākyas (one from each Veda's Upanishads) and the
// śānti mantras that open each text. Pure data, safe on the server.

export interface Mark {
  /** The saying as it stands in the passage's Devanagari and in its IAST (sandhi included). */
  deva: string;
  iast: string;
}
export interface Sanctum {
  kind: "mahavakya" | "shanti";
  /** Caption, e.g. "Mahāvākya" + "tat tvam asi", or "Śānti mantra" + "Saha nāv avatu". */
  label: string;
  name: string;
  /** The great saying inside the passage, set in gold ink. */
  mark?: Mark;
}

const MAHAVAKYA: Record<string, { name: string } & Mark> = {
  "AiU_3.1.3": { name: "prajñānaṃ brahma", deva: "प्रज्ञानं ब्रह्म", iast: "prajñānaṃ brahma" },
  "BU_1.4.10": { name: "ahaṃ brahmāsmi", deva: "अहं ब्रह्मास्मीति", iast: "ahaṃ brahmāsmīti" },
  "ChU_6.8.7": { name: "tat tvam asi", deva: "तत् त्वम् असि", iast: "tat tvam asi" },
  "MaU_2": { name: "ayam ātmā brahma", deva: "ब्रह्मायमात्मा ब्रह्म", iast: "brahmāyamātmā brahma" },
};

export function sanctumFor(v: { id: string; shanti?: boolean; section: string }): Sanctum | null {
  const m = MAHAVAKYA[v.id];
  if (m) return { kind: "mahavakya", label: "Mahāvākya", name: m.name, mark: { deva: m.deva, iast: m.iast } };
  if (v.shanti) {
    const name = v.section.split(" · ").slice(1).join(" · ");
    return { kind: "shanti", label: "Śānti mantra", name };
  }
  return null;
}

/** Split a line around the first occurrence of the mark: [before, mark, after], or null when it is not there. */
export function splitMark(line: string, mark: string | undefined): [string, string, string] | null {
  if (!mark) return null;
  const i = line.indexOf(mark);
  return i < 0 ? null : [line.slice(0, i), mark, line.slice(i + mark.length)];
}

/** Index of the first line carrying the mark (only that one occurrence is inked), or -1. */
export const markLine = (lines: string[], mark: string | undefined) => (mark ? lines.findIndex((l) => l.includes(mark)) : -1);

/** A daṇḍa (। ॥, or | in the romanisation) and a verse number never start a line: bind them to the word before. */
export const bindDandas = (s: string) => s.replace(/ (?=[।॥|]|[0-9०-९])/g, " ");
/** The great saying is never broken across lines. */
export const unbroken = (s: string) => s.replace(/ /g, " ");

/** Short invocations read best centred; long prose passages stay ranged left. */
export const centred = (lines: string[]) => lines.length <= 6 && lines.every((l) => [...l].length <= 64);
