// npm run runs:table — the 3-way benchmark as Markdown, from public/data/runs/index.json (the same numbers the
// site shows on /harness): per model, the share of the maximum over comparable axes, judge picks, tokens, timing.
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ix = JSON.parse(await readFile(join(ROOT, "public", "data", "runs", "index.json"), "utf8"));
const rubric = JSON.parse(await readFile(join(ROOT, "public", "data", "rubric.json"), "utf8"));
const SIDES = ["baseline", "control", "realigned"];
const LABEL = { baseline: "Baseline", control: "Honesty control", realigned: "UpaSārathi" };
const short = (m) => m.replace(/^.*\//, "");
const pct = (runs, s) => {
  const ok = runs.filter((r) => r.status === "complete" && r.comparableAxes > 0);
  const max = ok.reduce((n, r) => n + r.max, 0);
  return max ? `${Math.round((ok.reduce((n, r) => n + (r.totals[s] ?? 0), 0) / max) * 100)}%` : "–";
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const lines = [];
lines.push(`| Model (judge) | ${SIDES.map((s) => LABEL[s]).join(" | ")} | Judge's pick (U · C · B · tie) | Complete / comparable / recorded | Tokens per run | Mean answer time (B · C · U) |`);
lines.push(`| --- | ${SIDES.map(() => "---:").join(" | ")} | :---: | :---: | ---: | :---: |`);
for (const m of ix.bench) {
  const runs = ix.runs.filter((r) => r.models.model === m.model);
  const wins = { baseline: 0, control: 0, realigned: 0, tie: 0 };
  for (const r of runs) if (r.verdict) wins[r.verdict]++;
  const tok = runs.length ? Math.round(runs.reduce((n, r) => n + (r.tokens?.in ?? 0) + (r.tokens?.out ?? 0), 0) / runs.length / 100) / 10 : 0;
  const secs = SIDES.map((s) => {
    const v = mean(runs.map((r) => r.ms?.[s]).filter((x) => typeof x === "number" && x > 0));
    return v === null ? "–" : `${(v / 1000).toFixed(1)}s`;
  });
  lines.push(`| ${short(m.model)} (${short(m.judgeModel)}) | ${SIDES.map((s) => pct(runs, s)).join(" | ")} | ${wins.realigned} · ${wins.control} · ${wins.baseline} · ${wins.tie} | ${runs.filter((r) => r.status === "complete").length} / ${runs.filter((r) => r.status === "complete" && r.comparableAxes > 0).length} / ${runs.length} | ${tok}k | ${secs.join(" · ")} |`);
}
lines.push("");
lines.push(`| Preset | ${ix.bench.map((m) => short(m.model)).join(" | ")} |`);
lines.push(`| --- | ${ix.bench.map(() => ":---:").join(" | ")} |`);
for (const p of rubric.presets) {
  const cells = ix.bench.map((m) => {
    const runs = ix.runs.filter((r) => r.preset === p.id && r.models.model === m.model);
    if (!runs.length) return "not recorded";
    return `${SIDES.map((s) => pct(runs, s)).join(" / ")} (n=${runs.length})`;
  });
  lines.push(`| ${p.title}${p.followUp ? " (2 turns)" : ""} | ${cells.join(" | ")} |`);
}
lines.push("");
lines.push(`Cells: baseline / honesty control / UpaSārathi as a share of the maximum over axes where all three answers kept verified evidence. ${ix.runs.length} runs recorded; target ${rubric.presets.length} presets × ${ix.bench.length} models × ${ix.samples} samples = ${rubric.presets.length * ix.bench.length * ix.samples}.`);
const table = lines.join("\n");
if (process.argv.includes("--readme")) {
  // Replace the block between the bench markers in README.md.
  const file = join(ROOT, "README.md");
  const md = await readFile(file, "utf8");
  const next = md.replace(/(<!-- bench:start -->\n)[\s\S]*?(\n<!-- bench:end -->)/, (_m, a, b) => `${a}${table}${b}`);
  await writeFile(file, next);
  console.log(next === md ? "README.md: no change" : "README.md: benchmark table updated");
} else console.log(table);
