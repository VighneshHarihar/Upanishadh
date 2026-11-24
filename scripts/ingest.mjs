// npm run data:sources — fetch and segment the source texts into data/corpus/<id>/{verses,bhashya}.json.
//
// Auto-discovers every data/corpus/<id>/meta.json and follows its `ingest` block:
//   org         upanishads.org.in edition slug. One bulk block per text (/api/content/<slug>-main) gives every
//               passage's Devanagari, IAST, Sri Aurobindo's renderings and a word-by-word analysis (lemmas from the
//               Digital Corpus of Sanskrit). The chant manifest gives per-mantra audio.
//   wikisource  Sanskrit Wikisource page (Devanagari only; IAST is transliterated) for texts the site does not carry.
//   pdf         markers for the Śaṅkara-tradition English in 108upanishads.pdf (text extracted to .cache/108upanishads.txt)
//   shanti      the peace invocation chanted before the text (Devanagari, IAST and audio from the site's index)
//   bhashya     Wisdom Library book holding Śaṅkara's commentary. Anchors in data/curated/anchors.json are always
//               fetched; `crawl: true` walks the whole book and attaches every page whose Devanagari matches a mantra.
// Network results are cached in .cache/, so re-runs are offline and deterministic. Output is committed; `npm run data`
// never touches the network.
import { mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normDeva, devaToIast } from "../src/lib/core/text.ts";
import { commentaryUnits, numberedSections, paragraphs, stripPageFurniture } from "./lib/ocr-book.mjs";
import { OCR_SOURCES } from "./lib/ocr-sources.mjs";
import { buildEnglish, buildLexicon, restoreDiacritics } from "./lib/diacritics.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");
const CORPUS = join(ROOT, "data", "corpus");
const UA = "Mozilla/5.0 (research-client)";
const PDF_TEXT = process.env.PDF108_TEXT || join(CACHE, "108upanishads.txt");
const GITA_VERSES = process.env.GITAVISWA_VERSES || join(ROOT, "..", "..", "GitaGraph", "public", "data", "gita-verses.json");
const VEDA = process.env.VEDANVAYA_DATA || join(ROOT, "..", "..", "VedaGraph", "data", "canonical");
const SECOND_READING = /Aurobindo/i; // the second reading shown is Sri Aurobindo's; colonial-era translations are not shown

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
const log = (...a) => console.log(...a);

async function cached(file, url, delay = 700) {
  if (await exists(file)) return readFile(file, "utf8");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 404) throw Object.assign(new Error("HTTP 404"), { notFound: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text, "utf8");
      await sleep(delay);
      return text;
    } catch (e) {
      if (e.notFound || attempt === 3) throw Object.assign(new Error(`${url}: ${e.message}`), { notFound: e.notFound });
      await sleep(2000 * attempt);
    }
  }
}

// ── text helpers ──────────────────────────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const unescape = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m));
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function roman(s) {
  let n = 0, prev = 0;
  for (const c of s.toLowerCase().split("").reverse()) { const v = ROMAN[c]; n += v < prev ? -v : v; prev = Math.max(prev, v); }
  return n;
}
const refKey = (r) => r.split(".").map((n) => n.padStart(4, "0")).join(".");
const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const DEVA_NUM = "०१२३४५६७८९";
const devaNum = (s) => Number(s.replace(/[०-९]/g, (d) => DEVA_NUM.indexOf(d)));

// ── 108 Upanishads PDF: Śaṅkara-tradition translations ─────────────────────────────────────────────
const pdfLines = (await readFile(PDF_TEXT, "utf8")).replace(/\f/g, "\n").split(/\r?\n/);
function pdfSection(spec) {
  const start = new RegExp(spec.start), end = new RegExp(spec.end);
  const s = pdfLines.findIndex((l, i) => start.test(l.trim()) && pdfLines.slice(i + 1, i + 4).some((x) => /Transla/i.test(x)));
  const e = spec.end ? pdfLines.findIndex((l, i) => i > s && end.test(l)) : -1;
  if (s < 0 || (spec.end && e < 0)) throw new Error(`PDF block not found for ${spec.start}`);
  const translator = pdfLines.slice(s + 1, s + 4).find((x) => /Transla/i.test(x)).replace(/^.*?\bby\s+/i, "").trim();
  return { s, e: e < 0 ? pdfLines.findIndex((l, i) => i > s + 5 && /^Translated by/.test(l)) - 3 : e, translator };
}
const tidyPdf = (raw) => raw.replace(/[ \t]+/g, " ").replace(/(\w)- (\w)/g, "$1$2").replace(/ ?\n ?/g, "\n").trim();
function pdfTranslations(spec) {
  const { s, e, translator } = pdfSection(spec);
  const marker = new RegExp(spec.marker);
  const map = new Map();
  let cur = null;
  // The peace invocation printed before the first mantra ("Om ! ...").
  const shanti = [];
  let beforeFirst = true;
  for (const raw of pdfLines.slice(s + 1, e)) {
    // Typesetting slips in the PDF: "iii-v-1:" for "III-v-1:", "I-x-I:" for "I-x-1:", sub-parts "III-ix-28(1):".
    const l = raw
      .trim()
      .replace(/^([ivxl]+)(-[ivxl]+-\d)/, (_m, a, b) => a.toUpperCase() + b)
      .replace(/^([IVXL]+-[ivxl]+)-I([:.])/, "$1-1$2")
      .replace(/^([IVXL]+-[ivxl]+-\d{1,3})\(\d+\)([:.])/, "$1$2");
    if (!l || /^\d{1,4}$/.test(l)) continue;
    const m = l.match(marker);
    if (m) {
      beforeFirst = false;
      cur = spec.ref.map((p) => (p.startsWith("R$") ? String(roman(m[Number(p.slice(2))])) : m[Number(p.slice(1))])).join(".");
      const t = m[spec.text] || "";
      map.set(cur, map.has(cur) && spec.join ? `${map.get(cur)}\n${t}` : t);
      continue;
    }
    if (beforeFirst) {
      if (!/^(Transla|Published|Edited)/i.test(l)) shanti.push(l);
      continue;
    }
    if (/^Om\s*!/.test(l)) { cur = null; continue; }
    if (cur) map.set(cur, `${map.get(cur)} ${l}`);
  }
  // Joint translations ("VI-i-2-3:" renders mantras 2 and 3 together): give each mantra the shared text, marked.
  const out = new Map();
  for (const [k, raw] of map) {
    const v = tidyPdf(raw);
    const r = k.match(/^(.*\.)?(\d+)-(\d+)$/);
    if (!r) { out.set(k, { text: v }); continue; }
    const base = r[1] || "";
    for (let i = Number(r[2]); i <= Number(r[3]); i++) out.set(`${base}${i}`, { text: v, joint: `${base}${r[2]}–${r[3]}` });
  }
  return { map: out, translator, shanti: tidyPdf(shanti.join("\n")) };
}
/** Translations printed per chapter ("PRAPATHAKA ONE ..."), unnumbered: one rendering for the whole chapter. */
function pdfChapters(spec) {
  const { s, e, translator } = pdfSection(spec);
  const chap = new RegExp(spec.chapter);
  const out = new Map();
  const shanti = [];
  let cur = null;
  const WORD = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7 };
  for (const raw of pdfLines.slice(s + 1, e)) {
    const l = raw.trim();
    if (!l || /^\d{1,4}$/.test(l)) continue;
    const m = l.match(chap);
    if (m) { cur = String(WORD[m[1]] ?? m[1]); out.set(cur, ""); continue; }
    if (cur === null) { if (!/^(Transla|Published|Edited)/i.test(l)) shanti.push(l); continue; }
    if (/^Om\s*!/.test(l)) cur = "__end"; // the closing invocation
    if (cur === '__end') continue;
    out.set(cur, `${out.get(cur)}\n${l}`);
  }
  out.delete('__end');
  for (const [k, v] of out) out.set(k, tidyPdf(v));
  return { chapters: out, translator, shanti: tidyPdf(shanti.join("\n")) };
}

// ── upanishads.org.in bulk blocks ─────────────────────────────────────────────────────────────────
const audioIndexAll = JSON.parse(await cached(join(CACHE, "org", "api_index.json"), "https://upanishads.org.in/api/content/index"));
const audioIndex = audioIndexAll.audio || {};
async function orgBlock(slug) {
  return JSON.parse(await cached(join(CACHE, "org", "blocks", `${slug}-main.json`), `https://upanishads.org.in/api/content/${slug}-main`, 1200));
}
/** One lemma key per analysed word: the DCS lemma when present, else the stem or root the analysis gives, else the form. */
function lemmaOf(w) {
  const clean = (s) => s.replace(/\s*\(.*?\)\s*/g, " ").replace(/[,;].*$/, "").trim().toLowerCase();
  if (w.lx?.l) return clean(w.lx.l);
  if (w.mt?.stem && w.g?.pos && !/verb/.test(w.g.pos)) return clean(w.mt.stem);
  if (w.g?.dhatu) return `√${devaToIast(w.g.dhatu).replace(/[^a-zāīūṛṝḷḹṅñṭḍṇśṣṃḥ]/g, "")}`;
  return clean(w.t || "");
}
const glossOf = (w) => (w.e || w.sm || w.lx?.m || "").split(/;|\[/)[0].trim().slice(0, 80);
function orgVerses(meta, block) {
  // Refs as the site writes them ("1/1", "1~1" for the Kena) become dotted; the Taittirīya's vallī invocations
  // ("2.invocation") repeat its śānti mantra, which is kept once as passage 0.
  return block.passages
    .map((p) => ({ ...p, r: String(p.r).replace(/[/~]/g, ".") }))
    .filter((p) => /^\d+(\.\d+)*$/.test(p.r))
    .map((p) => {
    const alts = [];
    if (p.tr && SECOND_READING.test(`${p.ta || ""} ${p.ts?.by || ""}`)) alts.push({ text: p.tr.replace(/\s+/g, " ").trim(), by: "Sri Aurobindo", cite: p.ta || p.ts?.ed || "", source: "upanishads.org.in" });
    for (const a of p.alt || []) if (SECOND_READING.test(a.by || "")) alts.push({ text: (a.tx || "").replace(/\s+/g, " ").trim(), by: "Sri Aurobindo", cite: a.loc || "", source: "upanishads.org.in" });
    return {
      id: `${meta.abbrev}_${p.r}`, ref: p.r, section: p.sec || "",
      sa: lines(p.sa), iast: lines(p.ia),
      alt: alts.filter((a) => a.text).slice(0, 1),
      words: (p.w || []).map((w) => [w.d || "", w.t || "", glossOf(w), lemmaOf(w)]),
    };
  });
}

// ── Sanskrit Wikisource (Devanagari) ──────────────────────────────────────────────────────────────
async function wikisource(title) {
  const raw = await cached(join(CACHE, "wikisource", `${encodeURIComponent(title)}.txt`), `https://sa.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`);
  return raw.replace(/<[^>]+>/g, "").replace(/'''/g, "").replace(/\{\{[^}]*\}\}/g, "").replace(/\[\[[^\]]*\]\]/g, "").replace(/^:+/gm, "");
}
/** Split "… ॥ १ ॥ … ॥ २ ॥" into numbered sections. */
function numbered(text) {
  const out = [];
  const re = /॥\s*([०-९]+)\s*॥/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    const body = text.slice(last, m.index).replace(/॥[^॥]*(अध्यायः|प्रपाठकः)[^॥]*॥/g, "").replace(/इति[^॥।]{0,40}(अध्यायः|प्रपाठकः)/g, "").trim();
    out.push({ n: devaNum(m[1]), body });
    last = m.index + m[0].length;
  }
  return out;
}
const sanskritLines = (body) => body.split(/\n|(?<=।)\s+/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => /[ऀ-ॿ]{2}/.test(l));
async function wikisourceVerses(meta, spec) {
  const text = await wikisource(spec.title);
  const verses = [];
  let shantiSa = null;
  if (spec.parser === "kaushitaki") {
    const heads = [...text.matchAll(/॥\s*[^॥\n]{2,30}ध्यायः\s*॥/g)];
    shantiSa = sanskritLines(text.slice(0, heads[0].index).replace(/॥\s*कौषीतकि[^॥]*॥/, ""));
    heads.forEach((h, i) => {
      const chunk = text.slice(h.index + h[0].length, heads[i + 1]?.index ?? text.lastIndexOf("ॐ वाङ्मे मनसि"));
      for (const sec of numbered(chunk)) verses.push({ ref: `${i + 1}.${sec.n}`, section: `Adhyāya ${i + 1}`, body: sec.body });
    });
  } else if (spec.parser === "maitri") {
    const end = text.indexOf("इति सप्तमः प्रपाठकः");
    const first = text.slice(0, end + 20);
    const startP1 = first.indexOf("ॐ बृहद्रथो");
    shantiSa = sanskritLines(first.slice(first.indexOf("ॐ आप्यायन्तु"), first.indexOf("मैत्रायणी कौषितकी")).trim());
    const bounds = [startP1, first.indexOf("तृतीयः प्रपाठकः") >= 0 ? null : null];
    // Chapter boundaries: "इति प्रथमः प्रपाठकः", "इति द्वितीयः …", then headings "तृतीयः प्रपाठकः" … "प्रपाठक ७".
    const marks = [
      startP1,
      first.indexOf("इति प्रथमः प्रपाठकः"),
      first.indexOf("इति द्वितीयः प्रपाठकः"),
      first.indexOf("चतुर्थः प्रपाठकः"),
      first.indexOf("पञ्चमः प्रपाठकः"),
      first.indexOf("षष्ठः प्रपाठकः"),
      first.indexOf("प्रपाठक ७"),
      end,
    ];
    void bounds;
    for (let p = 0; p < 7; p++) {
      const chunk = first.slice(marks[p], marks[p + 1]);
      for (const sec of numbered(chunk)) verses.push({ ref: `${p + 1}.${sec.n}`, section: `Prapāṭhaka ${p + 1}`, body: sec.body });
    }
  }
  // Repeated numbers inside one chapter (a source typo) are merged into the previous section rather than lost.
  const out = [];
  for (const v of verses) {
    const prev = out.find((x) => x.ref === v.ref);
    if (prev) prev.body += `\n${v.body}`;
    else out.push(v);
  }
  return {
    shantiSa,
    verses: out
      .map((v) => {
        const sa = sanskritLines(v.body);
        return { id: `${meta.abbrev}_${v.ref}`, ref: v.ref, section: v.section, sa, iast: sa.map(devaToIast), alt: [], words: [] };
      })
      .filter((v) => v.sa.length), // a number with no text after it is a source artefact, not a passage
  };
}

// ── Wisdom Library: Śaṅkara's commentary ──────────────────────────────────────────────────────────
const FOOTER = /\n\s*(Footnotes and references|Like what you read|Let'?s grow together|Other print editions|Help me keep this site|Last Updated|\d{1,2} \w+,? \d{4}\s*-->)/i;
function pageText(html) {
  const s = html.indexOf('id="scontent"');
  let body = s >= 0 ? html.slice(s) : html;
  body = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<(br|p|div|h\d|li)[^>]*>/gi, "\n");
  let text = unescape(body.replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  const f = text.search(FOOTER);
  if (f > 0) text = text.slice(0, f);
  return text.replace(/^[^\n]*scontent">?\n?/, "").trim();
}
const hasDeva = (s) => /[ऀ-ॿ]{3}/.test(s);
const tidy = (s) => s.replace(/\s*\[\d+\]/g, "").replace(/\n{2,}/g, "\n").replace(/ ?• ?/g, " ").trim();
function commentaryAfterTranslation(ls) {
  const t = ls.findIndex((l) => /^(\d+|l|I)([-–]\d+)?\.\s/.test(l) && !hasDeva(l)); // "l. Om. The head…" is a misprinted "1."
  return t >= 0 ? ls.slice(t + 1).filter((l) => !hasDeva(l) && !/\|\|/.test(l)).join("\n") : "";
}
function extractBhashya(text, mode, key) {
  if (mode === "page") {
    const m = text.match(/(Śrī |Shri )?(Shankara|Śaṅkara|Sankara)[’'`]?s?\s+(Commentary|Bhāṣya|Bhashya)\s*(\(commentary\))?\s*:?\s*\n|Commentary\s*\((Śaṅkara|Shankara)[^)]*\)\s*:|\n(Bhāṣya|Commentary)\s*:/i);
    const deva = text.slice(0, m ? m.index : 600);
    const body = m ? text.slice(m.index + m[0].length) : commentaryAfterTranslation(text.split("\n"));
    return { body: tidy(body.replace(/^\s*Com\.\s*[—-]\s*/, "")), deva };
  }
  if (mode === "ordinal") {
    const blocks = text.split(/Upaniṣad text\s*:/i).slice(1);
    for (const b of blocks) {
      const [mula, ...rest] = b.split(/Commentary\s*\(Śaṅkara Bhāṣya\)\s*:/i);
      const ord = mula.match(/\((\d+)\)\s*$/m)?.[1] || mula.trim().match(/\((\d+)\)[^()]*$/)?.[1];
      if (ord === key) return { body: tidy(rest.join("\n")), deva: "", mula: tidy(mula) };
    }
    return null;
  }
  if (mode === "heading") {
    const parts = text.split(/\n?Verse (\d+\.\d+\.\d+)\s*:/);
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] !== key) continue;
      const ls = parts[i + 1].split("\n").map((l) => l.trim()).filter(Boolean);
      return { body: tidy(commentaryAfterTranslation(ls)), deva: ls.filter(hasDeva).join(" ") };
    }
    return null;
  }
}
const bookUrl = (book, page) => `https://www.wisdomlib.org/hinduism/book/${book}/d/${page}.html`;
async function fetchBhashya(book, loc, fragments) {
  const [doc, key] = loc.split("#");
  const mode = !key ? "page" : /^\d+$/.test(key) ? "ordinal" : "heading";
  let page = doc;
  for (let hop = 0; hop < 14; hop++) {
    const url = bookUrl(book, page);
    const html = await cached(join(CACHE, "wisdomlib", book, `${page}.html`), url, 900);
    const text = pageText(html);
    const got = extractBhashya(text, mode, key);
    if (got && got.body.length > 40) {
      const deva = mode === "heading" ? got.deva : (text.match(/[ऀ-ॿ][ऀ-ॿ\s।॥ऽ॰]+/g) || []).join(" ");
      if (deva && hasDeva(deva)) {
        const d = normDeva(deva);
        if (!fragments.some((f) => d.includes(normDeva(f)))) throw new Error(`${url}: Devanagari on page does not match anchor (${fragments.join(" | ")})`);
      }
      return { text: got.body, source: url, verifiedBy: deva && hasDeva(deva) ? "devanagari" : mode === "ordinal" ? "text-number" : "page-title" };
    }
    if (mode !== "heading") break;
    page = html.match(/href="\/hinduism\/book\/[^"]+\/d\/(doc\d+)\.html"[^>]*>\s*Next/i)?.[1];
    if (!page) break;
  }
  throw new Error(`commentary not found at ${book}/${loc}`);
}
/** Walk a whole commentary book and attach each page to the mantra whose Devanagari it carries. */
async function crawlBook(book, verses) {
  const index = await cached(join(CACHE, "wisdomlib", "_index", `${book}.html`), `https://www.wisdomlib.org/hinduism/book/${book}`);
  const docs = [...index.matchAll(new RegExp(`/hinduism/book/${book}/d/doc(\\d+)\\.html"[^>]*>([^<]*)`, "g"))].map((m) => ({ n: Number(m[1]), title: m[2] }));
  const chapters = docs.filter((d) => !/Title Page|Photograph|Preface|Foreword|Contents|Bibliography|Index|Glossary|Abbreviation|Transliteration/i.test(d.title));
  if (!chapters.length) return {};
  const from = Math.min(...chapters.map((d) => d.n));
  const to = Math.max(...docs.map((d) => d.n)) + 60;
  const keyOf = new Map(verses.map((v) => [v.id, normDeva(v.sa[0] || "").slice(0, 14)]));
  const found = {};
  let misses = 0;
  for (let n = from; n <= to && misses < 8; n++) {
    let html;
    try {
      html = await cached(join(CACHE, "wisdomlib", book, `doc${n}.html`), bookUrl(book, `doc${n}`), 900);
    } catch (e) {
      if (e.notFound) { misses++; continue; }
      throw e;
    }
    if (!html.includes(`/hinduism/book/${book}/`)) { misses++; continue; }
    misses = 0;
    const text = pageText(html);
    const got = extractBhashya(text, "page");
    if (!got || got.body.length < 60) continue;
    const pageDeva = normDeva((text.slice(0, Math.max(800, text.search(/Commentary|Bhāṣya|Bhashya/i))).match(/[ऀ-ॿ][ऀ-ॿ\s।॥ऽ॰]+/g) || []).join(" "));
    if (pageDeva.length < 12) continue;
    const v = verses.find((x) => !found[x.id] && keyOf.get(x.id).length >= 10 && pageDeva.includes(keyOf.get(x.id)));
    if (v) found[v.id] = { text: got.body, source: bookUrl(book, `doc${n}`), verifiedBy: "devanagari" };
  }
  return found;
}

/** Walk a whole commentary book whose pages are laid out per section, and attach every verse block on it.
 *    khanda   (Chāndogya, Ganganatha Jha) — the book index lists one page per khaṇḍa ("Section 4.4 …"); each page holds
 *             "Upaniṣad text: … —(n)" / "Commentary (Śaṅkara Bhāṣya): …" blocks, numbered within the khaṇḍa.
 *    heading  (Bṛhadāraṇyaka, Mādhavānanda) — pages are followed by their Next links from `from`; each holds
 *             "Verse a.b.c:" blocks (Devanagari, IAST, numbered translation, commentary). A block is attached only when
 *             its Devanagari carries the opening of our mantra. */
/** A printed translation from its archive.org scan: { url, entries: { ref → text } } (see scripts/lib/ocr-sources.mjs). */
async function ocrSource(key) {
  const src = OCR_SOURCES[key];
  if (!src) throw new Error(`unknown scan ${key}`);
  const text = await cached(join(CACHE, "archive", src.cache), `https://archive.org/download/${src.item}/${encodeURIComponent(src.file)}`, 1500);
  const entries = {};
  if (src.kind === "commentary") Object.assign(entries, commentaryUnits(text, src.spec));
  else if (src.kind === "excerpts") {
    const all = text.split(/\r?\n/);
    for (const x of src.excerpts) {
      const s = all.findIndex((l, i) => i >= (x.startAfter || 0) && x.start.test(l.trim()));
      const e = s < 0 ? -1 : all.findIndex((l, i) => i > s && x.end.test(l.trim()));
      if (s < 0 || e < 0) throw new Error(`${key}: excerpt ${x.key} not found`);
      // drop the book's editorial headings (short, no closing punctuation) between paragraphs
      let t = paragraphs(stripPageFurniture(all.slice(s, e), { heads: src.heads })).filter((p) => /[.!?’”'")\]]$/.test(p) || p.length > 90).join(" ");
      for (const [re, to] of src.fixes || []) t = t.replace(re, to);
      if (x.from) t = t.slice(Math.max(0, t.indexOf(x.from)));
      entries[x.key] = t;
    }
  } else for (const c of src.chapters) numberedSections(text, { start: c.start, end: c.end, count: c.count, heads: src.heads, startAfter: src.startAfter }).forEach((t, i) => (entries[`${c.ch}.${i + 1}`] = t));
  if (src.chapters5) for (const c of src.chapters5) numberedSections(text, { ...c, heads: src.heads, startAfter: src.startAfter }).forEach((t, i) => (entries[`${c.ch}.${i + 1}`] = t));
  return { url: `https://archive.org/details/${src.item}`, entries };
}

/** Consonant skeleton of Devanagari: editions differ in sandhi (उचुः त्वं / उचुस्त्वं), -m vs anusvāra and small typos. */
const skeleton = (s) => normDeva(s).replace(/[ा-्ऀ-ः॑-॔ॢॣ]/g, "");
function dice(a, b) {
  const grams = (x) => { const m = new Map(); for (let i = 0; i < x.length - 1; i++) { const g = x.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(a), B = grams(b);
  let common = 0, total = 0;
  for (const [g, n] of A) { common += Math.min(n, B.get(g) || 0); total += n; }
  for (const n of B.values()) total += n;
  return total ? (2 * common) / total : 0;
}
/** Does a commentary block's Devanagari open with this mantra? (compares the opening ~24 consonants) */
const opensWith = (blockDeva, verseSa) => {
  const v = skeleton(verseSa).slice(0, 24), b = skeleton(blockDeva).slice(0, 30);
  return v.length < 6 || b.length < 6 || dice(v, b.slice(0, Math.max(v.length, 8))) >= 0.55 || b.includes(v.slice(0, 10));
};
async function walkBook(book, spec, verses, abbrev) {
  const byRef = new Map(verses.map((v) => [v.ref, v]));
  const found = {};
  const misses = [];
  if (spec.mode === "khanda") {
    const index = await cached(join(CACHE, "wisdomlib", "_index", `${book}.html`), `https://www.wisdomlib.org/hinduism/book/${book}`);
    // The chapter comes from the index's "Chapter N" entries: the book titles Chapter 8's pages "Section 7.x".
    const pages = [];
    let chapter = null;
    for (const m of index.matchAll(new RegExp(`/hinduism/book/${book}/d/(doc\\d+)\\.html"[^>]*>\\s*(?:Chapter (\\d+)|Section (\\d+)\\.(\\d+)\\b)`, "g"))) {
      if (m[2]) chapter = m[2];
      else pages.push({ doc: m[1], p: chapter ?? m[3], k: m[4] });
    }
    for (const pg of pages) {
      const html = await cached(join(CACHE, "wisdomlib", book, `${pg.doc}.html`), bookUrl(book, pg.doc), 900);
      const blocks = pageText(html).split(/Upaniṣad text\s*:/i).slice(1);
      for (const b of blocks) {
        const [mula, ...rest] = b.split(/Commentary\s*\(Śaṅkara(?:’s)? Bhāṣya\)\s*:/i);
        // one block may carry several mantras "—(1) … —(2) … —(3)" with a single joint commentary "(1-3)"
        const nums = [...mula.matchAll(/\((\d+)(?:\s*[-–]\s*(\d+))?\)/g)].flatMap((x) => [Number(x[1]), Number(x[2] || x[1])]);
        if (!nums.length || !rest.length) continue;
        const body = tidy(rest.join("\n")).replace(/\s*—?\(\d+(?:[-–]\d+)?\)\.?\s*$/, "").replace(/\n?End of Section[\s\S]*$/i, "").trim();
        if (body.length < 30) continue;
        const from = Math.min(...nums), to = Math.max(...nums);
        for (let n = from; n <= to; n++) {
          const ref = `${pg.p}.${pg.k}.${n}`;
          if (!byRef.has(ref)) { misses.push(`${abbrev} ${ref} (${pg.doc}: no such mantra)`); continue; }
          if (found[`${abbrev}_${ref}`]) continue;
          found[`${abbrev}_${ref}`] = { text: body, source: bookUrl(book, pg.doc), verifiedBy: "text-number", ...(to > from ? { joint: `${pg.p}.${pg.k}.${from}–${to}` } : {}) };
        }
      }
    }
  } else if (spec.mode === "heading") {
    let page = spec.from;
    const seen = new Set();
    for (let hop = 0; page && hop < 2000 && !seen.has(page); hop++) {
      seen.add(page);
      const html = await cached(join(CACHE, "wisdomlib", book, `${page}.html`), bookUrl(book, page), 900);
      // "Verse 2.4.1:" — on the first pages the colon is missing and the heading stands alone on its line
      const parts = pageText(html).split(/(?:^|\n)Verse (\d+\.\d+\.\d+(?:\s*[-–]\s*\d+)?)\s*(?::|(?=\n))/);
      for (let i = 1; i < parts.length; i += 2) {
        const [ref, to] = parts[i].split(/\s*[-–]\s*/);
        const ls = parts[i + 1].split("\n").map((l) => l.trim()).filter(Boolean);
        const deva = ls.filter(hasDeva).join(" ");
        const body = tidy(commentaryAfterTranslation(ls));
        if (body.length < 30) continue;
        const last = to ? `${ref.split(".").slice(0, 2).join(".")}.${to}` : ref;
        const refs = verses.filter((v) => refKey(v.ref) >= refKey(ref) && refKey(v.ref) <= refKey(last)).map((v) => v.ref);
        for (const r of refs) {
          const v = byRef.get(r);
          // a joint block opens with its first mantra only
          if (r === refs[0] && deva && !opensWith(deva, v.sa.join(" "))) { misses.push(`${abbrev} ${r} (${page}: Devanagari differs)`); continue; }
          if (found[v.id]) continue;
          found[v.id] = { text: body, source: bookUrl(book, page), verifiedBy: deva ? "devanagari" : "text-number", ...(refs.length > 1 ? { joint: `${ref}–${last}` } : {}) };
        }
      }
      const next = html.match(new RegExp(`href="/hinduism/book/${book}/d/(doc\\d+)\\.html"[^>]*title="[^"]*"\\s*>\\s*Next`, "i"))?.[1] || html.match(/href="\/hinduism\/book\/[^"]+\/d\/(doc\d+)\.html"[^>]*>\s*Next/i)?.[1];
      page = next;
    }
  } else if (spec.mode === "anchored") {
    // (Taittirīya, A. Mahadeva Sastri) — one passage is a whole anuvāka, which the book spreads over several pages,
    // interleaving each sentence of the text (Devanagari, IAST, English) with the commentary on it. Pages are read in
    // order; a passage begins where its opening Devanagari appears, and everything in English up to the next passage's
    // opening is its commentary (the English renderings of the text's sentences stay inline, as the book prints them).
    const order = verses.filter((v) => v.sa?.length);
    const acc = new Map();
    let cur = -1;
    let page = spec.from;
    const seen = new Set();
    for (let hop = 0; page && hop < 800 && !seen.has(page); hop++) {
      seen.add(page);
      const html = await cached(join(CACHE, "wisdomlib", book, `${page}.html`), bookUrl(book, page), 900);
      const lines = pageText(html).split("\n").map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (hasDeva(l)) {
          for (let j = cur + 1; j < Math.min(order.length, cur + 3); j++) {
            if (opensWith(l, order[j].sa.join(" "))) { cur = j; acc.set(order[j].id, { lines: [], source: bookUrl(book, page) }); break; }
          }
          continue;
        }
        if (/\|\s*$|\|\|/.test(l) && /[āīūṛṃḥśṣṇṭḍ]/.test(l)) continue; // IAST of the line above
        if (cur >= 0 && !/^(Footnotes and references|Previous|Next)\b/i.test(l)) acc.get(order[cur].id).lines.push(l);
      }
      if (spec.until && page === spec.until) break;
      page = html.match(/href="\/hinduism\/book\/[^"]+\/d\/(doc\d+)\.html"[^>]*>\s*Next/i)?.[1];
    }
    for (const [vid, a] of acc) {
      const text = tidy(a.lines.join("\n"));
      if (text.length >= 60) found[vid] = { text, source: a.source, verifiedBy: "devanagari" };
    }
    for (const v of order) if (!acc.has(v.id)) misses.push(`${abbrev} ${v.ref} (opening not found)`);
  }
  return { found, misses };
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────────
const anchors = JSON.parse(await readFile(join(ROOT, "data", "curated", "anchors.json"), "utf8")).anchors;

// Diacritic repair for text read from scans: a lexicon of every IAST word form in the committed corpus (passages and
// word-by-word forms), and an English vocabulary from the clean, hand-typed Wisdom Library commentaries.
const repair = await (async () => {
  const iast = [], english = [];
  for (const d of (await readdir(CORPUS, { withFileTypes: true })).filter((x) => x.isDirectory())) {
    const p = (f) => join(CORPUS, d.name, f);
    if (await exists(p("verses.json"))) for (const v of JSON.parse(await readFile(p("verses.json"), "utf8"))) {
      iast.push(v.iast.join(" "));
      for (const w of v.words || []) iast.push([w[1], w[3]].filter(Boolean).join(" "));
    }
    if (await exists(p("words.json"))) for (const ws of Object.values(JSON.parse(await readFile(p("words.json"), "utf8")).words || {})) for (const w of ws) iast.push([w[1], w[3]].filter(Boolean).join(" "));
    if (["chandogya", "brihadaranyaka"].includes(d.name) && (await exists(p("bhashya.json")))) for (const b of Object.values(JSON.parse(await readFile(p("bhashya.json"), "utf8")))) if (!b.ocr) english.push(b.text);
  }
  const lex = buildLexicon(iast), en = buildEnglish(english);
  let fixed = 0;
  return { fix: (t) => { const r = restoreDiacritics(t, lex, en); fixed += r.fixed; return r.text; }, get fixed() { return fixed; } };
})();
const shantiIndex = audioIndexAll.audio?.shanti || [];
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null; // npm run data:sources -- --only chandogya,brihadaranyaka
const ids = (await readdir(CORPUS, { withFileTypes: true })).filter((d) => d.isDirectory() && (!ONLY || ONLY.includes(d.name))).map((d) => d.name);
const problems = [];

for (const id of ids) {
  const metaPath = join(CORPUS, id, "meta.json");
  if (!(await exists(metaPath))) continue;
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  const ing = meta.ingest;
  let base, shantiSa = null;
  if (ing.org) base = orgVerses(meta, await orgBlock(ing.org));
  else if (ing.wikisource) ({ verses: base, shantiSa } = await wikisourceVerses(meta, ing.wikisource));
  else { problems.push(`${id}: no text source`); continue; }

  // Śaṅkara-tradition English
  const pdf = ing.pdf.chapter ? null : pdfTranslations(ing.pdf);
  const chapters = ing.pdf.chapter ? pdfChapters(ing.pdf) : null;
  const translator = pdf?.translator || chapters?.translator;
  const au = audioIndex[ing.org] || {};
  const verses = base.map((v) => {
    let tr = null;
    if (pdf?.map.has(v.ref)) {
      const t = pdf.map.get(v.ref);
      tr = { text: t.text, by: translator, source: "108 Upanishads (comp. R. Sheppard)", ...(t.joint ? { joint: t.joint } : {}) };
    } else if (chapters) {
      const chap = v.ref.split(".")[0];
      const text = chapters.chapters.get(chap);
      const all = base.filter((x) => x.ref.split(".")[0] === chap);
      if (text) tr = { text, by: translator, source: "108 Upanishads (comp. R. Sheppard)", joint: `${all[0].ref}–${all.at(-1).ref}` };
    }
    const auKey = [v.ref, v.ref.replace(/\./g, "/")].find((k) => au.t?.[k]);
    return { ...v, tr, audio: auKey && au.t[auKey][2] ? { mp3: au.t[auKey][2], whole: [au.t[auKey][0], au.t[auKey][1]] } : null, hasBhashya: false };
  });

  // The peace invocation, as an addressable passage "0" at the head of the text.
  if (ing.shanti) {
    const s = shantiIndex.find((x) => x.nm === ing.shanti);
    const sa = s ? lines(s.sa) : shantiSa;
    if (!sa?.length) problems.push(`${id}: śānti mantra ${ing.shanti} not found`);
    else {
      const en = pdf?.shanti || chapters?.shanti || "";
      verses.unshift({
        id: `${meta.abbrev}_0`, ref: "0", section: `Śānti mantra · ${ing.shanti}`, shanti: true,
        sa, iast: s ? lines(s.ia) : sa.map(devaToIast), alt: [], words: [],
        tr: en ? { text: en.replace(/\n/g, " "), by: translator, source: "108 Upanishads (comp. R. Sheppard)" } : null,
        audio: s?.url ? { mp3: s.url, whole: [0, s.dur || 0] } : null, hasBhashya: false,
      });
    }
  }
  verses.sort((a, b) => refKey(a.ref).localeCompare(refKey(b.ref)));
  verses.forEach((v, i) => (v.order = i + 1));

  // A second translation for the passages the first one leaves out (Maitrī: Hume 1921, from the archive.org scan).
  if (ing.supplement?.ocr) {
    try {
      const got = await ocrSource(ing.supplement.ocr);
      const entries = { ...got.entries };
      // passages the source numbers differently, mapped by hand (see meta.json)
      for (const [ours, spec] of Object.entries(ing.supplement.map || {})) {
        const t = entries[spec.from];
        if (!t) continue;
        if (spec.lines) {
          const flat = t.replace(/\n/g, " ");
          const a = flat.indexOf(spec.lines[0]);
          const b = spec.lines[1] ? flat.indexOf(spec.lines[1], a + 1) : -1;
          if (a >= 0) entries[`=${ours}`] = flat.slice(spec.withIntro ? 0 : a, b > a ? b : undefined).trim();
        } else entries[`=${ours}`] = t;
      }
      let n = 0;
      for (const v of verses) {
        if (v.tr || v.shanti) continue;
        const text = entries[`=${v.ref}`] ?? (ing.supplement.map?.[v.ref] ? null : entries[v.ref]);
        if (!text) continue;
        v.tr = { text: repair.fix(text.replace(/\n/g, " ")), by: ing.supplement.translator, source: `${ing.supplement.source} (archive.org scan)`, ocr: true };
        n++;
      }
      log(`  ${id}: ${n} passage(s) translated from ${ing.supplement.translator}`);
    } catch (e) {
      problems.push(`${id}: supplementary translation failed: ${e.message}`);
    }
  }

  // Śaṅkara's commentary: the whole book where it can be walked, plus every anchor.
  const bhashya = {};
  if (ing.bhashya?.crawl) {
    try {
      const got = await crawlBook(ing.bhashya.book, verses.filter((v) => !v.shanti));
      for (const [vid, b] of Object.entries(got)) bhashya[vid] = { author: "Śaṅkara", lang: "en", translator: ing.bhashya.translator, edition: ing.bhashya.edition, ...b };
    } catch (e) {
      problems.push(`${id}: commentary crawl failed: ${e.message}`);
    }
  }
  if (ing.bhashya?.walk) {
    try {
      const { found, misses } = await walkBook(ing.bhashya.book, ing.bhashya.walk, verses.filter((v) => !v.shanti), meta.abbrev);
      for (const [vid, b] of Object.entries(found)) bhashya[vid] = { author: "Śaṅkara", lang: "en", translator: ing.bhashya.translator, edition: ing.bhashya.edition, ...b };
      if (misses.length) log(`  ${id}: ${misses.length} commentary block(s) not attached, e.g. ${misses.slice(0, 4).join("; ")}`);
    } catch (e) {
      problems.push(`${id}: commentary walk failed: ${e.message}`);
    }
  }
  // Commentary that only a printed translation carries: read from the archive.org scan (OCR, cleaned).
  if (ing.bhashya?.ocr) {
    try {
      const got = await ocrSource(ing.bhashya.ocr);
      for (const [ref, text] of Object.entries(got.entries)) {
        const v = verses.find((x) => x.ref === ref && !x.shanti);
        if (!v) { log(`  ${id}: scan section ${ref} has no passage`); continue; }
        if (text.length < 120) continue; // a joint commentary given at a neighbouring verse, or a scan gap
        bhashya[v.id] = { author: ing.bhashya.author || "Śaṅkara", lang: "en", translator: ing.bhashya.translator, edition: ing.bhashya.edition, text: repair.fix(text), source: got.url, verifiedBy: "text-number", ocr: true, ...(ing.bhashya.note ? { note: ing.bhashya.note } : {}) };
      }
    } catch (e) {
      problems.push(`${id}: commentary scan failed: ${e.message}`);
    }
  }
  const wantB = Object.entries(anchors).filter(([vid, a]) => a.bhashya && vid.startsWith(`${meta.abbrev}_`));
  if (wantB.length && !ing.bhashya) problems.push(`${id}: anchors ask for commentary but meta has no bhashya book`);
  for (const [vid, a] of wantB) {
    if (!ing.bhashya?.book || bhashya[vid]) continue;
    try {
      const b = await fetchBhashya(ing.bhashya.book, a.bhashya, a.sa);
      bhashya[vid] = { author: "Śaṅkara", lang: "en", translator: ing.bhashya.translator, edition: ing.bhashya.edition, text: b.text, source: b.source, verifiedBy: b.verifiedBy };
    } catch (e) {
      problems.push(`${vid}: ${e.message}`);
    }
  }
  for (const vid of Object.keys(bhashya)) {
    const v = verses.find((x) => x.id === vid);
    if (v) v.hasBhashya = true;
    else { problems.push(`${vid}: commentary fetched but verse not in corpus`); delete bhashya[vid]; }
  }

  await writeFile(join(CORPUS, id, "verses.json"), JSON.stringify(verses, null, 1), "utf8");
  await writeFile(join(CORPUS, id, "bhashya.json"), JSON.stringify(bhashya, null, 1), "utf8");
  const noTr = verses.filter((v) => !v.tr).length;
  log(`${id.padEnd(15)} ${String(verses.length).padStart(4)} passages · ${verses.length - noTr} tr. (${translator}) · ${verses.filter((v) => v.alt.length).length} Aurobindo · ${verses.filter((v) => v.audio).length} audio · ${verses.filter((v) => v.words.length).length} word-analysed · ${Object.keys(bhashya).length} bhāṣya`);
}

// ── external texts: the Gītā (GitaViśva) and the Saṃhitās (VedAnvaya), for checking parallels ─────────
const crossrefs = JSON.parse(await readFile(join(ROOT, "data", "curated", "crossrefs.json"), "utf8")).crossrefs;
const roots = JSON.parse(await readFile(join(ROOT, "data", "curated", "vedic-roots.json"), "utf8").catch(() => '{"mantraRoots":[]}'));
const wantExt = new Set([...crossrefs.flatMap((c) => [c.a, c.b]), ...(roots.mantraRoots || []).flatMap((r) => r.ext)].filter((s) => /^(BG|RV|YV)_/.test(s)));
const external = {};
if (await exists(GITA_VERSES)) {
  const gita = JSON.parse(await readFile(GITA_VERSES, "utf8"));
  for (const side of wantExt) {
    if (!side.startsWith("BG_")) continue;
    const v = gita.verses.find((x) => x.id === side);
    if (v) external[side] = { sa: v.sanskrit, iast: v.iast, source: "GitaViśva gita-verses.json" };
  }
} else problems.push(`GitaViśva data not found at ${GITA_VERSES}; BG parallels will not be text-checked`);
const rvFile = join(VEDA, "rigveda_full_v1", "text_versions.jsonl");
if (await exists(rvFile)) {
  const want = [...wantExt].filter((s) => s.startsWith("RV_"));
  const ls = (await readFile(rvFile, "utf8")).split("\n");
  for (const rv of want) {
    const loc = `"source_locator":"RV ${rv.slice(3)}"`;
    const hit = ls.find((l) => l.includes(loc) && l.includes('"text_role":"PRIMARY_TEXT"')) || ls.find((l) => l.includes(loc));
    if (hit) { const r = JSON.parse(hit); external[rv] = { iast: [r.text_nfc || r.text_original], source: `VedAnvaya ${r.source_id} ${r.source_locator}` }; }
    else problems.push(`${rv}: not found in VedAnvaya`);
  }
}
// The Vājasaneyi Saṃhitā: the pilot set (adhyāyas 1, 16, 31, 40), then the full Mādhyandina text (1–40).
const yvFiles = ["yajurveda_pilot_v1", "yajurveda_vsm_v1"].map((d) => join(VEDA, d, "text_versions.jsonl"));
if (await exists(yvFiles[0])) {
  const ls = [];
  for (const f of yvFiles) if (await exists(f)) ls.push(...(await readFile(f, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l)));
  const accented = (t) => /[॒॑᳐-᳿꣠-ꣿ]/.test(t || "");
  for (const yv of [...wantExt].filter((s) => s.startsWith("YV_"))) {
    const ref = yv.slice(3);
    const hits = ls.filter((r) => r.source_locator?.endsWith(`#${ref}`));
    const hit = hits.find((r) => !accented(r.text_nfc)) || hits[0];
    if (hit) external[yv] = { sa: hit.text_nfc, source: `VedAnvaya ${hit.source_id} ${hit.source_locator}` };
    else problems.push(`${yv}: not found in VedAnvaya`);
  }
}
await writeFile(join(ROOT, "data", "curated", "external-text.json"), JSON.stringify(external, null, 1), "utf8");
log(`external texts: ${Object.keys(external).length} (${Object.keys(external).join(", ")})`);

log(`diacritics restored in scanned text: ${repair.fixed} word(s)`);
if (problems.length) { log(`\n${problems.length} problem(s):\n` + problems.join("\n")); process.exitCode = 1; }
