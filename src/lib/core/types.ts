// Shared domain types. This folder (src/lib/core) is framework-free and uses erasable TypeScript only, so the
// Next app, the Node scripts (node strips the types) and the tests all run the same code.

export type NodeType = "Upanishad" | "Verse" | "Concept" | "Dilemma" | "Axis" | "Story" | "Person" | "External" | "Veda" | "Stem";
export type Rel =
  | "PART_OF"
  | "NEXT"
  | "IN_STORY"
  | "TEACHES"
  | "CONTRASTS_WITH"
  | "DIAGNOSES"
  | "CROSS_REFERENCES"
  | "GROUNDS"
  /** Upanishad → the Veda it belongs to (the Veda-Sāra lineage). */
  | "DISTILLS"
  /** Mantra → the Saṃhitā mantra it takes up (checked against VedAnvaya's text). */
  | "ROOTED_IN"
  /** Mantra → a Brahma Sūtra topic that reads it (Śaṅkara's adhikaraṇa). */
  | "READ_BY"
  /** Mantra → another mantra Śaṅkara cites while commenting on it. */
  | "CITES"
  /** Mantra → a key Sanskrit stem that occurs in it (from the word analysis). */
  | "HAS_STEM";
/** Who asserts an edge: the text's own structure, Śaṅkara, this project's editors, or a model (never shipped unreviewed). */
export type Basis = "text" | "shankara" | "editorial" | "model";

export interface GNode {
  id: string;
  type: NodeType;
  label: string;
  sub?: string;
  /** Upanishad id for verses and texts. */
  up?: string;
  ref?: string;
  url?: string;
}
export interface GEdge {
  s: string;
  t: string;
  type: Rel;
  basis: Basis;
  why?: string;
  reviewed?: boolean;
  role?: "names" | "remedies";
  kind?: "identical" | "parallel" | "echo";
  verse?: string;
}
export interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  layout: Record<string, [number, number]>;
  /** Precomputed 3D positions (build time, deterministic): the cosmos. */
  layout3d?: Record<string, [number, number, number]>;
}

export interface TextMeta {
  id: string;
  abbrev: string;
  sa: string;
  iast: string;
  en: string;
  veda: string;
  levels: string[];
  scope: "complete" | "excerpts";
  order: number;
  tagline: string;
  count: number;
  translators: string[];
  aliases: string[];
  audio: { whole: string; durationSec: number; chanter: string | null } | null;
  bhashya: { translator: string; edition: string } | null;
  /** "partial" when some passages have Sanskrit and IAST but no English yet (stated on the page and in /about). */
  translation?: "complete" | "partial";
  /** Veda-Sāra lineage: which Veda, school and Brāhmaṇa or Āraṇyaka this Upanishad closes. */
  lineage?: { veda: string; vedaLabel: string; section?: string; sectionLabel?: string; school: string; seat: string; kind: string };
  /** Passages with a word-by-word analysis. */
  analysed?: number;
  /** Passages with Śaṅkara's commentary. */
  commented?: number;
}
/** One analysed word: [Devanagari, IAST, short gloss, lemma key]. */
export type Word = [string, string, string, string];

export interface Translation {
  text: string;
  by: string;
  source: string;
  cite?: string;
  /** Set when the translator rendered several mantras together, e.g. "6.1.2–3". */
  joint?: string;
  /** Read from an archive.org scan (OCR, cleaned), e.g. Hume's Maitrī. */
  ocr?: boolean;
}
export interface Verse {
  id: string;
  ref: string;
  up: string;
  order: number;
  section: string;
  sa: string[];
  iast: string[];
  tr: Translation | null;
  alt: Translation[];
  audio: { mp3: string; whole: [number, number] } | null;
  hasBhashya: boolean;
  /** Word-by-word analysis where the source provides one. */
  words?: Word[];
  /** The peace invocation chanted before the text (passage "0"). */
  shanti?: boolean;
  /** A plain-English takeaway, clearly labelled as editorial. */
  takeaway?: string;
}
export interface Bhashya {
  /** "Śaṅkara", or "Śaṅkara (attributed)" where the authorship is disputed (Śvetāśvatara). */
  author: string;
  lang: string;
  translator: string;
  edition: string;
  text: string;
  source: string;
  /** Read from an archive.org scan (OCR, cleaned): may carry scanning errors. */
  ocr?: boolean;
  /** One commentary covering several mantras ("6.8.1–3"). */
  joint?: string;
  note?: string;
  verifiedBy?: string;
}

export interface Concept {
  id: string;
  sa: string;
  iast: string;
  en: string;
  category: string;
  desc: string;
  teaches: { verse: string; why: string }[];
  contrasts: { with: string; verse: string; why: string }[];
}
export interface Dilemma {
  id: string;
  en: string;
  desc: string;
  preyas: string;
  shreyas: string;
  cues: string[];
  pressures: string[];
  concepts: string[];
  external?: string[];
  verses: { verse: string; role: "names" | "remedies"; why: string }[];
}
export interface Person {
  id: string;
  sa: string;
  iast: string;
  role: string;
}
export interface Story {
  id: string;
  title: string;
  summary: string;
  cast: string[];
  verses: string[];
}
export interface PathStep {
  node: string;
  kind: "read" | "contrast" | "story" | "reflect";
  title: string;
  note: string;
  prompt: string;
}
export interface LearningPath {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  intro: string;
  steps: PathStep[];
}

export interface Axis {
  id: string;
  label: string;
  en: string;
  sa: string;
  question: string;
  grounds: string[];
  levels: string[];
}
export interface Preset {
  id: string;
  title: string;
  prompt: string;
  pressure: string[];
  expectDilemma: string;
  hook: string;
  control?: boolean;
  sharpened?: boolean;
  /** Multi-turn presets: the pushback sent after the first answer. */
  followUp?: string;
}
export interface Rubric {
  version: number;
  baselineSystem: string;
  /** The honesty control: a strong generic prompt with no scripture (the ablation). */
  controlSystem: string;
  defaults: { provider: string; model: string; judgeModel: string };
  axes: Axis[];
  realignSystem: string;
  judgeSystem: string;
  judgeTemplate: string;
  pressures: { id: string; label: string; cues: string[] }[];
  checks: { flatteryOpener: string; flatteryPhrase: string; engagementBait: string };
  presets: Preset[];
}

/** Compact verse record used by retrieval, quote checks and the citation drawer. */
export interface VerseLite {
  id: string;
  up: string;
  ref: string;
  section: string;
  sa: string;
  iast: string;
  tr: string;
  trBy: string;
  audio: string | null;
  hasBhashya: boolean;
  shanti?: boolean;
}
export interface GlossaryTerm {
  id: string;
  term: string;
  sa: string;
  /** One plain-English sentence. */
  short: string;
  /** Other spellings that should also show the tooltip. */
  forms: string[];
  concept?: string;
}
export interface VedaInfo {
  id: string;
  label: string;
  sa: string;
  essence: string;
  vedanvaya: string | null;
  /** The Yajurveda's two sections (Śukla and Kṛṣṇa): one Veda, two recensions. */
  sections?: { id: string; label: string; en: string; sa: string; note: string }[];
}
/** The index: everything except the passages themselves (public/data/index.json, small, loaded up front). */
export interface KbIndex {
  texts: TextMeta[];
  /** [id, up, ref] for every passage, so a citation resolves without loading the text. */
  verseIds: [string, string, string][];
  concepts: Concept[];
  dilemmas: Dilemma[];
  stories: Story[];
  persons: Person[];
  external: Record<string, { label: string; url: string | null; corpus: string; title?: string; site?: string | null; path?: string | null }>;
  vedas: VedaInfo[];
  glossary: GlossaryTerm[];
}
/** Everything the browser-side engine needs: the index plus every passage (assembled from per-text files). */
export interface KnowledgeBase extends Omit<KbIndex, "verseIds"> {
  verses: VerseLite[];
}

export interface Facts {
  texts: { complete: number; excerpts: number; total: number };
  mantras: { complete: number; excerpts: number; total: number };
  shanti: number;
  bhashyaVerses: number;
  audioVerses: number;
  translatedVerses: number;
  analysedVerses: number;
  concepts: number;
  dilemmas: number;
  stories: number;
  persons: number;
  paths: number;
  axes: number;
  presets: number;
  nodes: number;
  edges: number;
  semanticEdges: number;
  shankaraLinks: number;
  vedaSaraLinks: number;
  stems: number;
  lemmas: number;
  glossary: number;
  anchors: number;
  crossCorpus: number;
  runs: number;
  corpusHash: string;
}
