// Ask: chat with the knowledge graph. Retrieval is the deterministic diagnosis engine; with a key a model writes a
// grounded, cited answer; without one the answer is composed from the graph itself (and says so).
import { diagnose, type Diagnosis, type Engine } from "./engine.ts";
import { extractCitations, splitCombined, stripCitations, type Citation } from "./citations.ts";
import type { LlmRequest, Msg, ProviderId } from "./llm.ts";

export const ASK_SYSTEM = `You are Sārathi, a lucid and scholarly guide to the Principal Upanishads inside UpaSārathi.

GROUNDING
- Answer ONLY from the EVIDENCE PACKET supplied with each question: verses (Sanskrit, IAST, a translation in the tradition of Śaṅkara), concepts, stories, and a tentative reading of the question.
- Cite precisely, using exactly these forms: [KaU 1.2.2], [MuU 3.1.1], [Concept: Śreyas], [Story: Indra and Virocana]. Cite only ids that appear in the packet.
- Never invent a verse, a verse number, a quotation or Sanskrit. Quote at most one or two short lines, copied exactly from the packet, each followed by its meaning. If the packet does not contain something, say so plainly.
- Distinguish what the text says from how a commentator (Śaṅkara) reads it, and from your own explanation.

VOICE
- Answer the question that was asked. For a study question, begin by explaining. Do not tell the person what they feel; acknowledge a feeling only if they expressed it, and then tentatively.
- For a personal question you may end with one gentle reflection, offered as something to consider. Never end with an offer to do more.
- 140 to 320 words unless asked for more.

FORMAT (the app renders only these)
- Short paragraphs; "- " or "1. " lists; **bold**; *italic*; "> " quotations; "### " headings. No HTML, no tables.

CARE
- You are not a therapist. If someone mentions self-harm or suicide, put their safety first: urge them to contact a crisis line (India: Tele-MANAS 14416; worldwide: findahelpline.com) or emergency services, and keep scripture brief and supportive.`;

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

// People ask in everyday words; the graph is organised by ideas. Each theme maps plain language to the concepts and
// stories that answer it. Deliberately small and editorial (every target is a reviewed node), and visible as the
// "why" of each seed.
const THEMES: { re: RegExp; ids: string[]; why: string; unless?: RegExp }[] = [
  { unless: /\b(who am i|true self|real me)\b/i, re: /\b(money|wealth|rich|salary|pay(s|ing)?|paid|job|career|promotion|offer(ed)?|success|fame|status|bonus|double)\b/i, ids: ["concept:shreyas", "concept:preyas", "story:naciketas"], why: "a choice between what pleases and what is good" },
  { re: /\b(cho(ose|ice)|decid\w*|dilemma|torn|should i|which (one|way|path))\b/i, ids: ["concept:shreyas", "concept:viveka"], why: "a question of discernment" },
  { re: /\b(fear\w*|afraid|death|die|dying|dead|mortal\w*|grief|griev\w*|loss|lost (my|a)|funeral)\b/i, ids: ["story:naciketas", "concept:atman"], why: "the Kaṭha's dialogue with Death" },
  { re: /\b(who am i|myself|identity|ego|my body|my mind|real me|true self|self)\b/i, ids: ["concept:atman", "story:indra-virocana", "concept:sakshin"], why: "the inquiry into the Self" },
  { re: /\b(ang(er|ry)|hate|revenge|jealous\w*|envy|resent\w*|furious)\b/i, ids: ["concept:kama", "concept:da"], why: "anger as desire thwarted" },
  { re: /\b(desire|want(ing)?|crav\w*|addict\w*|lust|tempt\w*|urge)\b/i, ids: ["concept:kama", "concept:indriya", "concept:buddhi-sarathi"], why: "the senses and the reins" },
  { re: /\b(phone|scroll\w*|distract\w*|focus|attention|social media|instagram|youtube)\b/i, ids: ["concept:indriya", "concept:pratyak", "concept:buddhi-sarathi"], why: "attention turned outward" },
  { re: /\b(happ(y|iness)|joy|bliss|fulfil\w*|content\w*|enough|empty|meaning(less)?|purpose)\b/i, ids: ["concept:bhuman"], why: "the joy that is in the boundless" },
  { re: /\b(truth|true|lie|lying|honest\w*|dishonest\w*|integrity)\b/i, ids: ["concept:satya", "concept:anrta"], why: "truth and untruth" },
  { re: /\b(teacher|guru|mentor|learn\w*|stud(y|ent)|school|exam)\b/i, ids: ["concept:acarya", "concept:svadhyaya", "story:satyakama"], why: "learning from a teacher" },
  { re: /\b(knowledge|wisdom|wise|ignoran\w*|understand\w*|know(ing)? (nothing|everything))\b/i, ids: ["concept:vidya", "concept:avidya", "concept:avijnata"], why: "the two kinds of knowledge" },
  { re: /\b(pride|proud|arrogan\w*|conceit\w*|better than|superior)\b/i, ids: ["concept:abhimana", "story:shvetaketu"], why: "the conceit of learning" },
  { re: /\b(sleep|dream\w*|awake|waking|conscious\w*|om|aum)\b/i, ids: ["concept:turiya"], why: "the states of consciousness" },
  { re: /\b(god|divine|universe|everything|oneness|reality|tat tvam asi)\b/i, ids: ["concept:brahman", "story:shvetaketu"], why: "the one Reality" },
  { re: /\b(witness|observ\w*|watch\w*|bird)\b/i, ids: ["concept:sakshin", "concept:bhoktr"], why: "the two birds" },
  { re: /\b(giv(e|ing)|generous|generosity|compassion\w*|kind(ness)?|restrain\w*|selfish)\b/i, ids: ["concept:da"], why: "Da, Da, Da" },
  { re: /\b(discipline|effort|practice|austerit\w*|work hard|hard work|tapas|lazy)\b/i, ids: ["concept:tapas"], why: "disciplined inquiry" },
  { re: /\b(marri\w*|wife|husband|love|partner|relationship|beloved)\b/i, ids: ["story:maitreyi", "concept:atman"], why: "Yājñavalkya to Maitreyī: it is for the Self that all is dear" },
  { re: /\b(chariot\w*|horses?|reins|charioteer)\b/i, ids: ["concept:buddhi-sarathi", "concept:indriya"], why: "the chariot image of the Kaṭha" },
];
export function askThemes(question: string): { id: string; why: string }[] {
  const out = new Map<string, string>();
  for (const t of THEMES) if (t.re.test(question) && !t.unless?.test(question)) for (const id of t.ids) if (!out.has(id)) out.set(id, t.why);
  return [...out].slice(0, 6).map(([id, why]) => ({ id, why }));
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** People named in the question lead to the stories they appear in ("Why did Virocana leave?" → Indra and Virocana). */
export function askNames(E: Engine, question: string): { id: string; why: string; weight: number }[] {
  const q = ` ${fold(question).replace(/[^a-z\s]/g, " ")} `;
  const named = E.kb.persons.filter((p) => {
    const name = fold(p.iast).replace(/[^a-z]/g, "").replace(/a$/, "");
    return name.length >= 4 && new RegExp(`\\s${name}a?s?\\s`).test(q);
  });
  // A story that casts more of the people named comes first ("Virocana and Indra" is Prajāpati's teaching,
  // not every story Indra appears in).
  return E.kb.stories
    .map((s) => ({ s, cast: named.filter((p) => s.cast.includes(p.id)) }))
    .filter((x) => x.cast.length)
    .sort((a, b) => b.cast.length - a.cast.length)
    .slice(0, 3)
    .map(({ s, cast }, _i, all) => ({ id: `story:${s.id}`, why: `the question names ${cast.map((p) => p.iast).join(" and ")}`, weight: cast.length === all[0].cast.length ? 1.6 : 0.5 }));
}

export function askRetrieve(E: Engine, question: string, history: AskTurn[] = []): Diagnosis {
  const carried = [...history].reverse().find((t) => t.role === "assistant" && t.citations?.length)?.citations?.slice(0, 4) ?? [];
  const short = question.trim().split(/\s+/).length < 7; // "why?", "say more about that" → lean on the last answer
  const themes = [...askNames(E, question), ...askThemes(question)].slice(0, 6);
  return diagnose(E, question, { maxVerses: 6, extraSeeds: short ? carried : carried.slice(0, 2), themes });
}

export function askRequest(provider: ProviderId, model: string, question: string, packet: string, history: AskTurn[] = []): LlmRequest {
  const past: Msg[] = history.slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 3000) }));
  return {
    provider,
    model,
    temperature: 0.5,
    maxTokens: 2400,
    reasoning: "low",
    stream: true,
    messages: [{ role: "system", content: ASK_SYSTEM }, ...past, { role: "user", content: `${packet}\n\n---\nQuestion: ${question}` }],
  };
}

/** Keep only citations that point into the packet; the rest are removed from the text, never shown as sources. */
export function auditAnswer(E: Engine, text: string, d: Diagnosis): { text: string; citations: Citation[]; stripped: string[] } {
  const t = splitCombined(text, E.kb.texts.map((x) => x.abbrev));
  const cites = extractCitations(E.kb, t, new Set(d.allowed));
  const bad = cites.filter((c) => !c.allowed);
  return { text: stripCitations(t, bad), citations: cites.filter((c) => c.allowed), stripped: bad.map((c) => c.raw) };
}

const PRACTICE: Record<string, string> = {
  "concept:shreyas": "Before your next choice today, name the pleasant option and the good one out loud. Notice which one you were about to take.",
  "concept:viveka": "Take one decision you are carrying and write two columns: what you know, and what you only hope.",
  "concept:buddhi-sarathi": "When a craving pulls today, ask: who is holding the reins right now?",
  "concept:satya": "Say one true thing today that you would normally soften into something pleasant.",
  "concept:avijnata": "Write down one thing you are sure you understand, and one honest question you still have about it.",
  "concept:pratyak": "Put the phone face down for ten minutes and notice where attention goes when nothing pulls it.",
  "concept:bhuman": "Notice one small pleasure today and ask whether it leaves you fuller or emptier.",
  "concept:sakshin": "For one hour, watch your reactions as the second bird would: noticing, not eating.",
  "concept:atman": "Sit for five minutes and notice what in you has watched every change and not itself changed.",
  "concept:da": "Today, one act of restraint, one of giving, one of compassion: Da, Da, Da.",
};

/** A zero-key answer composed only from the retrieved subgraph. Works fully offline. */
export function composeOfflineAnswer(E: Engine, d: Diagnosis): string {
  const { kb } = E;
  if (d.crisis) {
    return "**Please reach out to someone now.** If you are thinking about ending your life or harming yourself, contact a crisis line: in India, Tele-MANAS **14416**; worldwide, **findahelpline.com**; or your local emergency number. You deserve support from a person, today.";
  }
  if (d.status === "INSUFFICIENT_EVIDENCE") {
    return "I could not find anything in this corpus of the Upanishads that speaks directly to that. Try naming an idea (the good and the pleasant, the chariot, the witness, truth), a story (Naciketas, Indra and Virocana, Satyakāma), or a verse such as Kaṭha 1.2.2.";
  }
  const lines: string[] = [];
  const top = d.dilemmas[0] && kb.dilemmas.find((x) => x.id === d.dilemmas[0].id);
  const topConcept = d.concepts[0] && kb.concepts.find((c) => `concept:${c.id}` === d.concepts[0].id);
  if (top && d.dilemmas[0].score >= 2.5) {
    lines.push(`This reads like a question about **${top.en.toLowerCase()}**. ${top.desc}`);
    lines.push(`- **The pleasant answer** (*preyas*) would give: ${top.preyas}\n- **The good answer** (*śreyas*): ${top.shreyas}`);
  } else if (topConcept) {
    lines.push(`**${topConcept.iast[0].toUpperCase()}${topConcept.iast.slice(1)}** (${topConcept.sa}), *${topConcept.en}* [Concept: ${topConcept.iast}]. ${topConcept.desc}`);
  } else {
    lines.push("Here is what the knowledge graph brings together for your question.");
  }
  lines.push("\n### What the Upanishads say");
  for (const r of d.verses.slice(0, 4)) {
    const v = E.verse.get(r.id);
    if (!v) continue;
    const t = kb.texts.find((x) => x.id === v.up)!;
    const tr = v.tr.replace(/\s+/g, " ");
    const short = tr.length > 240 ? `${tr.slice(0, 237).replace(/\s+\S*$/, "")}…` : tr;
    lines.push(`- **[${t.abbrev} ${v.ref}]** “${short}”\n  *${r.why}*`);
  }
  const story = d.stories[0] && kb.stories.find((s) => `story:${s.id}` === d.stories[0].id);
  if (story) lines.push(`\n### A story to read\n${story.summary} [Story: ${story.title}]`);
  const practiceKey = [...d.concepts.map((c) => c.id)].find((id) => PRACTICE[id]);
  if (practiceKey) lines.push(`\n### To consider\n${PRACTICE[practiceKey]}`);
  return lines.join("\n");
}
