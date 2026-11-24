// Build-time access to the compiled data (public/data). Used only by server components and route generation.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Bhashya, Facts, GraphData, KbIndex, KnowledgeBase, LearningPath, Rubric, Verse, VerseLite } from "@/lib/core/types";
import { expandGraph, type CompactGraph } from "@/lib/core/graph";
import type { HarnessRun, HarnessModels } from "@/lib/core/pipeline";
import type { Side } from "@/lib/core/judge";

const D = join(process.cwd(), "public", "data");
const cache = new Map<string, unknown>();
function read<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(join(D, file), "utf8")));
  return cache.get(file) as T;
}

export const getIndex = () => read<KbIndex>("index.json");
/** The whole knowledge base (index + every passage), for build-time work such as run contexts. */
export function getKb(): KnowledgeBase {
  if (!cache.has("__kb")) {
    const { verseIds: _v, ...rest } = getIndex();
    const verses = rest.texts.flatMap((t) => read<VerseLite[]>(`verses/${t.id}.json`));
    cache.set("__kb", { ...rest, verses });
  }
  return cache.get("__kb") as KnowledgeBase;
}
export function getGraph(): GraphData {
  if (!cache.has("__graph")) cache.set("__graph", expandGraph(read<CompactGraph>("graph.json")));
  return cache.get("__graph") as GraphData;
}
export const getRubric = () => read<Rubric>("rubric.json");
export const getFacts = () => read<Facts>("facts.json");
export const getDarshanas = () => read<import("@/components/verse/Darshanas").DarshanaData>("darshanas.json");
export const getPaths = () => read<{ paths: LearningPath[]; categories: Record<string, string> }>("paths.json").paths;
/** Chapter files of one Upanishad (corpus/<up>/<chapter>.json), in reading order. */
const chapterFiles = (dir: string, up: string) =>
  existsSync(join(D, dir, up)) ? readdirSync(join(D, dir, up)).filter((f) => f.endsWith(".json")).sort((a, b) => parseInt(a) - parseInt(b)).map((f) => `${dir}/${up}/${f}`) : [];
export function getCorpus(up: string): Verse[] {
  const key = `__corpus:${up}`;
  if (!cache.has(key)) cache.set(key, chapterFiles("corpus", up).flatMap((f) => read<Verse[]>(f)).sort((a, b) => a.order - b.order));
  return cache.get(key) as Verse[];
}
export function getBhashya(up: string): Record<string, Bhashya> {
  const key = `__bhashya:${up}`;
  if (!cache.has(key)) cache.set(key, Object.assign({}, ...chapterFiles("bhashya", up).map((f) => read<Record<string, Bhashya>>(f))));
  return cache.get(key) as Record<string, Bhashya>;
}

export interface RunSummary {
  id: string;
  preset: string | null;
  title: string | null;
  hook: string | null;
  prompt: string;
  followUp: string | null;
  control: boolean;
  sharpened: boolean;
  sample: number;
  createdAt: string;
  status: string;
  models: HarnessModels & { sameJudge: boolean };
  /** The judge whose verdict a re-judging replaced (cross-family re-scoring). */
  rejudgedFrom?: string;
  verdict: Side | "tie" | null;
  totals: Partial<Record<Side, number>>;
  max: number;
  comparableAxes: number;
  dilemma: string | null;
  tokens: { in: number; out: number };
  /** Answer time per side and the judge, in ms. */
  ms?: Partial<Record<Side | "judge", number | null>>;
  scores: Record<string, Partial<Record<Side, number | null>>>;
}
export interface RunIndex {
  v: 2;
  hero: string;
  bench: HarnessModels[];
  samples: number;
  runs: RunSummary[];
}
export function getRunIndex(): RunIndex {
  return existsSync(join(D, "runs", "index.json")) ? read<RunIndex>("runs/index.json") : { v: 2, hero: "", bench: [], samples: 0, runs: [] };
}
export const getRuns = () => getRunIndex().runs;
export function getRun(id: string): HarnessRun | null {
  return existsSync(join(D, "runs", `${id}.json`)) ? read<HarnessRun>(`runs/${id}.json`) : null;
}
export function runIds(): string[] {
  return existsSync(join(D, "runs")) ? readdirSync(join(D, "runs")).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.slice(0, -5)) : [];
}
export function getText(up: string) {
  return getIndex().texts.find((t) => t.id === up) ?? null;
}
