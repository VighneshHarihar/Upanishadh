// The minimal context a run view needs (labels, verse texts, axes), resolved at build time so pages stay static.
import { SIDES } from "@/lib/core/judge";
import type { HarnessRun } from "@/lib/core/pipeline";
import type { RunContext } from "@/components/harness/RunView";
import { getFacts, getGraph, getKb, getRubric } from "./data";

export function runContext(run: HarnessRun, extraVerses: string[] = []): RunContext {
  const kb = getKb();
  const graph = getGraph();
  const nodeIds = new Set<string>([...run.diagnosis.subgraph.nodes, ...kb.texts.map((t) => `up:${t.id}`), ...run.diagnosis.dilemmas.map((d) => `dilemma:${d.id}`)]);
  const nodes = Object.fromEntries(graph.nodes.filter((n) => nodeIds.has(n.id)).map((n) => [n.id, n]));
  const verseIds = new Set<string>([
    ...run.diagnosis.verses.map((v) => v.id),
    ...run.realigned.citations.map((c) => c.id).filter((x): x is string => Boolean(x)),
    ...SIDES.flatMap((s) => run.checks[s].claimedRefs.map((r) => r.id).filter((x): x is string => Boolean(x))),
    ...extraVerses,
  ]);
  const verses = Object.fromEntries(
    kb.verses
      .filter((v) => verseIds.has(v.id))
      .map((v) => {
        const t = kb.texts.find((x) => x.id === v.up)!;
        return [v.id, { label: `${t.abbrev} ${v.ref}`, tr: v.tr, trBy: v.trBy, audio: v.audio, text: v.sa }];
      }),
  );
  const facts = getFacts();
  return { nodes, verses, axes: getRubric().axes, corpusSize: facts.mantras.total };
}
