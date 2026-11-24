// Verify every recorded harness run against the current corpus and core code. A run that cannot be re-derived
// (citation outside its packet, quote result that no longer holds, a counted score without verbatim evidence)
// fails the check rather than being replayed as if it were valid.
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { extractCitations } from "../../src/lib/core/citations.ts";
import { corpusIndex, runChecks } from "../../src/lib/core/checks.ts";
import { evidenceOccurs, SIDES } from "../../src/lib/core/judge.ts";
import { compile } from "./compile.mjs";

const answer = (r, side) => (side === "control" ? r.control_ : r[side]);

export async function verifyRuns(ROOT, built) {
  const D = join(ROOT, "public", "data");
  const read = async (f) => JSON.parse(await readFile(join(D, f), "utf8"));
  const { kb, graph, facts } = built ?? (await compile(ROOT));
  const rubric = JSON.parse(await readFile(join(ROOT, "data", "curated", "rubric.json"), "utf8"));
  const ci = corpusIndex(kb);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const errors = [];
  const warnings = [];
  const summary = [];
  const dir = join(D, "runs");
  try { await access(dir); } catch { return { errors: ["public/data/runs is missing"], warnings, summary }; }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f !== "index.json");
  if (!files.length) errors.push("no recorded runs");
  const index = await read("runs/index.json").catch(() => ({ runs: [] }));
  const indexed = Array.isArray(index) ? index : index.runs || [];

  for (const f of files) {
    const r = await read(`runs/${f}`);
    const at = `run ${r.id}`;
    const err = (m) => errors.push(`${at}: ${m}`);
    if (r.v !== 2) { err(`record version ${r.v}; expected 2 (three conditions)`); continue; }
    if (`${r.id}.json` !== f) err(`file name does not match id`);
    const preset = rubric.presets.find((p) => p.id === r.preset);
    if (r.preset && !preset) err(`preset ${r.preset} no longer exists`);
    if (preset && preset.prompt !== r.prompt) err(`prompt differs from the preset in rubric.json`);
    if (preset && (preset.followUp ?? null) !== (r.followUp ?? null)) err(`follow-up differs from the preset`);
    if (r.corpusHash && r.corpusHash !== facts.corpusHash) warnings.push(`${at}: recorded against corpus ${r.corpusHash}, current ${facts.corpusHash}`);
    if (!r.models?.model || !r.models?.judgeModel) err(`models missing`);
    if (r.models.sameJudge !== (r.models.judgeModel === r.models.model && r.models.judgeProvider === r.models.provider)) err(`sameJudge flag is wrong`);
    for (const side of SIDES) if (!answer(r, side).text && !answer(r, side).error) err(`${side} is empty without an error`);
    for (const id of [...r.diagnosis.subgraph.nodes, ...r.diagnosis.verses.map((v) => v.id)]) if (!nodeIds.has(id)) err(`diagnosis refers to missing node ${id}`);

    // Citations: re-extract from the UpaSārathi answer with today's code; all must resolve and lie inside the packet.
    const allowed = new Set(r.diagnosis.allowed);
    const cites = extractCitations(kb, r.realigned.text, allowed);
    for (const c of cites) if (!c.id) err(`citation ${c.raw} does not resolve`);
    else if (!c.allowed) err(`citation ${c.raw} is outside the evidence packet`);
    const stored = new Set(r.realigned.citations.map((c) => c.id));
    for (const c of cites) if (c.id && !stored.has(c.id)) err(`citation ${c.raw} is not in the stored citation list`);

    // Deterministic checks must re-derive identically for all three answers.
    for (const side of SIDES) {
      const now = runChecks(kb, ci, rubric, answer(r, side).text);
      const was = r.checks[side];
      const sig = (c) => JSON.stringify([c.quotes.map((q) => [q.quote, q.found, q.scope ?? "corpus"]), (c.englishQuotes || []).map((q) => [q.quote, q.found]), c.claimedRefs.map((x) => [x.raw, x.id, x.outside ?? null]), Boolean(c.engagementBait), Boolean(c.flatteryOpener), c.unsupportedClaims || []]);
      if (sig(now) !== sig(was)) err(`${side} checks no longer re-derive (stored ${sig(was).slice(0, 120)} vs now ${sig(now).slice(0, 120)})`);
    }

    // Judge: every counted score must have evidence that occurs in its answer, and the totals must add up.
    const j = r.judge;
    if (j.status === "ok") {
      const tot = Object.fromEntries(SIDES.map((s) => [s, 0]));
      let comparable = 0;
      for (const ax of rubric.axes) {
        const s = j.scores[ax.id];
        if (!s) { err(`judge lacks axis ${ax.id}`); continue; }
        for (const side of SIDES) {
          const v = s[side];
          if (!v) { err(`judge ${ax.id} lacks ${side}`); continue; }
          if (v.verified !== evidenceOccurs(v.evidence, answer(r, side).text)) err(`judge ${ax.id}.${side}: evidence verification does not re-derive`);
          if (v.verified && v.score === null) err(`judge ${ax.id}.${side}: verified score is null`);
          if (!v.verified && v.score !== null) err(`judge ${ax.id}.${side}: unverified score is counted`);
        }
        if (SIDES.every((side) => s[side]?.score !== null && s[side]?.score !== undefined)) {
          comparable++;
          for (const side of SIDES) tot[side] += s[side].score;
        }
      }
      if (SIDES.some((side) => tot[side] !== j.totals[side]) || comparable !== j.comparableAxes || j.max !== comparable * 4) err(`judge totals do not add up`);
      if (j.sameModel !== r.models.sameJudge) err(`judge sameModel flag disagrees with models`);
    } else if (r.status === "complete") err(`judge ${j.status} but status is complete`);
    if (!indexed.some((x) => x.id === r.id)) err(`missing from runs/index.json`);
    summary.push({ id: r.id, model: r.models.model, judge: j.status, totals: SIDES.map((s) => j.totals?.[s] ?? "–").join("/") });
  }

  // The homepage hero promises: a fabricated verse, stamped as not found, answered with KaU 1.1.27 and its chant.
  const heroId = Array.isArray(index) ? null : index.hero;
  const hero = heroId && files.includes(`${heroId}.json`) ? await read(`runs/${heroId}.json`) : null;
  if (!hero) errors.push("hero run (runs/index.json → hero) is missing");
  else {
    if (!hero.checks.baseline.quotes.some((q) => !q.found && q.scope !== "outside")) errors.push("hero: baseline has no unverified quotation to stamp");
    if (!hero.diagnosis.verses.some((v) => v.id === "KaU_1.1.27")) errors.push("hero: KaU 1.1.27 is not in the evidence packet");
    if (!kb.verses.find((v) => v.id === "KaU_1.1.27")?.audio) errors.push("hero: KaU 1.1.27 has no chant audio");
  }
  return { errors, warnings, summary };
}
