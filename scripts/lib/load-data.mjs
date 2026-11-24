// Load the compiled data in Node: the index plus every Upanishad's passages, assembled into the KnowledgeBase the
// engine expects, and the graph with its structural links rebuilt.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expandGraph } from "../../src/lib/core/graph.ts";

export async function loadData(ROOT) {
  const D = join(ROOT, "public", "data");
  const read = async (f) => JSON.parse(await readFile(join(D, f), "utf8"));
  const [index, graph, rubric, facts] = await Promise.all([read("index.json"), read("graph.json"), read("rubric.json"), read("facts.json")]);
  const verses = (await Promise.all(index.texts.map((t) => read(`verses/${t.id}.json`)))).flat();
  const { verseIds: _ids, ...rest } = index;
  return { kb: { ...rest, verses }, graph: expandGraph(graph), compactGraph: graph, rubric, facts };
}
