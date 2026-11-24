// npm run runs:verify — every recorded run re-derives from the current corpus and code.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRuns } from "./lib/runs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { errors, warnings, summary } = await verifyRuns(ROOT);
console.table(summary);
for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} run error(s):\n` + errors.map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`runs: ${summary.length} recorded runs verified · 0 errors`);
