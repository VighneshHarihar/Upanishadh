// npm run data:verify — recompile data/ and confirm (1) the integrity gate passes, (2) the committed public/data
// artifacts are exactly what the build produces (nothing stale or hand-edited), (3) every recorded run re-derives.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/compile.mjs";
import { verifyRuns } from "./lib/runs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = await compile(ROOT);
const { outputs, errors, warnings, facts, crossChecks } = built;
const stale = [];
for (const [file, body] of Object.entries(outputs)) {
  const have = await readFile(join(ROOT, "public", "data", file), "utf8").catch(() => null);
  if (have !== body) stale.push(file);
}
const runs = await verifyRuns(ROOT, built);

for (const w of [...warnings, ...runs.warnings]) console.log(`warning: ${w}`);
const all = [...errors, ...stale.map((f) => `public/data/${f} is stale: run npm run data`), ...runs.errors];
console.log(`integrity gate: ${errors.length} error(s) · ${facts.anchors} anchor and keyword checks · ${crossChecks.length} wording checks`);
console.log(`artifacts: ${Object.keys(outputs).length - stale.length}/${Object.keys(outputs).length} up to date`);
console.log(`runs: ${runs.summary.length} verified${runs.summary.length ? ` across ${new Set(runs.summary.map((s) => s.model)).size} model(s)` : ""}`);
if (all.length) {
  console.error(`\n${all.length} error(s):\n` + all.slice(0, 60).map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("data:verify passed · 0 errors");
