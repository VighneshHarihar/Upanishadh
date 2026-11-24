// Minimal BM25 over a few hundred documents: no dependency, identical in browser, Node and tests.
import { words } from "./text.ts";

const STOP = new Set(
  "the a an and or of to in is it i my me you your for on that this with be are was so but not no do just what how about from at as by if we they he she have has can will would should im dont its their them our up out please here there been am into than then".split(" "),
);
const stem = (w: string) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
export const terms = (s: string) => words(s).filter((w) => !STOP.has(w)).map(stem);

export interface SearchDoc {
  id: string;
  text: string;
  boost?: number;
}
export interface SearchIndex {
  ids: string[];
  boosts: number[];
  tf: Map<string, number>[];
  len: number[];
  df: Map<string, number>;
  avg: number;
}

export function buildSearch(docs: SearchDoc[]): SearchIndex {
  const df = new Map<string, number>();
  const tf = docs.map((d) => {
    const m = new Map<string, number>();
    for (const t of terms(d.text)) m.set(t, (m.get(t) || 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
  return { ids: docs.map((d) => d.id), boosts: docs.map((d) => d.boost ?? 1), tf, len, df, avg: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
}

export function searchIndex(idx: SearchIndex, query: string, k = 12): { id: string; score: number }[] {
  const q = [...new Set(terms(query))];
  const N = idx.ids.length;
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (const t of q) {
      const f = idx.tf[i].get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (idx.df.get(t) || 0) + 0.5) / ((idx.df.get(t) || 0) + 0.5));
      s += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (idx.len[i] / idx.avg)));
    }
    if (s > 0) out.push({ id: idx.ids[i], score: s * idx.boosts[i] });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}
