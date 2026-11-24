// Deterministic Devanagari → Indic-script transliteration for Sanskrit: a fixed character table, no AI, no
// dictionary, the same input always gives the same output. Loaded on demand (dynamic import) only when a reader
// picks a script other than Devanagari or IAST.
//
// Bengali, Odia, Gujarati, Telugu, Kannada and Malayalam share Devanagari's ISCII-derived layout: each letter sits
// at the same offset inside its Unicode block, so the table is an offset plus a short list of exceptions (letters a
// script lacks, and the conventional spellings of ॐ). Tamil has no voiced or aspirated stops, so it uses the
// "Tamil superscripted" convention (as in Aksharamukha and Sanscript): क² क³ क⁴ for kha ga gha, ம்ʼ for anusvāra,
// ருʼ for vocalic ṛ, ꞉ for visarga, (அ) for avagraha. That keeps every Sanskrit distinction readable. Unlike
// Sanscript's scheme, dandas stay as । ॥ rather than full stops, and each superscript stays next to its own
// consonant (after the vowel sign or puḷḷi), never pushed past a following र.
// Anything not in the tables (Latin punctuation, Vedic ꣳ, dandas) passes through unchanged.

export type Target = "beng" | "orya" | "gujr" | "telu" | "knda" | "mlym" | "taml";

const OFFSET: Record<Exclude<Target, "taml">, number> = { beng: 0x80, gujr: 0x180, orya: 0x200, telu: 0x300, knda: 0x380, mlym: 0x400 };

/** Devanagari ranges whose counterpart lies at the same offset in every block above (exceptions override). */
const PARALLEL: ReadonlyArray<readonly [number, number]> = [
  [0x0901, 0x0903], // ँ ं ः
  [0x0905, 0x0910], // अ … ऐ (ऎ handled below where a script lacks it)
  [0x0912, 0x0914], // ऒ ओ औ
  [0x0915, 0x0928], // क … न
  [0x092a, 0x0930], // प … र
  [0x0932, 0x0933], // ल ळ
  [0x0935, 0x0939], // व … ह
  [0x093c, 0x0944], // ़ ऽ ा … ॄ
  [0x0946, 0x0948], // ॆ े ै
  [0x094a, 0x094d], // ॊ ो ौ ्
  [0x0960, 0x0963], // ॠ ॡ ॢ ॣ
  [0x0966, 0x096f], // digits
];
const SKIP = new Set([0x090d, 0x0911]); // candra vowels: not Sanskrit, left as they are

const EXCEPT: Record<Exclude<Target, "taml">, Record<string, string>> = {
  beng: { "व": "ব", "ळ": "ল়", "ॐ": "ওঁ", "ऎ": "এ", "ऒ": "ও", "ॆ": "ে", "ॊ": "ো" },
  orya: { "ॐ": "ଓଁ", "ऎ": "ଏ", "ऒ": "ଓ", "ॆ": "େ", "ॊ": "ୋ" },
  gujr: { "ॐ": "ૐ", "ऎ": "એ", "ऒ": "ઓ", "ॆ": "ે", "ॊ": "ો" },
  telu: { "ॐ": "ఓం", "़": "" },
  knda: { "ॐ": "ಓಂ" },
  mlym: { "ॐ": "ഓം", "़": "" },
};

const tables = new Map<Target, Map<string, string>>();
function table(to: Exclude<Target, "taml">): Map<string, string> {
  let m = tables.get(to);
  if (m) return m;
  m = new Map();
  for (const [a, b] of PARALLEL) for (let c = a; c <= b; c++) if (!SKIP.has(c)) m.set(String.fromCharCode(c), String.fromCharCode(c + OFFSET[to]));
  for (const [k, v] of Object.entries(EXCEPT[to])) m.set(k, v);
  tables.set(to, m);
  return m;
}

// ── Tamil ──────────────────────────────────────────────────────────────────────────────────────────
const T_CONS: Record<string, [string, string]> = {
  "क": ["க", ""], "ख": ["க", "²"], "ग": ["க", "³"], "घ": ["க", "⁴"], "ङ": ["ங", ""],
  "च": ["ச", ""], "छ": ["ச", "²"], "ज": ["ஜ", ""], "झ": ["ஜ", "²"], "ञ": ["ஞ", ""],
  "ट": ["ட", ""], "ठ": ["ட", "²"], "ड": ["ட", "³"], "ढ": ["ட", "⁴"], "ण": ["ண", ""],
  "त": ["த", ""], "थ": ["த", "²"], "द": ["த", "³"], "ध": ["த", "⁴"], "न": ["ந", ""],
  "प": ["ப", ""], "फ": ["ப", "²"], "ब": ["ப", "³"], "भ": ["ப", "⁴"], "म": ["ம", ""],
  "य": ["ய", ""], "र": ["ர", ""], "ल": ["ல", ""], "व": ["வ", ""],
  "श": ["ஶ", ""], "ष": ["ஷ", ""], "स": ["ஸ", ""], "ह": ["ஹ", ""], "ळ": ["ள", ""],
};
const T_VOWEL: Record<string, string> = {
  "अ": "அ", "आ": "ஆ", "इ": "இ", "ई": "ஈ", "उ": "உ", "ऊ": "ஊ", "ऋ": "ருʼ", "ॠ": "ரூʼ", "ऌ": "லுʼ", "ॡ": "லூʼ",
  "ऎ": "எ", "ए": "ஏ", "ऐ": "ஐ", "ऒ": "ஒ", "ओ": "ஓ", "औ": "ஔ",
};
const T_SIGN: Record<string, string> = {
  "ा": "ா", "ि": "ி", "ी": "ீ", "ु": "ு", "ू": "ூ", "ॆ": "ெ", "े": "ே", "ै": "ை", "ॊ": "ொ", "ो": "ோ", "ौ": "ௌ",
};
/** Vocalic vowel signs: written as puḷḷi + ர/ல + u/ū + ʼ; the superscript stays after the puḷḷi. */
const T_SIGN_R: Record<string, string> = { "ृ": "ருʼ", "ॄ": "ரூʼ", "ॢ": "லுʼ", "ॣ": "லூʼ" };
const T_OTHER: Record<string, string> = { "ं": "ம்ʼ", "ः": "꞉", "ँ": "ம்ˮ", "ॐ": "ௐ", "ऽ": "(அ)", "़": "" };
for (let d = 0; d <= 9; d++) T_OTHER[String.fromCharCode(0x0966 + d)] = String.fromCharCode(0x0be6 + d);

function toTamil(s: string): string {
  let out = "";
  let sup = ""; // the superscript of the consonant just written, set after its vowel sign or puḷḷi
  const flush = () => {
    out += sup;
    sup = "";
  };
  for (const ch of s) {
    const c = T_CONS[ch];
    if (c) {
      flush();
      out += c[0];
      sup = c[1];
    } else if (T_SIGN[ch]) {
      out += T_SIGN[ch];
      flush();
    } else if (ch === "्") {
      out += "்";
      flush();
    } else if (T_SIGN_R[ch]) {
      out += "்";
      flush();
      out += T_SIGN_R[ch];
    } else if (ch === "़") {
      // nukta: no Tamil counterpart; keep the pending superscript for the vowel sign that follows
    } else {
      flush();
      out += T_VOWEL[ch] ?? T_OTHER[ch] ?? ch;
    }
  }
  flush();
  return out;
}

/** Devanagari (Sanskrit) to one of the regional scripts. */
export function transliterate(deva: string, to: Target): string {
  if (to === "taml") return toTamil(deva);
  const m = table(to);
  let out = "";
  for (const ch of deva) out += m.get(ch) ?? ch;
  return out;
}

/** Characters in Tamil output that are not Tamil letters (superscripts and modifier marks), for typesetting. */
export const TAMIL_MARKS = /([²³⁴]|ʼ|ˮ|꞉|\(அ\))/;
