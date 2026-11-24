// npm run runs:restamp — carry recorded runs forward to the current corpus fingerprint, honestly.
// A run recorded against an earlier corpus is re-verified against today's: every citation must still resolve inside
// its evidence packet, every deterministic check must re-derive identically for all three answers, and every counted
// judge score must still quote its answer verbatim (scripts/lib/runs.mjs). Only a run that passes is re-stamped with
// the current corpusHash; the fingerprint it was recorded against is kept under `restamped`. A run that fails keeps
// its old fingerprint and is reported.
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/compile.mjs";
import { verifyRuns } from "./lib/runs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(ROOT, "public", "data", "runs");
const built = await compile(ROOT);
const current = built.facts.corpusHash;
const { errors, summary } = await verifyRuns(ROOT, built);
const failing = new Set(errors.map((e) => /^run ([^:]+):/.exec(e)?.[1]).filter(Boolean));
let restamped = 0, kept = 0;
for (const { id } of summary) {
  const file = join(RUNS, `${id}.json`);
  const run = JSON.parse(await readFile(file, "utf8"));
  if (!run.corpusHash || run.corpusHash === current) continue;
  if (failing.has(id)) { kept++; console.log(`  ✗ ${id}: does not re-verify; keeps ${run.corpusHash}`); continue; }
  run.restamped = { at: new Date().toISOString(), from: run.restamped?.from ?? run.corpusHash };
  run.corpusHash = current;
  await writeFile(file, JSON.stringify(run, null, 1));
  restamped++;
}
console.log(`corpus ${current}: ${restamped} run(s) re-verified and re-stamped · ${kept} kept their earlier fingerprint`);
if (errors.length) console.log(`${errors.length} verification error(s):\n` + errors.map((e) => `  ${e}`).join("\n"));
