// Citation grammar shared by the prompt, the audit and the renderer:
//   [KaU 1.2.2]  [IU 15]  [Concept: Śreyas]  [Story: Indra and Virocana]
import { fold } from "./text.ts";
import type { KnowledgeBase } from "./types.ts";

export interface Citation {
  raw: string;
  kind: "verse" | "concept" | "story" | "unknown";
  id: string | null;
  label: string;
  /** In the evidence packet the model was given. */
  allowed: boolean;
}

export function citeRegex(abbrevs: string[]): RegExp {
  return new RegExp(`\\[(?:(${abbrevs.join("|")})\\s*(\\d+(?:\\.\\d+){0,2})|(Concept|Story)\\s*:\\s*([^\\]\\n]{1,64}))\\]`, "g");
}

export function resolveCitation(kb: KnowledgeBase, raw: string, m: RegExpMatchArray): Omit<Citation, "allowed"> {
  if (m[1]) {
    const id = `${m[1]}_${m[2]}`;
    return { raw, kind: "verse", id: kb.verses.some((v) => v.id === id) ? id : null, label: `${m[1]} ${m[2]}` };
  }
  const want = fold(m[4]);
  if (m[3].toLowerCase() === "concept") {
    const c = kb.concepts.find((x) => [x.iast, x.en, x.id.replace(/-/g, " "), x.sa].some((n) => fold(n) === want)) ||
      kb.concepts.find((x) => [x.iast, x.en].some((n) => fold(n).startsWith(want) || want.startsWith(fold(n))));
    return { raw, kind: "concept", id: c ? `concept:${c.id}` : null, label: m[4].trim() };
  }
  const s = kb.stories.find((x) => fold(x.title) === want) || kb.stories.find((x) => fold(x.title).includes(want) || want.includes(fold(x.title)));
  return { raw, kind: "story", id: s ? `story:${s.id}` : null, label: m[4].trim() };
}

export function extractCitations(kb: KnowledgeBase, text: string, allowed?: Set<string>): Citation[] {
  const re = citeRegex(kb.texts.map((t) => t.abbrev));
  const seen = new Map<string, Citation>();
  for (const m of text.matchAll(re)) {
    if (seen.has(m[0])) continue;
    const c = resolveCitation(kb, m[0], m);
    seen.set(m[0], { ...c, allowed: Boolean(c.id && (!allowed || allowed.has(c.id))) });
  }
  return [...seen.values()];
}

/** "[KaU 1.3.3, Concept: Buddhi as sārathi]" → "[KaU 1.3.3] [Concept: Buddhi as sārathi]" when every part is a citation. */
export function splitCombined(text: string, abbrevs: string[]): string {
  const one = new RegExp(`^(?:(?:${abbrevs.join("|")})\\s*\\d+(?:\\.\\d+){0,2}|(?:Concept|Story)\\s*:\\s*[^\\],;\\n]{1,64})$`);
  return text.replace(/\[([^\]\n]{3,160})\]/g, (all, inner: string) => {
    const parts = inner.split(/\s*[;,]\s*(?=(?:[A-Z][a-zA-Z]{0,3}\s*\d)|Concept\s*:|Story\s*:)/).map((p) => p.trim());
    return parts.length > 1 && parts.every((p) => one.test(p)) ? parts.map((p) => `[${p}]`).join(" ") : all;
  });
}

/** Remove citations that point outside the packet (or nowhere), keeping the sentence intact. */
export function stripCitations(text: string, bad: Citation[]): string {
  let out = text;
  for (const c of bad) out = out.split(c.raw).join("");
  return out.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ");
}
