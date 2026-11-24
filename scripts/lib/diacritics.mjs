// Restore IAST diacritics in OCR'd text, deterministically. Scans of printed translations keep Sanskrit words but
// lose or mangle their marks ("atmanam", "prana", "Vamadeva", "líah"). Every IAST word form in our own corpus (the
// passages' IAST and the word-by-word forms) gives a lexicon keyed by its ASCII-folded spelling; a token is replaced
// only when (1) it is not a known English word, (2) its folded spelling maps to one dominant diacritic form, and
// (3) that form actually carries a diacritic. English is protected by a vocabulary taken from the clean, hand-typed
// Wisdom Library commentaries, whose plain-ASCII words are English (their Sanskrit carries its marks).

const MARKS = { ā: "a", ī: "i", ū: "u", ṛ: "r", ṝ: "r", ḷ: "l", ṅ: "n", ñ: "n", ṭ: "t", ḍ: "d", ṇ: "n", ś: "s", ṣ: "s", ṃ: "m", ṁ: "m", ḥ: "h" };
export const fold = (w) =>
  w
    .toLowerCase()
    .replace(/[āīūṛṝḷṅñṭḍṇśṣṃṁḥ]/g, (c) => MARKS[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const hasMark = (w) => /[āīūṛṝḷṅñṭḍṇśṣṃḥĀĪŪṚṢŚṆṬḌ]/.test(w);
const WORD = /[A-Za-zÀ-ÿĀ-žḀ-ỿ’']+/g;

/** Lexicon from IAST sources: folded → { form, count } (the most frequent diacritic form and its share). */
export function buildLexicon(iastTexts) {
  const counts = new Map();
  for (const t of iastTexts) {
    for (const raw of t.match(WORD) || []) {
      const w = raw.replace(/[’']/g, "").toLowerCase();
      // unmarked spellings vote too, so "satya" is not turned into a rare "sātya"
      if (w.length < 4) continue;
      const k = fold(w);
      if (!counts.has(k)) counts.set(k, new Map());
      const m = counts.get(k);
      m.set(w, (m.get(w) || 0) + 1);
    }
  }
  const lex = new Map();
  for (const [k, m] of counts) {
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((n, [, c]) => n + c, 0);
    if (sorted[0][1] / total >= 0.85 && hasMark(sorted[0][0]) && !/[śṣ]$/.test(sorted[0][0])) lex.set(k, sorted[0][0]);
  }
  return lex;
}

/** English vocabulary: plain-ASCII lowercase words seen at least twice in clean English prose. */
export function buildEnglish(texts) {
  const c = new Map();
  for (const t of texts) for (const raw of t.match(/(?<![A-Za-zÀ-ÿĀ-žḀ-ỿ])[A-Za-z]{2,}(?![A-Za-zÀ-ÿĀ-žḀ-ỿ])/g) || []) { const w = raw.toLowerCase(); c.set(w, (c.get(w) || 0) + 1); }
  return new Set([...c].filter(([, n]) => n >= 2).map(([w]) => w));
}

// Obvious scan artefacts in the printed-book OCR
const ARTEFACTS = [
  [/\b1s\b/g, "is"], [/\btbe\b/g, "the"], [/\bTbe\b/g, "The"], [/\bwbich\b/g, "which"], [/\bwhicb\b/g, "which"],
  [/\bfrorn\b/g, "from"], [/\barid\b/g, "and"], [/\bthat\s1s\b/g, "that is"], [/\s+([,;:.])/g, "$1"], [/ {2,}/g, " "],
];

/** Restore diacritics in one text; returns { text, fixed } with the number of words changed. */
export function restoreDiacritics(text, lex, english) {
  let fixed = 0;
  let out = text;
  for (const [re, to] of ARTEFACTS) out = out.replace(re, to);
  out = out.replace(WORD, (raw) => {
    const core = raw.replace(/[’']/g, "");
    if (core.length < 4 || hasMark(core)) return raw;
    const lower = core.toLowerCase();
    if (english.has(lower)) return raw;
    const form = lex.get(fold(core));
    if (!form || form === lower) return raw;
    fixed++;
    // keep the token's capitalisation ("Vamadeva" → "Vāmadeva")
    return core[0] === core[0].toUpperCase() && core[0] !== core[0].toLowerCase() ? form[0].toUpperCase() + form.slice(1) : form;
  });
  return { text: out, fixed };
}
