// The 3-way multi-model benchmark, aggregated from runs/index.json at build time.
// Two honest measures per model and condition:
//   comparable %: totals over the axes where all three answers kept verified evidence, as a share of the maximum;
//   axis means:   every verified axis score (0–4), averaged per axis.
// Runs where no axis was comparable are counted but excluded from the comparable %.
import { SIDES, type Side } from "@/lib/core/judge";
import { getRubric, getRunIndex, type RunSummary } from "./data";

export interface ModelRow {
  model: string;
  judge: string;
  runs: number;
  complete: number;
  /** Runs with at least one comparable axis. */
  comparableRuns: number;
  pct: Record<Side, number | null>;
  /** Mean verified score per axis per side (0–4). */
  axis: Record<string, Record<Side, number | null>>;
  wins: Record<Side | "tie", number>;
  tokens: { in: number; out: number };
  /** Mean seconds per side (answer time, including the follow-up turn). */
  secs: Record<Side, number | null>;
  /** Spread of the per-run share across comparable runs (standard deviation, percentage points); null below 2 runs. */
  sd: Record<Side, number | null>;
  /** Samples recorded per preset for this model: fewest and most. */
  n: { min: number; max: number };
  /** Runs whose stored answers were re-scored by a cross-family judge. */
  rejudged: number;
}
export interface PresetCell {
  model: string;
  runs: RunSummary[];
  pct: Record<Side, number | null>;
  /** Comparable runs behind pct (n = 1 is a single sample). */
  n: number;
}
export interface Bench {
  models: ModelRow[];
  /** Across every model: share of the maximum per condition, over complete runs with comparable axes. */
  overall: Record<Side, number | null>;
  comparable: number;
  presets: { id: string; title: string; hook: string | null; followUp: string | null; cells: PresetCell[] }[];
  total: number;
  samples: number;
  hero: string;
}

const short = (m: string) => m.replace(/^.*\//, "");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function pctOf(runs: RunSummary[]): Record<Side, number | null> {
  const ok = runs.filter((r) => r.status === "complete" && r.comparableAxes > 0);
  const max = ok.reduce((n, r) => n + r.max, 0);
  return Object.fromEntries(SIDES.map((s) => [s, max ? Math.round((ok.reduce((n, r) => n + (r.totals[s] ?? 0), 0) / max) * 100) : null])) as Record<Side, number | null>;
}

const comparableRuns = (runs: RunSummary[]) => runs.filter((r) => r.status === "complete" && r.comparableAxes > 0 && r.max > 0);
function sdOf(runs: RunSummary[]): Record<Side, number | null> {
  const ok = comparableRuns(runs);
  return Object.fromEntries(SIDES.map((s) => {
    if (ok.length < 2) return [s, null];
    const xs = ok.map((r) => ((r.totals[s] ?? 0) / r.max) * 100);
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return [s, Math.round(Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)))];
  })) as Record<Side, number | null>;
}

export function getBench(): Bench {
  const ix = getRunIndex();
  const rubric = getRubric();
  const models = ix.bench.map<ModelRow>((m) => {
    const runs = ix.runs.filter((r) => r.models.model === m.model);
    const wins = { baseline: 0, control: 0, realigned: 0, tie: 0 } as ModelRow["wins"];
    for (const r of runs) if (r.verdict) wins[r.verdict]++;
    const axis = Object.fromEntries(
      rubric.axes.map((a) => [
        a.id,
        Object.fromEntries(SIDES.map((s) => {
          const v = mean(runs.map((r) => r.scores[a.id]?.[s]).filter((x): x is number => typeof x === "number"));
          return [s, v === null ? null : Math.round(v * 100) / 100];
        })),
      ]),
    ) as ModelRow["axis"];
    const secs = Object.fromEntries(
      SIDES.map((s) => {
        const v = mean(runs.map((r) => r.ms?.[s]).filter((x): x is number => typeof x === "number" && x > 0));
        return [s, v === null ? null : Math.round(v / 100) / 10];
      }),
    ) as ModelRow["secs"];
    return {
      model: short(m.model),
      judge: short(m.judgeModel),
      runs: runs.length,
      complete: runs.filter((r) => r.status === "complete").length,
      comparableRuns: runs.filter((r) => r.status === "complete" && r.comparableAxes > 0).length,
      pct: pctOf(runs),
      axis,
      wins,
      tokens: runs.reduce((t, r) => ({ in: t.in + (r.tokens?.in ?? 0), out: t.out + (r.tokens?.out ?? 0) }), { in: 0, out: 0 }),
      secs,
      sd: sdOf(runs),
      n: (() => {
        const per = rubric.presets.map((p) => runs.filter((r) => r.preset === p.id).length);
        return { min: Math.min(...per), max: Math.max(...per) };
      })(),
      rejudged: runs.filter((r) => r.rejudgedFrom).length,
    };
  });
  const presets = rubric.presets.map((p) => ({
    id: p.id,
    title: p.title,
    hook: ix.runs.find((r) => r.preset === p.id)?.hook ?? null,
    followUp: p.followUp ?? null,
    cells: ix.bench.map((m) => {
      const runs = ix.runs.filter((r) => r.preset === p.id && r.models.model === m.model).sort((a, b) => a.sample - b.sample);
      return { model: short(m.model), runs, pct: pctOf(runs), n: comparableRuns(runs).length };
    }),
  }));
  const comparable = ix.runs.filter((r) => r.status === "complete" && r.comparableAxes > 0).length;
  return { models, overall: pctOf(ix.runs), comparable, presets, total: ix.runs.length, samples: ix.samples, hero: ix.hero };
}
