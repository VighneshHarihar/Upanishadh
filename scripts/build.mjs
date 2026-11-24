// npm run data — compile data/ into public/data. Nothing is written unless the integrity gate passes.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/compile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");
const t0 = performance.now();
const { outputs, errors, warnings, facts, crossChecks } = await compile(ROOT);

for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  console.error(`\nIntegrity gate: ${errors.length} error(s). Nothing written.\n` + errors.map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
for (const sub of ["corpus", "bhashya", "verses"]) {
  await rm(join(OUT, sub), { recursive: true, force: true });
  await mkdir(join(OUT, sub), { recursive: true });
}
await rm(join(OUT, "kb.json"), { force: true }); // replaced by index.json + verses/<id>.json
for (const [file, body] of Object.entries(outputs)) {
  await mkdir(dirname(join(OUT, file)), { recursive: true });
  await writeFile(join(OUT, file), body, "utf8");
}
await mkdir(join(OUT, "runs"), { recursive: true });

console.log(`Integrity gate passed: 0 errors · ${facts.anchors} anchor and keyword checks · ${crossChecks.length} wording checks`);
console.log(`${facts.texts.total} Upanishads · ${facts.mantras.total} mantras + ${facts.shanti} śānti · ${facts.nodes} nodes · ${facts.edges} links (${facts.semanticEdges} curated, ${facts.shankaraLinks} Śaṅkara, ${facts.vedaSaraLinks} Veda-Sāra) · ${facts.stems} stems · ${facts.lemmas} lemmas · ${facts.bhashyaVerses} with Śaṅkara · ${facts.audioVerses} chanted · ${facts.runs} recorded runs`);
console.log(`wrote ${Object.keys(outputs).length} files to public/data in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
