"use client";
// Fetch-once loaders for the static data in /data (cached for the page's lifetime). Small files up front (the index,
// the graph), the rest per Upanishad and only when needed (passages, commentary, the lemma index, the layout).
import { useEffect, useState } from "react";
import type { Bhashya, GraphData, KbIndex, KnowledgeBase, Rubric, Verse, VerseLite } from "@/lib/core/types";
import { createEngine, type Engine } from "@/lib/core/engine";
import { corpusIndex, type CorpusIndex } from "@/lib/core/checks";
import { expandGraph, type CompactGraph } from "@/lib/core/graph";

const cache = new Map<string, Promise<unknown>>();
export function fetchData<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(`/data/${file}`).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${file} (${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(file) as Promise<T>;
}

export function useData<T>(file: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!file) return;
    let live = true;
    fetchData<T>(file).then(
      (data) => live && setState({ data, error: null }),
      (e: Error) => live && setState({ data: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [file]);
  return state;
}

/** A loader as a hook. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    fn().then((x) => live && setV(x), () => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export const loadIndex = () => fetchData<KbIndex>("index.json");
let graphPromise: Promise<GraphData> | null = null;
export const loadGraph = () => (graphPromise ||= fetchData<CompactGraph>("graph.json").then((g) => expandGraph(g) as GraphData));
export const loadLayout = () => fetchData<Record<string, [number, number, number]>>("layout.json");
export const loadLemmas = () => fetchData<Record<string, [string, string[]]>>("lemmas.json");
export const loadVerses = (up: string) => fetchData<VerseLite[]>(`verses/${up}.json`);
/** Passages and commentary are stored per chapter: the first number of the ref ("KaU_1.2.2" → 1; śānti → 0). */
const chapterOf = (id: string) => id.slice(id.indexOf("_") + 1).split(".")[0];
export const loadVerse = async (id: string, up: string): Promise<Verse | undefined> => (await fetchData<Verse[]>(`corpus/${up}/${chapterOf(id)}.json`)).find((v) => v.id === id);
export const loadBhashya = async (id: string, up: string): Promise<Bhashya | undefined> => (await fetchData<Record<string, Bhashya>>(`bhashya/${up}/${chapterOf(id)}.json`))[id];
/** Which Upanishad a passage id belongs to, from the index (no passage file needed). */
export async function upOf(id: string): Promise<string | null> {
  const ix = await loadIndex();
  return ix.verseIds.find((v) => v[0] === id)?.[1] ?? null;
}

/** The full knowledge base: the index plus every passage. Loaded only for retrieval (Ask, search, the live harness). */
let kbPromise: Promise<KnowledgeBase> | null = null;
export function loadKb(): Promise<KnowledgeBase> {
  kbPromise ||= loadIndex().then(async (ix) => {
    const verses = (await Promise.all(ix.texts.map((t) => loadVerses(t.id)))).flat();
    const { verseIds: _v, ...rest } = ix;
    return { ...rest, verses };
  });
  return kbPromise;
}

let enginePromise: Promise<{ E: Engine; ci: CorpusIndex }> | null = null;
export function loadEngine() {
  enginePromise ||= Promise.all([loadKb(), fetchData<CompactGraph>("graph.json"), fetchData<Rubric>("rubric.json")]).then(([kb, g, r]) => ({
    E: createEngine(kb, g, r),
    ci: corpusIndex(kb),
  }));
  return enginePromise;
}
