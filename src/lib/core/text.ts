// Script-aware normalisation shared by retrieval, quote verification, anchors and evidence checks.

const VOWEL_SIGN: Record<string, string> = { अ: "", आ: "ा", इ: "ि", ई: "ी", उ: "ु", ऊ: "ू", ऋ: "ृ", ॠ: "ॄ", ऌ: "ॢ", ए: "े", ऐ: "ै", ओ: "ो", औ: "ौ" };

/** Devanagari for comparison: drop spaces, punctuation, digits, Vedic accents, ZWJ/ZWNJ; candrabindu = anusvāra;
 *  word-split sandhi (म् अभि) equals fused sandhi (मभि). */
export function normDeva(s: string): string {
  return s
    .normalize("NFC")
    .replace(/ऽ+/g, "अ") // avagraha marks an elided अ
    .replace(/[॑-॔᳐-᳿꣠-ꣿ]/g, "")
    .replace(/्[\s‌‍]*([अआइईउऊऋॠऌएऐओऔ])/g, (_m, v: string) => VOWEL_SIGN[v]) // across spaces only, never across a daṇḍa
    .replace(/[\s‌‍।॥|0-9०-९.,;:!?’'"“”()[\]*_—–\-]/g, "")
    .replace(/ँ/g, "ं");
}

/** IAST/Latin folded to bare lowercase letters: "dhīro’bhi preyaso" → "dhirobhipreyaso". */
export function foldIast(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Lowercase, accent-free words for lexical search and cue matching. */
export function words(s: string): string[] {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9']+/g) || [];
}

export function fold(s: string): string {
  return words(s).join(" ");
}

/** Sørensen–Dice similarity over character bigrams. */
export function dice(a: string, b: string): number {
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const k = s.slice(i, i + 2);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [k, n] of A) inter += Math.min(n, B.get(k) || 0);
  return (2 * inter) / Math.max(1, a.length - 1 + b.length - 1);
}

/** Collapse whitespace and typographic variants so a quoted span can be matched verbatim. */
export function canon(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\*\*|__|\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const hasDevanagari = (s: string) => /[ऀ-ॿ]{2}/.test(s);

/** Stable small hash (FNV-1a) for deterministic choices such as the judge's A/B order. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const DEVA_DIGITS = "०१२३४५६७८९";
export const devaDigitsToAscii = (s: string) => s.replace(/[०-९]/g, (d) => String(DEVA_DIGITS.indexOf(d)));

// ── Devanagari → IAST (for sources that give only Devanagari, e.g. Sanskrit Wikisource) ──────────────────────
const D_VOWEL: Record<string, string> = { अ: "a", आ: "ā", इ: "i", ई: "ī", उ: "u", ऊ: "ū", ऋ: "ṛ", ॠ: "ṝ", ऌ: "ḷ", ॡ: "ḹ", ए: "e", ऐ: "ai", ओ: "o", औ: "au" };
const D_SIGN: Record<string, string> = { "ा": "ā", "ि": "i", "ी": "ī", "ु": "u", "ू": "ū", "ृ": "ṛ", "ॄ": "ṝ", "ॢ": "ḷ", "ॣ": "ḹ", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॆ": "e", "ॊ": "o" };
const D_CONS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ṅ", च: "c", छ: "ch", ज: "j", झ: "jh", ञ: "ñ", ट: "ṭ", ठ: "ṭh", ड: "ḍ", ढ: "ḍh", ण: "ṇ",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", ळ: "ḷ", व: "v",
  श: "ś", ष: "ṣ", स: "s", ह: "h",
};
const D_OTHER: Record<string, string> = { "ं": "ṃ", "ः": "ḥ", "ँ": "m̐", "ऽ": "'", ॐ: "oṃ", "ॅ": "", "़": "" };
/** Standard IAST transliteration; daṇḍas are kept as daṇḍas (as upanishads.org.in does), digits become ASCII. */
export function devaToIast(s: string): string {
  const src = s.normalize("NFC").replace(/[॑-॔᳐-᳿꣠-ꣿ‌‍]/g, "");
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const cons = D_CONS[c];
    if (cons !== undefined) {
      out += cons;
      let j = i + 1;
      if (src[j] === "़") j++;
      const next = src[j];
      if (next === "्") i = j;
      else if (D_SIGN[next] !== undefined) {
        out += D_SIGN[next];
        i = j;
      } else {
        out += "a";
        i = j - 1;
      }
      continue;
    }
    if (D_VOWEL[c] !== undefined) out += D_VOWEL[c];
    else if (D_OTHER[c] !== undefined) out += D_OTHER[c];
    else if (/[०-९]/.test(c)) out += String(DEVA_DIGITS.indexOf(c));
    else out += c;
  }
  return out;
}
