// Segment the archive.org OCR text (djvu.txt) of a printed translation into numbered sections.
// Printed books carry page furniture that the OCR keeps: running heads ("MAITRI UPANISHAD", "[-6.4", "6. 4-]"),
// page numbers, footnotes at the foot of each page, editorial headings above a section, and footnote markers
// glued to words ("sun,2"). This strips that furniture and returns the body text of each numbered section,
// found strictly in order (1, 2, 3 …) so a stray number inside a footnote or a reference cannot start a section.

/** Digits as the OCR tends to misread them. */
const ocrDigit = { 0: "[0oO]", 1: "[1iIlt]", 2: "[2a]", 5: "[5S]", 8: "[8B]" };
const numberPattern = (n) => String(n).split("").map((d) => ocrDigit[d] || d).join("");

/** Remove running heads, page numbers and the footnote block at the foot of each page. */
export function stripPageFurniture(lines, { heads = [] } = {}) {
  const headRe = heads.length ? new RegExp(`^\\s*(\\[?[-–]?[\\dIiVvXxl.\\s]*[-–]?[\\]J]?\\s*)?(${heads.join("|")})(\\s+\\[?[-–]?[\\d.\\s]*[-–]?[\\]J]?)?\\s*$`, "i") : null;
  const out = [];
  let inNote = false; // inside one footnote paragraph (footnotes are blank-separated and each opens with its number)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (!t) { inNote = false; out.push(""); continue; }
    // page numbers, also as the OCR misreads them ("43°")
    if (/^\d{1,3}[°o]?\s*$/.test(t) || /^[\dIl]{2,3}[°o]\s*$/.test(t)) { out.push(""); continue; }
    if (headRe && headRe.test(t)) { out.push(""); continue; }
    // stand-alone running-head references such as "[-6.4", "[-6. io", "6. 4-]", "6. i8-J"
    if (/^\[?[-–]\s*[\diIlo]+\s*\.\s*[\diIlo]+\s*\*?\s*$/.test(t) || /^[\diIl]+\s*\.\s*[\diIlo\s]+[-–]\s*[\]J]\s*$/.test(t) || /^\[[-–]?[\d.\s*]+$/.test(t)) { out.push(""); continue; }
    // a footnote paragraph: "1 For the same…", "* Chand. 3. 14. 1." after a blank line
    if (/^(\d{1,2}|[*§†■])\s+(?!\.)\S/.test(t) && !/^\d{1,2}\s*\.\s/.test(t) && (out.length === 0 || out[out.length - 1].trim() === "")) inNote = true;
    if (inNote) continue;
    out.push(l);
  }
  return out;
}

/** Join wrapped lines into paragraphs, mending hyphenation and OCR spacing; drops footnote markers glued to words. */
export function paragraphs(lines) {
  const paras = [];
  let cur = [];
  const flush = () => { if (cur.length) paras.push(cur.join(" ")); cur = []; };
  for (const raw of lines) {
    let t = raw.replace(/\s+/g, " ").trim();
    if (/^[oO0cC\s.,'"\-•■]+$/.test(t)) t = ""; // Devanagari remnants ("o o o", "C O")
    t = t.replace(/([.!?’”'")\]])\s?\d{1,2}$/, "$1").replace(/\s\.\s?\d{1,2}$/, "."); // line-end footnote marker: "Water . 1"
    if (!t) {
      // a page break inside a sentence is not a paragraph break
      const last = cur.at(-1) || "";
      if (cur.length && !/[.!?’”'"):;]\s*$/.test(last)) continue;
      flush();
      continue;
    }
    if (cur.length && /[a-z]-$/.test(cur.at(-1)) && /^[a-z]/.test(t)) cur[cur.length - 1] = cur.at(-1).slice(0, -1) + t;
    else cur.push(t);
  }
  flush();
  return paras.map(cleanOcr).filter(Boolean);
}

/** OCR noise inside a line: running heads fused into the text, page refs, Devanagari remnants. */
const RUNNING_HEAD = /\b[A-Z0-9$]{3,}(?:\s+[A-Z0-9$]{2,})*\s+UPANI[A-Z0-9$]{2,5}\b(?:\s+\d{1,3}\b)?/g;
const PAGE_REF = /\[?\s?\b[IJl1]{1,3}\s?\.\s?[ivxlj1]{1,4}\s?\.\s?[\dIl]{1,2}\s?[\]J](?=\s|$)|\[\s?[IJl1]{1,3}\s?\.\s?[ivxlj1]{1,4}\s?\.\s?[\dIl]{1,2}\b/g;
const junkToken = (w) =>
  /[\^§■\\<>{}|~•]/.test(w) || // symbols the OCR makes of Devanagari
  /[a-z][A-Z]/.test(w.replace(/^[‘“'"(]+|[’”'")\].,;:!?]+$/g, "")) || // "fWra", "sTfafefT"
  (/^[^A-Za-z]*$/.test(w) && !/^[\d.,;:—–\-()‘’“”'"!?]+$/.test(w)) ||
  /^[a-z]{1,2}[?!*]$/.test(w) ||
  /q(?!u)/i.test(w) || // neither English nor the (diacritic-less) Sanskrit in these books has q without u
  /[A-Z]{2,}[a-z]/.test(w.replace(/^[‘“'"(]+/, "")) || // "SRTTff:", "TOTTOfr"
  /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w) || // "srrcfta" … but not "lengths"
  /^[A-Z]{3,}[:.]?$/.test(w) && !/^(OM|AUM|ŚRĪ|SRI|NOTE|PART|I{1,3}|IV|VI{0,3}|IX|XI{0,3})$/.test(w.replace(/[:.]$/, ""));
const shortJunk = (w) => /^([IiVvXxnl|]{1,4}[.:?!]*|[a-z]{1,2}[.:?]?|\d{1,2}|[A-Z]{1,3}[.:]?|[-–:;.,?*()\[\]]+)$/.test(w) && !/^(a|I|O|is|in|of|it|to|as|by|he|we|be|or|on|so|no|if|at)$/.test(w);
/** A paragraph that opens with leftover marks of a Devanagari line: "I SRTTff: I II II?fr ii We shall speak…" */
const stripLeadingJunk = (s) => {
  // a verse number soon after a prefix with no English in it: the prefix is the misread Devanagari of that verse
  const m = s.slice(0, 160).match(/(?:^|\s)\d{1,2}(?:-\d{1,2})?\.\s+[A-Za-z‘“]/);
  if (m && m.index > 0 && !/\b(the|of|and|is|to|in|that|as|by|with|for|this|which)\b/i.test(s.slice(0, m.index))) s = s.slice(m.index).trim();
  s = s.replace(/\s*PART\s+[IVXl1]{1,4}\s+On\b.*$/, ""); // the next Part's title page running into this unit
  const ws = s.split(" ");
  let k = 0;
  while (k < ws.length && shortJunk(ws[k]) && !/^\d{1,2}\.$/.test(ws[k])) k++;
  return k >= 2 || (k === 1 && ws[0].length <= 2 && /^[A-Z]/.test(ws[1] || "")) ? ws.slice(k).join(" ") : s;
};
export function cleanOcr(s) {
  s = s.replace(RUNNING_HEAD, " ").replace(PAGE_REF, " ").replace(/[{]/g, "(").replace(/[}]/g, ")"); // "{prana)" is "(prana)"
  s = stripLeadingJunk(s.split(/\s+/).filter((w) => !junkToken(w)).join(" "));
  // trailing debris after the last sentence end ("… limbs. 1 o o o o", "… for us.” crrsft 3 i anrasr irii"):
  // a short tail with no common English word is Devanagari the OCR misread
  const english = /\b(the|of|and|is|to|in|that|a|as|by|with|for|it|he|this|not|be|are|was|from|on|or|which|so|being)\b/i;
  // a whole short paragraph of misread Devanagari (but keep verse lines such as "Thou art Rudra. Thou art Prajāpati.")
  const wordlike = (w) => /^[‘“'"(]*[A-Za-zāīūṛṣṇśḥṃ][a-zāīūṛṣṇśḥṃ’'-]*[’”'"),.;:!?—]*$/.test(w) && /[aeiouyāīū]/i.test(w);
  const toks = s.split(" ").filter(Boolean);
  if (s.length < 140 && !english.test(s) && toks.filter(wordlike).length < toks.length * 0.75) return "";
  const end = Math.max(...[".", "!", "?", "’", "”", ")"].map((c) => s.lastIndexOf(c)));
  if (end > 0 && end < s.length - 1) {
    const tail = s.slice(end + 1);
    if (tail.length < 90 && !english.test(tail)) s = s.slice(0, end + 1);
  }
  return s
    .replace(/([a-zA-Z.,;:!?’'”\)\]])(\d{1,2})(?=[\s,.;:’”)]|$)/g, "$1") // footnote markers: "sun,2" "above.1"
    .replace(/(\S)\s?\*(?=\s|$)/g, "$1") // "(vyahrti)*"
    .replace(/[{]/g, "(").replace(/[}]/g, ")")
    .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/‘\s+/g, "‘").replace(/\s+’/g, "’")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A line of Devanagari that the English OCR turned into noise ("^Tvirt srn: sn^rrsrinf§Twt"), or a stray mark. */
const garbage = (t) => !/^(PART|CHAPTER|SECTION)\b/.test(t) && (/[\^§]|[a-z][A-Z]{2,}[a-z]/.test(t) || (/^[\W\d_A-Z\s]{1,14}$/.test(t) && !/^[IVXL]+\.?$/.test(t)));

/**
 * Śaṅkara's commentary from a printed translation laid out as "text, then commentary" (Swami Gambhīrānanda's
 * editions): units are found by their headings in order (PART / CHAPTER, as the OCR reads them); within a unit,
 * verses are found by their numbers 1..n in order. The first paragraph after a verse number is the translation of
 * the verse (already shown with the passage) and is dropped; the rest, up to the next verse, is the commentary.
 * `whole: true` keeps a unit as one passage (a Taittirīya anuvāka), translation sentences inline.
 */
export function commentaryUnits(text, { start, end, units, heads = [], startAfter = 0 }) {
  const all = text.split(/\r?\n/);
  const s = all.findIndex((l, i) => i >= startAfter && start.test(l.trim()));
  if (s < 0) throw new Error(`start ${start} not found`);
  let e = end ? all.findIndex((l, i) => i > s && end.test(l)) : -1;
  if (e < 0) e = all.length;
  const lines = stripPageFurniture(all.slice(s, e), { heads })
    .map((l) => (garbage(l.trim()) || /^\[?[IVXLivxl1]+\s*\.\s*[ivxl1]+\s*\.?\s*[\d]*\s*[\]J]?\s*$/.test(l.trim()) ? "" : l));
  // locate unit headings in order
  const at = [];
  let from = 0;
  for (const u of units) {
    const i = lines.findIndex((l, k) => k >= from && u.at.test(l.trim()));
    if (i < 0) throw new Error(`unit ${u.ref} heading not found`);
    at.push(i);
    from = i + 1;
  }
  const out = {};
  units.forEach((u, k) => {
    const body = lines.slice(at[k] + (u.inclusive ? 0 : 1), k + 1 < at.length ? at[k + 1] : lines.length);
    if (u.whole) { out[u.ref] = paragraphs(body).join("\n"); return; }
    // verses 1..count in order
    const marks = [];
    let f = 0;
    for (let n = 1; n <= u.count; n++) {
      const re = new RegExp(`^\\s*${numberPattern(n)}\\s*\\.\\s+[A-Z‘“'(]`);
      const i = body.findIndex((l, j) => j >= f && re.test(l));
      if (i < 0) { marks.push(null); continue; }
      marks.push(i);
      f = i + 1;
    }
    marks.forEach((m, n) => {
      if (m === null) return;
      const nextAt = marks.slice(n + 1).find((x) => x !== null) ?? body.length;
      const seg = body.slice(m, nextAt);
      seg[0] = seg[0].replace(new RegExp(`^\\s*${numberPattern(n + 1)}\\s*\\.\\s+`), "");
      const ps = paragraphs(seg);
      out[`${u.ref}.${n + 1}`] = ps.slice(1).join("\n");
    });
  });
  return out;
}

/**
 * Sections numbered 1..count inside [startRe, endRe). Each section's text runs to the next one; an editorial heading
 * (a paragraph without closing punctuation right before the next number) is dropped.
 */
export function numberedSections(text, { start, end, count, heads = [], startAfter = 0 }) {
  const all = text.split(/\r?\n/);
  const s = all.findIndex((l, i) => i >= startAfter && start.test(l.trim()));
  if (s < 0) throw new Error(`start ${start} not found`);
  let e = all.findIndex((l, i) => i > s && end.test(l));
  if (e < 0) e = all.length;
  const lines = stripPageFurniture(all.slice(s + 1, e), { heads });
  const find = (n, from) => {
    const re = new RegExp(`^\\s*${numberPattern(n)}\\s*\\.\\s+(?=\\S)(.*)$`);
    for (let i = from; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (m && m[1].trim().split(/\s+/).length >= 2 && !/^\d/.test(m[1].trim())) return i;
    }
    return -1;
  };
  // A section number the OCR mangled beyond recognition ("5." read as "!)•") is found as the last paragraph opening
  // with a letterless token between its neighbours.
  const GARBLED = /^\s*[^A-Za-z\s‘'"“(]{1,4}\s+[A-Z‘“]/;
  const marks = [];
  let from = 0;
  for (let n = 1; n <= count; n++) {
    let at = find(n, from);
    const next = n < count ? find(n + 1, from) : -1;
    if (at < 0 || (next >= 0 && at > next)) {
      at = -1;
      const lim = next >= 0 ? next : lines.length;
      for (let i = from; i < lim; i++) if (GARBLED.test(lines[i]) && (i === 0 || !lines[i - 1].trim() || !/[a-z,;]$/.test(lines[i - 1].trim()))) at = i;
    }
    if (at < 0) throw new Error(`section ${n} not found after line ${from}`);
    marks.push(at);
    from = at + 1;
  }
  const out = [];
  for (let k = 0; k < marks.length; k++) {
    const body = lines.slice(marks[k], k + 1 < marks.length ? marks[k + 1] : lines.length);
    body[0] = body[0].replace(new RegExp(`^\\s*${numberPattern(k + 1)}\\s*\\.\\s+`), "").replace(GARBLED, (m) => m.slice(m.search(/[A-Z‘“]\S*$/)));
    const ps = paragraphs(body);
    // drop a trailing editorial heading (it introduces the next section)
    while (ps.length > 1 && !/[.!?’”'")\]]$/.test(ps.at(-1))) ps.pop();
    out.push(ps.join("\n"));
  }
  return out;
}
