// npm run data:words — the word-by-word layer for every passage the primary source leaves unanalysed.
//
// upanishads.org.in analyses about 60% of the passages (word form, English gloss, lemma from the Digital Corpus of
// Sanskrit). For every other non-śānti passage this writes an overlay, data/corpus/<id>/words.json, which the compiler
// merges into a passage whose own `words` is empty (scripts/lib/word-overlay.mjs). Two kinds of analysis, recorded
// per passage in the overlay's `src`:
//   dcs   gold annotations from the Digital Corpus of Sanskrit (Oliver Hellwig, github.com/OliverHellwig/sanskrit,
//         CoNLL-U dump) for the Chāndogya, Bṛhadāraṇyaka, Kauṣītaki and Śvetāśvatara: every token is placed in our
//         passage by matching its form against our IAST, and a passage is accepted only when the matched forms cover
//         it end to end.
//   auto  for the Maitrī (not in the DCS) and any passage the DCS alignment could not place: segmentation by the
//         Dharmamitra Sanskrit segmenter (ByT5-Sanskrit, trained on the DCS; public endpoint, no key), lemmas from the
//         DCS/primary-source forms already seen in the corpus, else from vidyut-kosha's form lexicon (ambuda-org/vidyut).
//         A form neither knows gets no lemma rather than a guessed one.
// Glosses: none is written for a lemma the primary source already glosses (the word panel shows that gloss);
// otherwise the DCS dictionary's first sense, when the lemma's dictionary entry is unambiguous. Nothing is invented.
// Network results are cached in .cache/words/, so re-runs are offline and deterministic.
//   node scripts/ingest-words.mjs [--report]   (--report: alignment quality against the primary source's own analysis)
import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "data", "corpus");
const CACHE = join(ROOT, ".cache", "words");
const REPORT = process.argv.includes("--report");
const exists = (p) => access(p).then(() => true, () => false);
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Texts the DCS carries, by our id → DCS folder name. */
const DCS_TEXTS = { chandogya: "Chāndogyopaniṣad", brihadaranyaka: "Bṛhadāraṇyakopaniṣad", kaushitaki: "Kauṣītakyupaniṣad", shvetashvatara: "Śvetāśvataropaniṣad" };
const RAW = "https://raw.githubusercontent.com/OliverHellwig/sanskrit/master/dcs/data/conllu";

async function cachedFetch(file, url, { delay = 250, json = false } = {}) {
  if (await exists(file)) return readFile(file, "utf8");
  await mkdir(dirname(file), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": "upasarathi-data-build" } });
    if (r.ok) {
      const t = await r.text();
      if (json) JSON.parse(t);
      await writeFile(file, t, "utf8");
      await sleep(delay);
      return t;
    }
    if (attempt >= 3 || r.status === 404) throw new Error(`${url}: HTTP ${r.status}`);
    await sleep(2000 * (attempt + 1));
  }
}

// ── transliteration ──────────────────────────────────────────────────────────────────────────────
const I_VOW = { a: "अ", ā: "आ", i: "इ", ī: "ई", u: "उ", ū: "ऊ", ṛ: "ऋ", ṝ: "ॠ", ḷ: "ऌ", ḹ: "ॡ", e: "ए", ai: "ऐ", o: "ओ", au: "औ" };
const I_SIGN = { a: "", ā: "ा", i: "ि", ī: "ी", u: "ु", ū: "ू", ṛ: "ृ", ṝ: "ॄ", ḷ: "ॢ", ḹ: "ॣ", e: "े", ai: "ै", o: "ो", au: "ौ" };
const I_CONS = {
  k: "क", kh: "ख", g: "ग", gh: "घ", ṅ: "ङ", c: "च", ch: "छ", j: "ज", jh: "झ", ñ: "ञ", ṭ: "ट", ṭh: "ठ", ḍ: "ड", ḍh: "ढ", ṇ: "ण",
  t: "त", th: "थ", d: "द", dh: "ध", n: "न", p: "प", ph: "फ", b: "ब", bh: "भ", m: "म", y: "य", r: "र", l: "ल", v: "व", ś: "श", ṣ: "ष", s: "स", h: "ह",
};
const I_OTHER = { ṃ: "ं", ḥ: "ः", "'": "ऽ", "’": "ऽ", "m̐": "ँ" };
function iastTokens(s) {
  const out = [];
  const t = s.normalize("NFC").toLowerCase();
  for (let i = 0; i < t.length; ) {
    const two = t.slice(i, i + 2);
    if (two === "m̐" || I_CONS[two] || I_VOW[two]) { out.push(two); i += 2; } else { out.push(t[i]); i += 1; }
  }
  return out;
}
/** IAST → Devanagari for a single word form (as upanishads.org.in writes its word list: final consonant with virāma). */
export function iastToDeva(s) {
  const ts = iastTokens(s);
  let out = "";
  for (let i = 0; i < ts.length; i++) {
    const x = ts[i];
    if (I_CONS[x]) {
      out += I_CONS[x];
      const n = ts[i + 1];
      if (n !== undefined && I_SIGN[n] !== undefined) { out += I_SIGN[n]; i++; } else out += "्";
    } else if (I_VOW[x]) out += I_VOW[x];
    else if (I_OTHER[x]) out += I_OTHER[x];
    else out += x;
  }
  return out;
}
const SLP = { a: "a", ā: "A", i: "i", ī: "I", u: "u", ū: "U", ṛ: "f", ṝ: "F", ḷ: "x", ḹ: "X", e: "e", ai: "E", o: "o", au: "O", ṃ: "M", ḥ: "H", "m̐": "~", k: "k", kh: "K", g: "g", gh: "G", ṅ: "N", c: "c", ch: "C", j: "j", jh: "J", ñ: "Y", ṭ: "w", ṭh: "W", ḍ: "q", ḍh: "Q", ṇ: "R", t: "t", th: "T", d: "d", dh: "D", n: "n", p: "p", ph: "P", b: "b", bh: "B", m: "m", y: "y", r: "r", l: "l", v: "v", ś: "S", ṣ: "z", s: "s", h: "h", "'": "'" };
const SLP_BACK = Object.fromEntries(Object.entries(SLP).map(([k, v]) => [v, k]));
const toSlp = (s) => iastTokens(s).map((x) => SLP[x] ?? "").join("");
const fromSlp = (s) => [...s].map((c) => SLP_BACK[c] ?? c).join("");
/** vidyut writes a prefixed root as raw concatenation (upaAs); join the vowels the way the DCS spells its lemmas (upās). */
function joinPrefixes(slp) {
  let s = slp, prev;
  do {
    prev = s;
    s = s.replace(/[aA][aA]/g, "A").replace(/[aA][iI]/g, "e").replace(/[aA][uU]/g, "o").replace(/[aA]f/g, "ar").replace(/[iI]([aAuUeEoO])/g, "y$1").replace(/[uU]([aAiIeEoO])/g, "v$1");
  } while (s !== prev);
  return s;
}

/** The DCS dump (and the segmenter trained on it) writes ḷ as U+FFB1 and sometimes anusvāra as ṁ: repair both. */
const fixIast = (s) => (s || "").normalize("NFC").replace(/ﾱ/g, "ḷ").replace(/ṁ/g, "ṃ");

/** IAST folded for alignment: lowercase letters only, anusvāra = m, visarga dropped (sandhi rewrites both). */
const normA = (s) => s.normalize("NFC").toLowerCase().replace(/m̐|ṁ|ṃ/g, "m").replace(/ḥ/g, "").replace(/[^a-zāīūṛṝḷḹṅñṭḍṇśṣ]/g, "");

// ── the DCS dictionary: first English sense per lemma id ──────────────────────────────────────────
const GERMAN = /\b(der|die|das|und|sich|ein|eine|einen|gleicher|zu|mit|von|nicht|oder)\b|￼/i;
function shortGloss(meanings) {
  if (!meanings) return "";
  const senses = meanings.split(";").map((s) => s.trim()).filter((s) => s && !GERMAN.test(s) && !/^\[|^=|^name of a (prince|village|river)/i.test(s));
  if (!senses.length) return "";
  // up to three senses: a dictionary's first sense is often not the one a passage means (vairāgya: "loss of colour")
  let g = senses[0];
  for (const x of senses.slice(1, 3)) if (g.length + x.length + 2 <= 90) g += `; ${x}`;
  return g.length > 96 ? `${g.slice(0, 93).replace(/\s+\S*$/, "")}…` : g;
}

// ── DCS CoNLL-U ───────────────────────────────────────────────────────────────────────────────────
async function dcsText(name) {
  const listing = JSON.parse(await cachedFetch(join(CACHE, "dcs", `${name}.list.json`), `https://api.github.com/repos/OliverHellwig/sanskrit/contents/dcs/data/conllu/files/${encodeURIComponent(name)}`, { json: true }));
  const files = listing.map((f) => f.name).filter((n) => n.endsWith(".conllu")).sort();
  const tokens = [];
  for (const f of files) {
    const txt = await cachedFetch(join(CACHE, "dcs", name, f), `${RAW}/files/${encodeURIComponent(name)}/${encodeURIComponent(f)}`);
    // "## chapter: ChU, 6, 1" → "6.1", the khaṇḍa our references share
    const chapter = (txt.match(/^## chapter: [^,\n]+,\s*([^\n]+)$/m)?.[1] || "").split(",").map((x) => x.trim()).join(".");
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const c = line.split("\t");
      if (c.length < 10 || !/^\d+$/.test(c[0])) continue; // multiword ranges and empty nodes carry no lemma
      const misc = Object.fromEntries(c[9].split("|").map((kv) => kv.split("=")).filter((kv) => kv.length === 2));
      const form = misc.Unsandhied && misc.Unsandhied !== "_" ? misc.Unsandhied : c[1] !== "_" ? c[1] : c[2];
      if (!form || form === "_") continue;
      tokens.push({ form: fixIast(form), lemma: fixIast(c[2]), lemmaId: misc.LemmaId || "", upos: c[3], chapter });
    }
  }
  return tokens;
}

/** A form's sandhi-stable core: drop the last letter (final sandhi) and an initial vowel (vowel coalescence). */
function coreOf(f) {
  const n = normA(f);
  if (n.length <= 2) return n;
  const s = /^[aāiīuūṛṝeo]/.test(n) ? 1 : 0;
  return n.slice(s, n.length - 1);
}

/** The heaviest chain of (token, position) matches increasing in both: an order-preserving alignment that cannot be
 *  pulled off course by the refrains the Upanishads repeat. Returns each token's position in text, or null. */
function chain(cores, text) {
  const L = text.length + 2;
  const fwV = new Float64Array(L + 1), fwI = new Int32Array(L + 1).fill(-1);
  const query = (p) => { let bv = 0, bi = -1; for (let x = p + 1; x > 0; x -= x & -x) if (fwV[x] > bv) { bv = fwV[x]; bi = fwI[x]; } return [bv, bi]; };
  const update = (p, v, id) => { for (let x = p + 1; x <= L; x += x & -x) if (v > fwV[x]) { fwV[x] = v; fwI[x] = id; } };
  const nodes = [];
  for (let i = 0; i < cores.length; i++) {
    const c = cores[i];
    if (c.length < 3) continue;
    const mine = [];
    for (let at = text.indexOf(c); at >= 0; at = text.indexOf(c, at + 1)) {
      const [bv, bi] = query(at);
      mine.push({ i, p: at, end: at + c.length, v: bv + c.length, prev: bi });
    }
    for (const n of mine) { nodes.push(n); update(n.end, n.v, nodes.length - 1); }
  }
  let best = -1, bestV = 0;
  for (let k = 0; k < nodes.length; k++) if (nodes[k].v > bestV) { bestV = nodes[k].v; best = k; }
  const pos = new Array(cores.length).fill(null);
  for (let k = best; k >= 0; k = nodes[k].prev) pos[nodes[k].i] = nodes[k].p;
  return pos;
}

/** Place DCS tokens in our passages, khaṇḍa by khaṇḍa where the DCS chapters match our references. */
function align(tokens, verses) {
  const chapOf = (v) => v.ref.split(".").slice(0, -1).join(".");
  const ours = new Set(verses.map(chapOf));
  const dcsChaps = [...new Set(tokens.map((t) => t.chapter))];
  const byChapter = dcsChaps.length > 1 && dcsChaps.filter((c) => ours.has(c)).length >= 0.9 * dcsChaps.length;
  const groups = byChapter
    ? [...ours].map((c) => ({ verses: verses.filter((v) => chapOf(v) === c), tokens: tokens.filter((t) => t.chapter === c) }))
    : [{ verses, tokens }];
  const assigned = new Map(verses.map((v) => [v.id, []]));
  const quality = new Map();
  for (const g of groups) {
    const starts = [];
    let text = "";
    for (const v of g.verses) { starts.push(text.length); text += normA(v.iast.join(" ")); }
    const verseAt = (p) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= p) lo = m; else hi = m - 1; } return lo; };
    const cores = g.tokens.map((t) => coreOf(t.form));
    const pos = chain(cores, text);
    // two-letter forms: anchored when they sit between their chained neighbours
    for (let i = 0; i < cores.length; i++) {
      if (pos[i] !== null || cores[i].length !== 2) continue;
      let a = i - 1; while (a >= 0 && pos[a] === null) a--;
      const from = a >= 0 ? pos[a] + cores[a].length : 0;
      const at = text.indexOf(cores[i], from);
      let b = i + 1; while (b < cores.length && pos[b] === null) b++;
      if (at >= 0 && at - from <= 6 && (b >= cores.length || at + 2 <= pos[b])) pos[i] = at;
    }
    const covered = g.verses.map(() => ({ chars: 0, first: Infinity, last: -1 }));
    const prevA = [], nextA = [];
    for (let i = 0, last = null; i < cores.length; i++) { prevA[i] = last; if (pos[i] !== null) last = i; }
    for (let i = cores.length - 1, next = null; i >= 0; i--) { nextA[i] = next; if (pos[i] !== null) next = i; }
    for (let i = 0; i < cores.length; i++) {
      let vi;
      if (pos[i] !== null) {
        vi = verseAt(pos[i]);
        const cv = covered[vi];
        cv.chars += cores[i].length;
        cv.first = Math.min(cv.first, pos[i]);
        cv.last = Math.max(cv.last, pos[i] + cores[i].length);
      } else {
        // an unchained token belongs where both chained neighbours agree
        const a = prevA[i], b = nextA[i];
        if (a === null || b === null) continue;
        const va = verseAt(pos[a]), vb = verseAt(pos[b]);
        if (va !== vb) continue;
        vi = va;
      }
      assigned.get(g.verses[vi].id).push(g.tokens[i]);
    }
    g.verses.forEach((v, i) => {
      const s = starts[i], e = i + 1 < starts.length ? starts[i + 1] : text.length, len = Math.max(1, e - s);
      const cv = covered[i];
      const slack = 0.2 * len + 10;
      const ok = cv.chars / len >= 0.5 && cv.first - s <= slack && e - cv.last <= slack;
      quality.set(v.id, { coverage: cv.chars / len, ok });
    });
  }
  return { assigned, quality };
}

// ── Dharmamitra segmentation (public endpoint, cached per chunk) ──────────────────────────────────────
const DM_URL = "https://dharmamitra.org/api/tagging/";
let dmCache = null;
const DM_FILE = join(CACHE, "dharmamitra.json");
async function segment(chunks) {
  dmCache ??= (await exists(DM_FILE)) ? JSON.parse(await readFile(DM_FILE, "utf8")) : {};
  const todo = [...new Set(chunks.filter((c) => !dmCache[c]))];
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(DM_URL, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "upasarathi-data-build" }, body: JSON.stringify({ texts: batch, mode: "unsandhied-lemma-morphosyntax", input_encoding: "auto", human_readable_tags: true }) });
      if (r.ok) {
        const { results } = await r.json();
        if (!Array.isArray(results) || results.length !== batch.length) throw new Error("segmenter returned an unexpected shape");
        batch.forEach((c, k) => (dmCache[c] = results[k]));
        break;
      }
      if (attempt >= 3) throw new Error(`segmenter: HTTP ${r.status}`);
      await sleep(3000 * (attempt + 1));
    }
    await writeFile(DM_FILE, JSON.stringify(dmCache, null, 1), "utf8");
    await sleep(800);
  }
  return chunks.map((c) => cleanSeg(dmCache[c]));
}
/** The segmenter's "_"-joined forms, cleaned: its byte-level output sometimes turns ḷ into U+FFB1 and leaves stray
 *  digits or capitals; anything that is not an IAST word is dropped rather than guessed at. */
const IAST_WORD = /^[a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]+$/;
function cleanSeg(str) {
  return fixIast(str)
    .split(/[_\s]+/)
    .map((w) => w.replace(/['’]/g, "").trim())
    .filter((w) => w && !/^[A-Z]/.test(w) && IAST_WORD.test(w.toLowerCase()))
    .map((w) => w.toLowerCase());
}
/** A passage's IAST as segmenter-sized chunks: split at daṇḍas, then at spaces near 160 characters. */
function chunksOf(v) {
  const pieces = v.iast.join(" ").replace(/[0-9]+/g, " । ").split(/[।॥|]+/).map((s) => s.replace(/[^\p{L}\p{M}'’\s]/gu, " ").replace(/\s+/g, " ").trim()).filter((s) => /[a-zāīūṛṝḷṅñṭḍṇśṣ]{2}/i.test(s));
  const out = [];
  for (let p of pieces) {
    while (p.length > 180) {
      const cut = p.lastIndexOf(" ", 160);
      if (cut < 40) break;
      out.push(p.slice(0, cut));
      p = p.slice(cut + 1);
    }
    out.push(p);
  }
  return out;
}

// ── vidyut-kosha: form → lemma candidates ───────────────────────────────────────────────────────────
const PY = `
import json, sys
from vidyut.kosha import Kosha
ko = Kosha(sys.argv[1])
forms = json.load(open(sys.argv[2], encoding="utf8"))
out = {}
for f in forms:
    seen = []
    tries = [f] + ([f[:-1] + "s", f[:-1] + "r"] if f.endswith("H") else []) + ([f[:-1] + "m"] if f.endswith("M") else [])
    for cand in tries:
        for e in ko.get(cand):
            l = getattr(e, "lemma", None)
            if l and l not in seen:
                seen.append(l)
        if seen:
            break
    out[f] = seen
json.dump(out, open(sys.argv[3], "w", encoding="utf8"), ensure_ascii=False)
`;
async function koshaLemmas(formsSlp) {
  const data = join(CACHE, "vidyut-data");
  if (!(await exists(join(data, "kosha")))) execFileSync("python", ["-c", `import vidyut; vidyut.download_data(r"${data}")`], { stdio: "inherit" });
  const py = join(CACHE, "kosha.py"), inp = join(CACHE, "kosha-in.json"), out = join(CACHE, "kosha-out.json");
  await writeFile(py, PY, "utf8");
  await writeFile(inp, JSON.stringify(formsSlp), "utf8");
  execFileSync("python", [py, join(data, "kosha"), inp, out], { stdio: "inherit" });
  return JSON.parse(await readFile(out, "utf8"));
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────────
const dict = new Map(); // lemmaId → [word, meanings]
const byWord = new Map(); // lemma text → [lemmaId]
{
  const csv = await cachedFetch(join(CACHE, "dictionary.csv"), `${RAW}/lookup/dictionary.csv`);
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const c = line.split("\t");
    if (c.length < 5 || !c[0]) continue;
    const w = fixIast(c[1]);
    dict.set(c[0], [w, c[4]]);
    if (/^\[gramm\.\]/.test(c[4])) continue;
    (byWord.get(w) ?? byWord.set(w, []).get(w)).push(c[0]);
  }
}

const ids = (await readdir(CORPUS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const texts = {};
for (const id of ids) texts[id] = JSON.parse(await readFile(join(CORPUS, id, "verses.json"), "utf8"));

// What the primary source already says: lemma → gloss, form → lemma.
const orgGloss = new Map();
const formLemma = new Map(); // form → Map(lemma → count)
const lemmaFreq = new Map();
const lemmaIdUse = new Map(); // lemma → Map(lemmaId → count), from the DCS
const countForm = (f, l) => {
  if (!f || !l) return;
  const m = formLemma.get(f) ?? formLemma.set(f, new Map()).get(f);
  m.set(l, (m.get(l) || 0) + 1);
  lemmaFreq.set(l, (lemmaFreq.get(l) || 0) + 1);
};
const EVAL = process.argv.includes("--eval-auto") ? "katha" : null; // held out of the form table when evaluating
for (const [tid, vs] of Object.entries(texts)) for (const v of tid === EVAL ? [] : vs) for (const w of v.words || []) {
  if (w[3] && w[2] && !orgGloss.has(w[3])) orgGloss.set(w[3], w[2]);
  countForm(w[1].normalize("NFC"), w[3]);
}

const dcsTokens = {};
for (const [id, name] of Object.entries(DCS_TEXTS)) {
  dcsTokens[id] = await dcsText(name);
  for (const t of dcsTokens[id]) {
    countForm(t.form, t.lemma);
    const m = lemmaIdUse.get(t.lemma) ?? lemmaIdUse.set(t.lemma, new Map()).get(t.lemma);
    m.set(t.lemmaId, (m.get(t.lemmaId) || 0) + 1);
  }
  log(`DCS ${name}: ${dcsTokens[id].length} tokens`);
}

const glossFor = (lemma, lemmaId) => {
  if (!lemma || orgGloss.has(lemma)) return ""; // the word panel shows the primary source's gloss for this lemma
  let id = lemmaId;
  if (!id) {
    const use = lemmaIdUse.get(lemma);
    if (use?.size) id = [...use.entries()].sort((a, b) => b[1] - a[1])[0][0];
    else if (byWord.get(lemma)?.length === 1) id = byWord.get(lemma)[0];
  }
  const d = id && dict.get(id);
  return d && d[0] === lemma ? shortGloss(d[1]) : "";
};
const word = (form, lemma, lemmaId = "") => [iastToDeva(form), form, glossFor(lemma, lemmaId), lemma || ""];

const overlay = {}; // id → { words: {}, src: {} }
const put = (up, vid, words, src) => {
  const o = (overlay[up] ??= { words: {}, src: {} });
  o.words[vid] = words;
  o.src[vid] = src;
};
const stats = {};

// 1 · DCS gold, aligned
for (const [id, tokens] of Object.entries(dcsTokens)) {
  const verses = texts[id].filter((v) => !v.shanti);
  const { assigned, quality } = align(tokens, verses);
  let gold = 0, rejected = 0;
  const evalF1 = [];
  for (const v of verses) {
    const q = quality.get(v.id);
    const toks = assigned.get(v.id);
    if (v.words?.length) {
      if (REPORT && q.ok) {
        const a = new Map(); for (const w of v.words) if (w[3]) a.set(w[3], (a.get(w[3]) || 0) + 1);
        const b = new Map(); for (const t of toks) b.set(t.lemma, (b.get(t.lemma) || 0) + 1);
        let inter = 0; for (const [k, n] of b) inter += Math.min(n, a.get(k) || 0);
        const na = [...a.values()].reduce((x, y) => x + y, 0), nb = toks.length;
        const f1 = na ? inter / na : 1; // the primary source often analyses only part of a passage: measure how much of it the DCS tokens reproduce
        evalF1.push(f1);
        if (process.env.WORDS_DEBUG && f1 < 0.6) log(`    ${v.id} F1 ${f1.toFixed(2)} cov ${q.coverage.toFixed(2)}\n      primary: ${v.words.map((w) => w[3]).join(" ")}\n      dcs:     ${toks.map((t) => t.lemma).join(" ")}`);
      }
      continue;
    }
    if (q.ok && toks.length) { put(id, v.id, toks.map((t) => word(t.form, t.lemma, t.lemmaId)), "dcs"); gold++; }
    else { rejected++; if (process.env.WORDS_DEBUG) log(`    REJECT ${v.id} cov ${q.coverage.toFixed(2)} toks ${toks.length} | ${v.iast.join(" ").slice(0, 90)}`); }
  }
  stats[id] = { gold, rejected };
  if (REPORT) {
    const s = evalF1.sort((a, b) => a - b);
    log(`  ${id}: on ${s.length} passages the primary source analysed, primary lemmas found in the aligned DCS tokens: median ${s[s.length >> 1]?.toFixed(3)}, p10 ${s[Math.floor(s.length * 0.1)]?.toFixed(3)}, min ${s[0]?.toFixed(3)}`);
  }
}

if (process.argv.includes("--dcs-only")) { log(stats); process.exit(0); }

// 2 · automatic analysis for everything still empty
const todo = [];
if (EVAL) { for (const v of texts[EVAL]) if (!v.shanti && v.words?.length) todo.push({ id: EVAL, v }); }
else for (const id of ids) for (const v of texts[id]) if (!v.shanti && !v.words?.length && !overlay[id]?.words[v.id]) todo.push({ id, v });
const chunkLists = todo.map(({ v }) => chunksOf(v));
const segs = await segment(chunkLists.flat());
let k = 0;
const segmented = todo.map((t, i) => ({ ...t, forms: chunkLists[i].flatMap(() => segs[k++]) }));
const unknown = new Set();
for (const s of segmented) for (const f of s.forms) if (!formLemma.has(f)) unknown.add(toSlp(f));
const kosha = unknown.size ? await koshaLemmas([...unknown]) : {};
let fromCorpus = 0, fromKosha = 0, noLemma = 0;
const lemmaOf = (f) => {
  const known = formLemma.get(f);
  if (known) { fromCorpus++; return [...known.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]; }
  const cands = (kosha[toSlp(f)] || []).map((l) => fromSlp(joinPrefixes(l)).normalize("NFC"));
  if (!cands.length) { noLemma++; return ""; }
  fromKosha++;
  return [...cands].sort((a, b) => (lemmaFreq.get(b) || 0) - (lemmaFreq.get(a) || 0))[0];
};
if (EVAL) {
  // agreement with the primary source on a text whose own forms were kept out of the lemma table
  let match = 0, autoN = 0, primN = 0, formMatch = 0;
  for (const s of segmented) {
    const want = new Map(); for (const w of s.v.words) if (w[3]) want.set(w[3], (want.get(w[3]) || 0) + 1);
    const forms = new Map(); for (const w of s.v.words) forms.set(w[1], (forms.get(w[1]) || 0) + 1);
    for (const f of s.forms) {
      autoN++;
      const l = lemmaOf(f);
      if (want.get(l) > 0) { match++; want.set(l, want.get(l) - 1); }
      if (forms.get(f) > 0) { formMatch++; forms.set(f, forms.get(f) - 1); }
    }
    primN += s.v.words.length;
  }
  log(`auto analysis vs the primary source on ${segmented.length} ${EVAL} passages (held out): forms precision ${(formMatch / autoN).toFixed(3)}, recall ${(formMatch / primN).toFixed(3)}; lemmas precision ${(match / autoN).toFixed(3)}, recall ${(match / primN).toFixed(3)}`);
  process.exit(0);
}
for (const s of segmented) {
  if (!s.forms.length) continue;
  put(s.id, s.v.id, s.forms.map((f) => word(f, lemmaOf(f))), "auto");
  (stats[s.id] ??= { gold: 0, rejected: 0 }).auto = (stats[s.id].auto || 0) + 1;
}

// ── write ─────────────────────────────────────────────────────────────────────────────────────────
const NOTE = "Word-by-word analysis for passages the primary source leaves unanalysed; merged into a passage only when its own words are empty. src: dcs = Digital Corpus of Sanskrit gold annotation (O. Hellwig); auto = Dharmamitra segmentation with lemmas from the corpus's own DCS forms or vidyut-kosha. Generated by npm run data:words.";
log("\ntext            passages  primary  dcs  auto  missing");
let total = 0, analysed = 0;
for (const id of ids) {
  const verses = texts[id].filter((v) => !v.shanti);
  const o = overlay[id];
  const primary = verses.filter((v) => v.words?.length).length;
  const dcs = o ? Object.values(o.src).filter((x) => x === "dcs").length : 0;
  const auto = o ? Object.values(o.src).filter((x) => x === "auto").length : 0;
  const missing = verses.filter((v) => !v.words?.length && !o?.words[v.id]).map((v) => v.ref);
  total += verses.length;
  analysed += primary + dcs + auto;
  log(`${id.padEnd(15)} ${String(verses.length).padStart(8)} ${String(primary).padStart(8)} ${String(dcs).padStart(4)} ${String(auto).padStart(5)}  ${missing.length ? missing.join(" ") : "—"}`);
  const file = join(CORPUS, id, "words.json");
  if (o) {
    const order = new Map(texts[id].map((v, i) => [v.id, i]));
    const keys = Object.keys(o.words).sort((a, b) => order.get(a) - order.get(b));
    await writeFile(file, JSON.stringify({ note: NOTE, src: Object.fromEntries(keys.map((x) => [x, o.src[x]])), words: Object.fromEntries(keys.map((x) => [x, o.words[x]])) }, null, 1), "utf8");
  }
}
log(`\n${analysed}/${total} passages analysed · auto lemmas: ${fromCorpus} from corpus forms, ${fromKosha} from vidyut-kosha, ${noLemma} without a lemma`);
