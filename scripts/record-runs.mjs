// npm run runs:record — the three-way benchmark: every preset × every model × N samples, recorded as replayable runs.
//   GROQ_API_KEY=… npm run runs:record                     everything still missing (resumes after an interruption)
//   GROQ_API_KEY=… npm run runs:record -- --samples 1       fewer samples
//   GROQ_API_KEY=… npm run runs:record -- --only pushback   one preset
//   GROQ_API_KEY=… npm run runs:record -- --fresh           re-record even what exists
// Each model is judged by a model from a different family (no model grades itself or its sibling). A stored run whose
// judge differs from BENCH is re-judged in place: the three recorded answers are kept, only stage E runs again, and the
// previous verdict is kept under `rejudged` for provenance.
// Each model is judged by a different model. Conditions run one after another (gentle on per-minute token limits);
// per-minute limits are waited out; a daily limit stops cleanly and the next run resumes where this one stopped.
// The Scripture Quote hero keeps its genuine Phase 0 baseline (gpt-oss-20b, sample 1), with provenance.
import { mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "../src/lib/core/engine.ts";
import { corpusIndex } from "../src/lib/core/checks.ts";
import { runHarness, judgeRun } from "../src/lib/core/pipeline.ts";
import { SIDES } from "../src/lib/core/judge.ts";
import { complete } from "../src/lib/core/complete.ts";
import { LlmError } from "../src/lib/core/llm.ts";
import { loadData } from "./lib/load-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(ROOT, "public", "data", "runs");
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const SAMPLES = Number(flag("samples", "3"));
const ONLY = flag("only", null);
const FRESH = args.includes("--fresh");
export const BENCH = [
  { provider: "groq", model: "openai/gpt-oss-20b", judgeProvider: "groq", judgeModel: "qwen/qwen3.8-27b" },
  { provider: "groq", model: "qwen/qwen3.8-27b", judgeProvider: "groq", judgeModel: "openai/gpt-oss-120b" },
  { provider: "groq", model: "openai/gpt-oss-120b", judgeProvider: "groq", judgeModel: "qwen/qwen3.8-27b" },
];
const slug = (m) => m.split("/").pop().replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
export const runId = (preset, model, sample) => `${preset}--${slug(model)}--s${sample}`;
const HERO = runId("scripture-quote", BENCH[0].model, 1);

const { kb, graph, rubric, facts } = await loadData(ROOT);
const E = createEngine(kb, graph, rubric);
const ci = corpusIndex(kb);
const key = process.env.GROQ_API_KEY?.trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

// Groq's free tier allows 8,000 tokens a minute per model: wait out per-minute limits patiently.
// With --patient, a daily (token-bucket) limit that names a short wait ("try again in 9m39s") is waited out too,
// so a long background pass keeps creeping forward as the bucket refills.
const PATIENT = args.includes("--patient");
let dailyWaits = 0;
const dailyWaitMs = (msg) => {
  const m = /try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i.exec(msg || "");
  return m ? ((Number(m[1] || 0) * 60 + Number(m[2] || 0)) * 60 + Number(m[3] || 0)) * 1000 : null;
};
const transport = {
  async complete(req, onToken) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await complete(req, { key, onToken });
      } catch (e) {
        const wait = e instanceof LlmError && e.code === "rate-daily" && PATIENT ? dailyWaitMs(e.message) : null;
        if (wait !== null && wait <= 40 * 60_000 && dailyWaits < 200) {
          dailyWaits++;
          process.stdout.write(`    … ${req.model} daily bucket empty, waiting ${(wait / 60000).toFixed(1)} min for it to refill\n`);
          await sleep(wait + 15_000);
          attempt = -1;
          continue;
        }
        if (e instanceof LlmError && e.code === "rate-minute" && attempt < 12) {
          const ms = Math.min(90_000, Math.max(e.retryAfterMs ?? 0, 4000 * (attempt + 1)));
          process.stdout.write(`    … ${req.model} rate-limited, waiting ${(ms / 1000).toFixed(0)} s\n`);
          await sleep(ms);
          continue;
        }
        throw e;
      }
    }
  },
};

// The hero's baseline: the real gpt-oss-20b answer captured in Phase 0 (one of two samples; the other was truthful).
const PHASE0 = process.env.PHASE0_RUNS || join(ROOT, "..", "phase0", "runs");
async function phase0Baseline() {
  if (!(await exists(PHASE0))) return null;
  for (const f of (await readdir(PHASE0)).filter((x) => x.startsWith("baseline-groq-")).sort()) {
    const runs = JSON.parse(await readFile(join(PHASE0, f), "utf8"));
    const same = runs.filter((r) => r.preset === "scripture-quote" && r.model === BENCH[0].model && r.text);
    const fabricated = same.find((r) => /[ऀ-ॿ]/.test(r.text) && r.text.length < 300);
    if (fabricated) return { text: fabricated.text, model: BENCH[0].model, ms: fabricated.ms, finish: fabricated.finish, provenance: `Recorded ${fabricated.at.slice(0, 10)} during Phase 0 testing: sample ${fabricated.sample} of ${same.length} with the same neutral prompt. The other sample${same.length > 2 ? "s" : ""} answered truthfully.` };
  }
  return null;
}
// If Phase 0 is not on this machine, keep the hero baseline already recorded (same model, same neutral prompt).
async function storedHeroBaseline() {
  try {
    const prev = JSON.parse(await readFile(join(RUNS, `${HERO}.json`), "utf8"));
    return prev.baseline?.provenance ? prev.baseline : null;
  } catch {
    try {
      const v1 = JSON.parse(await readFile(join(RUNS, "scripture-quote.json"), "utf8"));
      return v1.baseline?.text ? { ...v1.baseline, provenance: v1.baseline.provenance || "Recorded in an earlier pass with the same model and neutral prompt." } : null;
    } catch {
      return null;
    }
  }
}

async function writeIndex() {
  const files = (await readdir(RUNS)).filter((f) => f.endsWith(".json") && f !== "index.json");
  const runs = [];
  for (const f of files) {
    const r = JSON.parse(await readFile(join(RUNS, f), "utf8"));
    if (r.v !== 2) continue;
    runs.push({
      id: r.id, preset: r.preset, title: r.title, hook: r.hook, prompt: r.prompt, followUp: r.followUp, control: r.control, sharpened: r.sharpened,
      sample: r.sample, createdAt: r.createdAt, status: r.status, models: r.models, verdict: r.judge.verdict,
      totals: r.judge.totals, max: r.judge.max, comparableAxes: r.judge.comparableAxes, dilemma: r.diagnosis.dilemmas[0]?.id ?? null, tokens: r.tokens, ...(r.rejudged ? { rejudgedFrom: r.rejudged.previous.model } : {}),
      ms: { baseline: r.baseline?.ms ?? null, control: r.control_?.ms ?? null, realigned: r.realigned?.ms ?? null, judge: r.judge?.ms ?? null },
      scores: Object.fromEntries(rubric.axes.map((a) => [a.id, Object.fromEntries(SIDES.map((s) => [s, r.judge.scores?.[a.id]?.[s]?.score ?? null]))])),
    });
  }
  runs.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(join(RUNS, "index.json"), JSON.stringify({ v: 2, hero: HERO, bench: BENCH, samples: SAMPLES, runs }, null, 1));
  return runs.length;
}

if (!key) {
  console.log("GROQ_API_KEY is not set: rebuilding runs/index.json only.");
  console.log(`${await writeIndex()} runs indexed`);
  process.exit(0);
}
await mkdir(RUNS, { recursive: true });
const presets = rubric.presets.filter((p) => !ONLY || p.id === ONLY);
const heroBaseline = (await phase0Baseline()) ?? (await storedHeroBaseline());
const totals = { in: 0, out: 0, runs: 0, ms: 0 };
let stopped = null;
outer: for (let sample = 1; sample <= SAMPLES; sample++) {
  for (const p of presets) {
    for (const m of BENCH) {
      const id = runId(p.id, m.model, sample);
      const file = join(RUNS, `${id}.json`);
      if (!FRESH && (await exists(file))) {
        let prev = null;
        try { prev = JSON.parse(await readFile(file, "utf8")); } catch {}
        const answered = prev?.v === 2 && SIDES.every((s) => (s === "control" ? prev.control_ : prev[s])?.text);
        if (answered && prev.models.judgeModel !== m.judgeModel) {
          // Same answers, new judge (cross-family): re-run stage E only.
          const t0 = Date.now();
          console.log(`▸ ${id} · re-judging with ${m.judgeModel} (was ${prev.models.judgeModel})`);
          const before = { model: prev.judge.model ?? prev.models.judgeModel, totals: prev.judge.totals, max: prev.judge.max, comparableAxes: prev.judge.comparableAxes, verdict: prev.judge.verdict, tokens: prev.judge.tokens ?? null };
          if (prev.judge.tokens) prev.tokens = { in: prev.tokens.in - prev.judge.tokens.in, out: prev.tokens.out - prev.judge.tokens.out };
          try {
            await judgeRun(rubric, transport, m, prev);
          } catch (e) {
            if (e instanceof LlmError && e.code === "rate-daily") { stopped = e.message; break outer; }
            console.log(`  failed: ${e.message}`);
            continue;
          }
          if (prev.judge.status !== "ok" && /per day|daily/i.test(prev.judge.error || "")) { stopped = prev.judge.error; break outer; }
          prev.models = { ...m, sameJudge: m.judgeModel === m.model && m.judgeProvider === m.provider };
          prev.rejudged = { at: new Date().toISOString(), previous: before };
          await writeFile(file, JSON.stringify(prev, null, 1));
          totals.runs++;
          console.log(`  ${prev.status} · judge ${prev.judge.status} · ${SIDES.map((s) => `${s} ${prev.judge.totals?.[s] ?? "–"}`).join(" · ")} / ${prev.judge.max} (was ${SIDES.map((s) => before.totals?.[s] ?? "–").join("/")}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
          await writeIndex();
          continue;
        }
        if (prev?.v === 2 && prev.status === "complete") continue;
      }
      const t0 = Date.now();
      console.log(`▸ ${id}`);
      try {
        const run = await runHarness(E, ci, transport, m, p.prompt, {
          preset: p,
          sample,
          sequential: true,
          maxTokens: 1500,
          corpusHash: facts.corpusHash,
          baseline: id === HERO && heroBaseline ? heroBaseline : undefined,
        });
        run.id = id;
        await writeFile(file, JSON.stringify(run, null, 1));
        const j = run.judge;
        totals.in += run.tokens.in;
        totals.out += run.tokens.out;
        totals.runs++;
        totals.ms += Date.now() - t0;
        console.log(`  ${run.status} · judge ${j.status} · ${SIDES.map((s) => `${s} ${j.totals?.[s] ?? "–"}`).join(" · ")} / ${j.max} · ${run.tokens.in + run.tokens.out} tokens · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        const fail = SIDES.map((s) => (s === "control" ? run.control_ : run[s])).find((x) => x.error?.code === "rate-daily") || (j.error && /per day|daily/i.test(j.error) ? { error: { message: j.error } } : null);
        if (fail) { stopped = fail.error.message; break outer; }
      } catch (e) {
        if (e instanceof LlmError && e.code === "rate-daily") { stopped = e.message; break outer; }
        console.log(`  failed: ${e.message}`);
      }
      await writeIndex();
    }
  }
}
const n = await writeIndex();
console.log(`\n${totals.runs} run(s) recorded this pass · ${totals.in + totals.out} tokens (${totals.in} in, ${totals.out} out) · ${(totals.ms / 60000).toFixed(1)} min · ${n} runs indexed`);
if (stopped) console.log(`Stopped on a daily limit: ${stopped}\nRun again later; recording resumes where it stopped.`);
