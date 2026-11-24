// Pure text preparation for the speech engines (no DOM; shared by the browser, the tests and the offline script).

// ── Sanskrit, for Vāgdhenu ────────────────────────────────────────────────────────────────────────
const CONSONANT = /[क-हक़-य़]/;
const AKSHARA = /[क-हक़-य़](?![़]?्)|[ऄ-औॠॡऌ]/g;

/** Syllables (akṣaras) in a Devanagari string: every vowel, written or inherent. */
export const aksharas = (deva: string) => (deva.match(AKSHARA) || []).length;

/** One line of a passage as the chant engine wants it: no daṇḍas, verse numbers, quotes or brackets. */
export function cleanDeva(line: string): string {
  return line
    .replace(/ॐ/g, "ओम्")
    .replace(/[०-९0-9]+/g, " ")
    .replace(/[।॥|"'“”‘’()[\]{}॰*•·.,;:!?–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut a run of letters with no spaces (a long compound) into pieces of about `max` syllables, between akṣaras. */
function cutWord(word: string, max: number): string[] {
  const out: string[] = [];
  let start = 0;
  let n = 0;
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    const next = word[i + 1] ?? "";
    if (CONSONANT.test(c) ? !/[़्]/.test(next) : /[ऄ-औॠॡऌ]/.test(c)) n++;
    // A new akṣara starts at a consonant or a vowel letter; cut just before one once the piece is full.
    if (n >= max && (CONSONANT.test(next) || /[ऄ-औ]/.test(next)) && c !== "्") {
      out.push(word.slice(start, i + 1));
      start = i + 1;
      n = 0;
    }
  }
  if (start < word.length) out.push(word.slice(start));
  return out.filter(Boolean);
}

/** Split a long prose line at word boundaries into balanced pieces of at most `max` syllables. */
function balance(line: string, max: number): string[] {
  const words = line.split(" ").flatMap((w) => (aksharas(w) > max ? cutWord(w, max) : [w]));
  const total = words.reduce((s, w) => s + aksharas(w), 0);
  const parts = Math.max(1, Math.ceil(total / max));
  const target = total / parts;
  const out: string[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const w of words) {
    const k = aksharas(w);
    if (cur.length && n + k > max) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
    cur.push(w);
    n += k;
    if (n >= target && out.length < parts - 1) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/**
 * A passage's lines as the units the chant engine synthesizes one by one (a hemistich of verse, or a short phrase of
 * prose). Verse lines are kept whole up to `keep` syllables (the longest classical hemistichs run to about 40);
 * longer prose is cut at word boundaries into pieces of at most `max`. Four pieces are avoided, because the engine
 * pairs a four-line input into two hemistichs, which would double the length of a prose piece.
 */
export function chantSegments(sa: string[], { keep = 40, max = 28, join = 18 }: { keep?: number; max?: number; join?: number } = {}): string[] {
  const lines = sa.flatMap((l) => l.split(/[।॥|]/)).map(cleanDeva).filter((l) => aksharas(l) > 0);
  const split = lines.flatMap((l) => (aksharas(l) > keep ? balance(l, max) : [l]));
  // Very short prose sentences ("vāca ṛg rasaḥ") are chanted together, up to `join` syllables, for a natural flow
  // and fewer passes of the model.
  let out: string[] = [];
  for (const s of split) {
    const last = out.at(-1);
    if (last && aksharas(last) + aksharas(s) <= join) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  if (out.length === 4 && out.some((s) => aksharas(s) > 22)) {
    const i = out.reduce((best, s, k) => (aksharas(s) > aksharas(out[best]) ? k : best), 0);
    const halves = balance(out[i], Math.ceil(aksharas(out[i]) / 2));
    if (halves.length > 1) out = [...out.slice(0, i), ...halves, ...out.slice(i + 1)];
  }
  return out;
}

/** The engine's input: one unit per line (it splits on newlines and daṇḍas). */
export const chantText = (sa: string[]) => chantSegments(sa).join("\n");

// ── the chant engine's progress, for people ─────────────────────────────────────────────────────
/** The engine's progress lines, in plain words ("Hemistich 2/4: Step 3/7 (Guided CFG · WEBGPU)" → "Line 2 of 4 · pass 3 of 7"). */
export function friendly(msg: string): string {
  const step = msg.match(/(?:Hemistich|Part) (\d+)\/(\d+): Step (\d+)\/(\d+)/);
  if (step) return `Line ${step[1]} of ${step[2]} · pass ${step[3]} of ${step[4]}`;
  const prep = msg.match(/(?:Hemistich|Part) (\d+)\/(\d+): Preparing/);
  if (prep) return `Line ${prep[1]} of ${prep[2]} · preparing`;
  const dl = msg.match(/Downloading ([^:]+): ([\d.]+) \/ ([\d.]+) MB/);
  if (dl) return `Downloading the chant model, once · ${dl[1].replace(/ONNX |WASM MatMulInteger |Neural /g, "")} ${Math.round(+dl[2])} of ${Math.round(+dl[3])} MB`;
  if (/from browser cache/i.test(msg)) return "Loading the chant model from this browser…";
  if (/Initializing|Pre-warming/i.test(msg)) return "Starting the chant model…";
  return msg;
}

// ── English, for narration ────────────────────────────────────────────────────────────────────────
const IAST_PLAIN: [RegExp, string][] = [
  [/ś|ṣ/g, "sh"],
  [/Ś|Ṣ/g, "Sh"],
  [/ṛ|ṝ/g, "ri"],
  [/Ṛ|Ṝ/g, "Ri"],
  [/ḷ/g, "li"],
  [/ṃ|ṁ/g, "m"],
  [/ḥ/g, "h"],
];

/**
 * Text a voice can read: Devanagari dropped (it is printed above the translation), footnote marks, citations such as
 * "(Bṛhadā. Upa. III. viii. 11.)" and passage numbers such as "(7)" removed, and IAST spelt the way an English reader
 * would say it (Śaṅkara → Shankara, Upaniṣad → Upanishad, Ātman → Atman).
 */
export function speakable(raw: string): string {
  let s = raw
    .replace(/[ऀ-ॿ]+(?:[\sऀ-ॿ]*[ऀ-ॿ])?/g, " ")
    .replace(/\[\d+\]|\{\d+\}|\[p\.?\s*\d+\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/^\s*Com\.\s*[—-]\s*/gm, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  for (const [re, to] of IAST_PLAIN) s = s.replace(re, to);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
  s = s
    // A citation: abbreviated titles, then book / chapter / verse numbers (Roman or Arabic).
    .replace(/\s*\((?:see\s+|cf\.\s+)?(?:[A-Z][A-Za-z]{0,9}\.?\s*){1,4}(?:[IVXL]+\.?\s*)?(?:[ivxl]+\.?\s*)?\d+(?:\s*[.,–-]\s*\d+)*\.?\s*\)/g, "")
    // A passage number in brackets at the end of a paragraph, with the dash that leads into it.
    .replace(/\s*[—-]?\s*\(\d+(?:\s*[–-]\s*\d+)?\)\s*(?=$|\n)/g, "");
  return s
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim())
    .filter((l) => /[A-Za-z0-9]/.test(l))
    .join("\n");
}

// Full stops that do not end a sentence: titles, scholarly abbreviations, and the short names of texts in citations.
const ABBREV = new Set(["Mr", "Mrs", "Dr", "St", "Sri", "Shri", "Prof", "Skt", "Com", "Comm", "Ved", "Vol", "Up", "Upa", "Upan", "Br", "Bri", "Brih", "Brihad", "Brihada", "Ch", "Chh", "Chand", "Chhand", "Ka", "Kath", "Ke", "Mu", "Mund", "Ma", "Mand", "Tai", "Tait", "Taitt", "Ai", "Ait", "Sv", "Svet", "Shvet", "Pr", "Pras", "Prash", "Bh", "Gi", "Su", "Sut", "Mai", "Kaush", "Bk", "Pt", "Sec", "Ibid"]);
const ABBREV_LOWER = new Set(["e.g", "i.e", "cf", "viz", "vs", "vol", "p", "pp", "ch", "ed", "eds", "trans", "tr", "op", "cit", "ibid", "lit", "sec", "v", "vv", "ff", "fn", "fig", "chap", "comm", "approx", "sc", "esp"]);
function abbreviation(token: string): boolean {
  const w = token.replace(/^[("'“‘[]+/, "");
  if (!w) return false;
  if (/^\p{L}$/u.test(w)) return w !== "I"; // an initial (S. Radhakrishnan), but not the pronoun
  if (/^[ivxlc]+$/.test(w) || /^[IVXLC]{2,}$/.test(w)) return true; // a book or chapter number in a citation
  return ABBREV.has(w) || ABBREV_LOWER.has(w);
}

/** Sentences of one paragraph, split at ., ! and ? before a capital or a digit; never after an abbreviation or an
 *  initial, and never inside brackets (a citation). Works on any script's capitals (Ātman), not only ASCII. */
export function sentencesOf(para: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["'”’)\]]*(?:\s+|—\s*)(?=["'“‘(\[]?[\p{Lu}\d])/gu;
  let start = 0;
  let depth = 0;
  let scanned = 0;
  for (const m of para.matchAll(re)) {
    const i = m.index;
    for (; scanned < i; scanned++) {
      const c = para[scanned];
      if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth > 0) depth--;
    }
    if (depth > 0) continue;
    if (m[0][0] === "." && abbreviation(/(\S+)$/.exec(para.slice(Math.max(start, i - 40), i))?.[1] ?? "")) continue;
    const cut = i + m[0].length;
    const s = para.slice(start, cut).trim();
    if (s) out.push(s);
    start = cut;
  }
  const rest = para.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** A sentence's clauses: after a comma, semicolon or colon, and after a dash. */
const clausesOf = (s: string) => s.split(/(?<=[,;:])\s+|(?<=—)\s*(?=\S)/).filter(Boolean);

// Where a phrase may start, for cutting a long clause between words: conjunctions and relatives first, then prepositions.
const STRONG = new Set(["and", "but", "or", "nor", "because", "since", "as", "when", "while", "where", "which", "who", "whom", "whose", "that", "though", "although", "if", "unless", "until", "so", "therefore", "hence", "thus", "whereas", "lest"]);
const WEAK = new Set(["for", "in", "of", "to", "with", "by", "from", "through", "into", "upon", "on", "like", "than", "even", "being", "having", "without", "within", "about", "after", "before"]);
/** Cut a run of words into a head of at most `limit` characters and the rest, preferably before a conjunction. */
function cutWords(s: string, limit: number): [string, string] {
  const words = s.split(" ");
  let best = { strong: 0, weak: 0, any: 0 };
  let len = words[0].length;
  for (let k = 1; k < words.length && len <= limit; k++) {
    const w = words[k].toLowerCase().replace(/^[("'“‘]+/, "");
    const enough = len >= limit * 0.4;
    best.any = k;
    if (enough && STRONG.has(w)) best.strong = k;
    else if (enough && WEAK.has(w)) best.weak = k;
    len += 1 + words[k].length;
  }
  const k = best.strong || best.weak || best.any || 1;
  return [words.slice(0, k).join(" "), words.slice(k).join(" ")];
}

/**
 * The pieces narration is synthesized in, one at a time, so playback can start on the first while the rest is made.
 * The first piece is short (at most `first` characters, ending at a clause or phrase boundary) so the voice starts at
 * once; each later piece is at most `ramp` times the text already made, up to `max`, so the next is always ready
 * before the current one ends (synthesis runs at about a third of real time on one CPU thread). Pieces end at a
 * sentence where they can, merge short sentences, and never break a word.
 */
export function narrationChunks(text: string, { max = 180, first = 48, ramp = 2 }: { max?: number; first?: number; ramp?: number } = {}): string[] {
  const atoms: { t: string; end: boolean }[] = [];
  for (const para of text.split(/\n+/))
    for (const s of sentencesOf(para)) {
      const cs = clausesOf(s);
      cs.forEach((c, k) => atoms.push({ t: c, end: k === cs.length - 1 }));
    }
  const chunks: string[] = [];
  let made = 0;
  let cur = "";
  /** The clauses in `cur`, as [index in atoms, text]. */
  let held: [number, string][] = [];
  const limit = () => (chunks.length === 0 ? first : Math.min(max, Math.max(first, Math.floor(ramp * made))));
  const flush = () => {
    if (!cur) return;
    chunks.push(cur);
    made += cur.length;
    cur = "";
    held = [];
  };
  for (let n = 0; n < atoms.length; n++) {
    const a = atoms[n];
    const lim = limit();
    const joined = cur ? `${cur} ${a.t}` : a.t;
    if (joined.length <= lim) {
      cur = joined;
      held.push([n, a.t]);
      if (a.end && cur.length >= lim * 0.5) flush();
    } else if (cur) {
      // Do not leave a short clause ("hence,") dangling at the end of a piece: it starts the next one instead.
      const last = held.at(-1)!;
      if (held.length > 1 && !atoms[last[0]].end && last[1].length < 16) {
        held.pop();
        cur = held.map(([, t]) => t).join(" ");
        n = last[0];
      }
      flush();
      n--; // try this clause again, against the next piece's limit
    } else {
      const [head, rest] = cutWords(a.t, lim);
      cur = head;
      flush();
      if (rest) atoms.splice(n + 1, 0, { t: rest, end: a.end });
    }
  }
  flush();
  return chunks.filter((c) => /[A-Za-z0-9]/.test(c));
}

/** What a speechSynthesis voice looks like, for ranking (SpeechSynthesisVoice satisfies it). */
export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default?: boolean;
}
// macOS novelty voices and old formant synthesizers: never chosen while anything else is available.
const NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Princess)\b/i;
/** How natural an English voice is likely to sound: neural ("Natural", "Online", "Enhanced", "Premium") voices first,
 *  Google UK English and Rishi (Indian English) next, the old desktop voices (Microsoft David, Zira, eSpeak) last. */
export function voiceScore(v: VoiceLike): number {
  const n = v.name;
  let s = 0;
  if (/\bNatural\b/i.test(n)) s += 100;
  if (/\bOnline\b/i.test(n)) s += 60;
  if (/\b(Enhanced|Premium|Neural)\b/i.test(n)) s += 65;
  if (/Google UK English/i.test(n)) s += 70;
  else if (/Google US English/i.test(n)) s += 55;
  else if (/^Google\b/i.test(n)) s += 40;
  if (/\bRishi\b/i.test(n)) s += 60;
  if (/\bSiri\b/i.test(n)) s += 45;
  if (/^Microsoft\b/i.test(n) && !/\b(Online|Natural)\b/i.test(n)) s -= 40;
  if (/\bDesktop\b/i.test(n)) s -= 40;
  if (/e-?speak|festival|\bpico\b/i.test(n)) s -= 80;
  if (NOVELTY.test(n)) s -= 100;
  const lang = v.lang.replace("_", "-").toLowerCase();
  s += lang.startsWith("en-gb") ? 12 : lang.startsWith("en-in") ? 10 : /^en-(au|ie|nz)/.test(lang) ? 6 : lang.startsWith("en-us") ? 5 : 0;
  if (v.default) s += 2;
  return s;
}
/** English voices, best first (ties keep the browser's order). */
export function rankVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices
    .map((v, i) => ({ v, i, s: voiceScore(v) }))
    .filter(({ v }) => /^en([-_]|$)/i.test(v.lang))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ v }) => v);
}
