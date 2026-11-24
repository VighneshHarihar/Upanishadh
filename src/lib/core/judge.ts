// Stage E: the blind judge. The three answers (baseline, honesty control, UpaSārathi) are shuffled into A/B/C by a
// deterministic permutation of the prompt's hash and scored 0–4 on the rubric axes. Every score must carry a quote that
// occurs verbatim in the answer it scores; scores whose evidence cannot be found are discarded and counted, never
// shown as if they were valid. Totals compare only the axes on which every answer kept its evidence.
import { canon, hash } from "./text.ts";
import type { Msg } from "./llm.ts";
import type { Rubric } from "./types.ts";

export type Side = "baseline" | "control" | "realigned";
export const SIDES: Side[] = ["baseline", "control", "realigned"];
export const SIDE_LABEL: Record<Side, string> = { baseline: "Baseline", control: "Honesty control", realigned: "UpaSārathi" };
const LETTERS = ["A", "B", "C", "D"];

export interface AxisScore {
  score: number | null;
  raw: number;
  evidence: string;
  verified: boolean;
}
export interface JudgeResult {
  status: "ok" | "unavailable" | "skipped";
  /** order[i] is the condition the judge saw as letter i (A, B, C). */
  order: Side[];
  scores: Record<string, Partial<Record<Side, AxisScore>>>;
  /** Sums over the axes where EVERY answer's evidence was verified, so the totals are always comparable. */
  totals: Partial<Record<Side, number>>;
  max: number;
  comparableAxes: number;
  verdict: Side | "tie" | null;
  /** True when the judge gave no usable verdict and it was derived from the totals. */
  verdictDerived?: boolean;
  summary: string;
  rejectedEvidence: number;
  sameModel: boolean;
  model: string | null;
  ms: number;
  tokens?: { in: number; out: number };
  error?: string;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}
/** The order in which the judge sees the answers: a fixed permutation chosen by the prompt's hash (reproducible). */
export const judgeOrder = (prompt: string, sides: Side[] = SIDES): Side[] => {
  const perms = permutations(sides);
  return perms[hash(prompt) % perms.length];
};

export function judgeMessages(rubric: Rubric, prompt: string, answers: string[], facts: string[], context = ""): Msg[] {
  const letters = LETTERS.slice(0, answers.length);
  const axes = rubric.axes.map((x) => `- ${x.id} (${x.label}, ${x.en}): ${x.question}\n    0 = ${x.levels[0]}\n    2 = ${x.levels[2]}\n    4 = ${x.levels[4]}`).join("\n");
  const responses = answers
    .map((a, i) => `RESPONSE ${letters[i]}:\n<<<${a || "(empty response)"}>>>\nAUDIT OF ${letters[i]} (computed by code):\n${facts[i] || "- (no audit)"}`)
    .join("\n\n");
  const shape = `{"scores": {"<axis id>": {${letters.map((l) => `"${l}": {"score": 0, "evidence": "<verbatim quote from ${l}>"}`).join(", ")}}}, "verdict": ${letters.map((l) => `"${l}"`).join(" | ")} | "tie", "summary": "<at most 50 words>"}`;
  const user = rubric.judgeTemplate
    .replace("{{PROMPT}}", prompt)
    .replace("{{CONTEXT}}", context)
    .replace("{{RESPONSES}}", responses)
    .replace("{{AXES}}", axes)
    .replace("{{SHAPE}}", shape)
    .replace("{{AXIS_IDS}}", rubric.axes.map((x) => x.id).join(", "))
    .replace("{{LETTERS}}", letters.map((l) => `"${l}"`).join(", "));
  return [
    { role: "system", content: rubric.judgeSystem },
    { role: "user", content: user },
  ];
}

export interface RawJudge {
  scores: Record<string, Record<string, { score: number; evidence: string }>>;
  verdict: string;
  summary: string;
}

/** Parse and validate the judge's JSON. Throws with a precise reason when the shape is wrong. */
export function parseJudge(text: string, axisIds: string[], n = 3): RawJudge {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("judge returned no JSON object");
  let j: unknown;
  try {
    j = JSON.parse(text.slice(s, e + 1));
  } catch {
    throw new Error("judge JSON does not parse");
  }
  const o = j as RawJudge;
  if (!o || typeof o !== "object" || !o.scores || typeof o.scores !== "object") throw new Error("judge JSON has no scores");
  for (const id of axisIds) {
    const ax = o.scores[id];
    if (!ax) throw new Error(`judge JSON is missing axis ${id}`);
    for (const letter of LETTERS.slice(0, n)) {
      const v = ax[letter];
      if (!v || typeof v.score !== "number" || v.score < 0 || v.score > 4 || typeof v.evidence !== "string") throw new Error(`judge JSON axis ${id}.${letter} is malformed`);
    }
  }
  return { scores: o.scores, verdict: String(o.verdict || ""), summary: String(o.summary || "").slice(0, 500) };
}

/** Evidence must occur in the response it scores. Ellipses may join fragments; each fragment must occur in order. */
export function evidenceOccurs(evidence: string, response: string): boolean {
  const ev = canon(evidence).replace(/^["'\s]+|["'\s]+$/g, "");
  if (!ev) return !response.trim();
  const body = canon(response);
  let from = 0;
  // Quotation marks and end punctuation are the judge's framing, not part of the claim.
  const frags = ev.split(/\s*(?:\.\.\.|…)\s*/).map((f) => f.replace(/^[\s"'(]+|[\s"'.,;:!?)]+$/g, "")).filter((f) => f.length >= 3);
  if (!frags.length) return false;
  for (const frag of frags) {
    const i = body.indexOf(frag, from);
    if (i < 0) return false;
    from = i + frag.length;
  }
  return true;
}

/** Map letters back to conditions, verify every piece of evidence, and total the comparable axes. */
export function resolveJudge(raw: RawJudge, rubric: Rubric, order: Side[], texts: Partial<Record<Side, string>>): Omit<JudgeResult, "status" | "sameModel" | "model" | "ms"> {
  const scores: JudgeResult["scores"] = {};
  const totals: Partial<Record<Side, number>> = Object.fromEntries(order.map((s) => [s, 0]));
  let rejected = 0;
  let comparable = 0;
  for (const ax of rubric.axes) {
    const row: Partial<Record<Side, AxisScore>> = {};
    order.forEach((side, i) => {
      const v = raw.scores[ax.id][LETTERS[i]];
      const verified = evidenceOccurs(v.evidence, texts[side] || "");
      if (!verified) rejected++;
      row[side] = { score: verified ? Math.round(v.score) : null, raw: v.score, evidence: v.evidence, verified };
    });
    if (order.every((s) => row[s]?.score !== null && row[s]?.score !== undefined)) {
      comparable++;
      for (const s of order) totals[s] = (totals[s] ?? 0) + (row[s]!.score as number);
    }
    scores[ax.id] = row;
  }
  const v = raw.verdict.trim().toUpperCase().replace(/^RESPONSE\s+/, "");
  const li = LETTERS.slice(0, order.length).findIndex((l) => new RegExp(`^${l}\\b`).test(v));
  let verdict: Side | "tie" | null = li >= 0 ? order[li] : /^TIE/.test(v) ? "tie" : null;
  const verdictDerived = verdict === null;
  // No usable verdict from the judge: derive it from the comparable totals, and say so.
  if (verdict === null) {
    const best = Math.max(...order.map((s) => totals[s] ?? 0));
    const top = order.filter((s) => (totals[s] ?? 0) === best);
    verdict = top.length > 1 ? "tie" : top[0];
  }
  return { order, scores, totals, max: comparable * 4, comparableAxes: comparable, verdict, verdictDerived, summary: raw.summary, rejectedEvidence: rejected };
}
