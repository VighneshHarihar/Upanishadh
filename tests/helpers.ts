import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEngine } from "../src/lib/core/engine.ts";
import { corpusIndex } from "../src/lib/core/checks.ts";
import { expandGraph, type CompactGraph } from "../src/lib/core/graph.ts";
import type { GraphData, KbIndex, KnowledgeBase, Rubric, VerseLite } from "../src/lib/core/types.ts";

const D = join(import.meta.dirname, "..", "public", "data");
export const read = <T>(f: string): T => JSON.parse(readFileSync(join(D, f), "utf8")) as T;
/** The knowledge base as the browser and the CLI assemble it: the index plus every per-text passage file. */
export const index = read<KbIndex>("index.json");
const { verseIds: _ids, ...rest } = index;
export const kb: KnowledgeBase = { ...rest, verses: index.texts.flatMap((t) => read<VerseLite[]>(`verses/${t.id}.json`)) };
export const compactGraph = read<CompactGraph>("graph.json");
export const graph = expandGraph(compactGraph) as GraphData;
export const rubric = read<Rubric>("rubric.json");
export const E = createEngine(kb, compactGraph, rubric);
export const ci = corpusIndex(kb);
export const verse = (id: string) => kb.verses.find((v) => v.id === id)!;
