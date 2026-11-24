// npm run runs:rederive — recompute the code checks stored in recorded runs after a fix to the checks themselves.
// The checks are deterministic code, not model output, so a recorded run must always show what the current code
// finds in its answers; runs:verify enforces it. Model answers and judge scores are never touched.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusIndex, runChecks } from "../src/lib/core/checks.ts";
import { SIDES } from "../src/lib/core/judge.ts";
import { loadData } from "./lib/load-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(ROOT, "public", "data", "runs");
const { kb, rubric } = await loadData(ROOT);
const ci = corpusIndex(kb);
let changed = 0;
for (const f of (await readdir(RUNS)).filter((x) => x.endsWith(".json") && x !== "index.json")) {
  const r = JSON.parse(await readFile(join(RUNS, f), "utf8"));
  if (r.v !== 2) continue;
  let dirty = false;
  for (const side of SIDES) {
    const a = side === "control" ? r.control_ : r[side];
    const now = runChecks(kb, ci, rubric, a?.text ?? "");
    if (JSON.stringify(now) !== JSON.stringify(r.checks[side])) {
      r.checks[side] = now;
      dirty = true;
    }
  }
  if (dirty) {
    await writeFile(join(RUNS, f), JSON.stringify(r, null, 1));
    changed++;
    console.log(`re-derived ${f}`);
  }
}
console.log(`${changed} run(s) updated`);
