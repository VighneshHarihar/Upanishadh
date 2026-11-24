// The word-by-word overlay (npm run data:words): data/corpus/<id>/words.json carries an analysis for every passage the
// primary source (upanishads.org.in) leaves unanalysed. It is merged only into a passage whose own `words` is empty,
// so the primary source always wins and re-running data:sources never fights the overlay.
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

/** @param {string} dir a data/corpus/<id> folder  @param {any[]} verses that text's passages */
export async function withWordOverlay(dir, verses) {
  const file = join(dir, "words.json");
  if (!(await access(file).then(() => true, () => false))) return verses;
  const { words } = JSON.parse(await readFile(file, "utf8"));
  return verses.map((v) => (!v.words?.length && words[v.id]?.length ? { ...v, words: words[v.id] } : v));
}
