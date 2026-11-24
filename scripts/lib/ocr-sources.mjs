// Printed translations read from archive.org OCR (djvu.txt), for the commentary and translations that no clean
// digital edition carries. Each entry names the scan, where the text sits in it and how it is laid out; the parsing
// lives in ocr-book.mjs. Downloads are cached in .cache/archive/ like every other source.

const AIU_HEADS = [String.raw`EIGHT\s+UPANI[S8$]ADS?`, String.raw`AITAREYA\s+UPANI[S8$]AD`];
const TU_HEADS = [String.raw`EIGHT\s+UPANI[S8$]ADS?`, String.raw`TAITTIRI?YA\s+UPANI[S8$]AD`];

export const OCR_SOURCES = {
  // Śaṅkara's commentary, Swami Gambhīrānanda's translation (Eight Upaniṣads, vol. 2, Advaita Ashrama)
  "gambhirananda-aitareya": {
    item: "EightUpanishadsVol.2BySwamiGambhirananda",
    file: "Eight Upanishads Vol. 2 by Swami Gambhirananda_djvu.txt",
    cache: "gambhirananda-8u-v2.txt",
    kind: "commentary",
    spec: {
      start: /^\s*PART\s+I\s*$/,
      end: /^\s*MU[NṆ]DAKA\s+UPANI/i,
      heads: AIU_HEADS,
      units: [
        { ref: "1.1", at: /^CHAPTER\s+I$/, count: 4 },
        { ref: "1.2", at: /^CHAPTER\s+II$/, count: 5 },
        { ref: "1.3", at: /^CHAPTER\s+III$/, count: 14 },
        { ref: "2.1", at: /^PART\s+(II|11|Il|lI)$/, count: 6 },
        { ref: "3.1", at: /^CHAPTER\s+I$/, count: 4 },
      ],
    },
  },
  // Śaṅkara's commentary, Swami Gambhīrānanda's translation (Eight Upaniṣads, vol. 1): one passage per anuvāka
  "gambhirananda-taittiriya": {
    item: "EightUpanishadsVol.1BySwamiGambhirananda",
    file: "Eight Upanishads Vol. 1 by Swami Gambhirananda_djvu.txt",
    cache: "gambhirananda-8u-v1.txt",
    kind: "commentary",
    spec: {
      start: /^\s*CHAPTER\s+[TI1l]\s*$/, // the first Śīkṣāvallī chapter, read by the OCR as "CHAPTER T"
      startAfter: 9000,
      heads: TU_HEADS,
      units: [
        ...["[TI1l]", "II", "III", "IV", "V", "VI", "VII", "VII\\s*[I1l]", "IX", "X", "XI", "XII"].map((r, i) => ({ ref: `1.${i + 1}`, at: new RegExp(`^CHAPTER\\s+${r}\\s*[\\[F]?$`), whole: true })),
        ...["I", "II", "III", "IV", "V", "VI", "VII", "VI\\s*I\\s*\\[?"].map((r, i) => ({ ref: `2.${i + 1}`, at: new RegExp(`^CHAPTER\\s+${r}\\s*[\\[F]?$`), whole: true })),
        // the scan has no heading for Brahmavallī IX: it begins at its first verse
        { ref: "2.9", at: /^1\.\s+The enlightened man is not afraid/, whole: true, inclusive: true },
        ...["I", "II", "III", "IV", "V", "VI", "VI\\s*[IF]", "VIII", "IX", "X"].map((r, i) => ({ ref: `3.${i + 1}`, at: new RegExp(`^CHAPTER\\s+${r}\\s*[\\[F]?$`), whole: true })),
      ],
      end: /^\s*(INDEX|APPENDIX|KATHA\s+UPANI)/i,
    },
  },
  // The commentary traditionally attributed to Śaṅkara, Swami Gambhīrānanda's translation (Advaita Ashrama)
  "gambhirananda-shvetashvatara": {
    item: "svetasvatara-upanishad-swami-gambhirananda",
    file: "Svetasvatara Upanishad Swami Gambhirananda_djvu.txt",
    cache: "gambhirananda-svu.txt",
    kind: "commentary",
    spec: {
      start: /^\s*CHAPTER\s+1\s*$/,
      end: /^\s*INDEX\b/,
      heads: [String.raw`[SŚ]VET[AĀ][SŚ]VATARA\s+UPANI[S8$]AD`],
      units: [16, 17, 21, 22, 14, 23].map((count, i) => ({ ref: String(i + 1), at: new RegExp(`^CHAPTER\\s+${i + 1}$`), count })),
    },
  },
  // R. E. Hume (1921), single passages the other translations leave out, cut from the scan between two phrases
  "hume-excerpts": {
    item: "thirteenprincipa00hume",
    file: "thirteenprincipa00hume_djvu.txt",
    cache: "hume-1921.txt",
    kind: "excerpts",
    heads: [String.raw`CHANDOGYA\s+UPANISHAD`, String.raw`KAUSHITAKI\s+UPANISHAD`],
    fixes: [
      [/\beithgr\b/g, "either"],
      [/\[8\]\s*/g, ""],
      // Hume's italic side-headings, merged into the text by the scan
      [/Their unity in the conscious self\s*/, ""],
      [/A person's ethical irresponsibility, his very self being identical with the world-all\s*/, ""],
      [/\s3-H\s/, " "],
      [/‘fie is/, "‘He is"],
      [/world-protector He/, "world-protector. He"],
      [/worldsovereign He/, "world-sovereign. He"],
      [/\(prajnd-mdtra\)/, "(prajñā-mātra)"],
      [/\(bhiiyas\)/, "(bhūyas)"],
      [/\(atinan\)/, "(ātman)"],
    ],
    excerpts: [
      // ChU 3.13.8: the light within, seen by touch and heard when the ears are closed
      { key: "ChU 3.13.8", start: /^There\s+is\s+this\s+seeing\s+of\s+it/, end: /^Fourteenth\s+Khanda/, startAfter: 12000 },
      // KauU 3.9 (Wikisource numbering; Hume 3.8, from “from either alone no appearance…” to the end of the adhyāya)
      { key: "KauU 3.9", start: /^were\s+no\s+elements\s+of\s+intelligence/, end: /^FOURTH\s+ADHYAYA/, startAfter: 19800, from: "For truly, from" },
    ],
  },
  // R. E. Hume, The Thirteen Principal Upanishads (1921): the Maitrī sections the 108 Upanishads text leaves out
  "hume-maitri": {
    item: "thirteenprincipa00hume",
    file: "thirteenprincipa00hume_djvu.txt",
    cache: "hume-1921.txt",
    kind: "translation",
    startAfter: 25500,
    chapters: [
      // Prapāṭhaka 5: Kutsāyana's hymn (5.1) and the differentiation through the guṇas (5.2); the Wikisource text we
      // follow labels these passages 5.12–5.15 and 5.5, mapped in data/corpus/maitri/meta.json
      { ch: "5", start: /^FIFTH\s+PRAPATHAKA/, end: /^SIXTH\s+PRAPATHAKA/, count: 2 },
      { ch: "6", start: /^SIXTH\s+PRAPATHAKA/, end: /^SEVENTH\s+PRAPATHAKA/, count: 38 },
      { ch: "7", start: /^SEVENTH\s+PRAPATHAKA/, end: /^A\s+BIBLIOGRAPHY|^BIBLIOGRAPHY/, count: 11 },
    ],
    heads: [String.raw`MAITRI\s+UPANISHAD`],
  },
};
