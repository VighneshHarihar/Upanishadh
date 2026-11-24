// Props for the Living Plates. Everything textual comes from the corpus (public/data), assembled on the server by
// LivingPlate.tsx; the plates themselves hold only geometry and short editorial labels.

/** One passage as a plate needs it. */
export interface PlateVerse {
  id: string;
  ref: string;
  /** "KaU 1.3.3" */
  label: string;
  /** "/u/katha/1.3.3" */
  href: string;
  sa: string[];
  iast: string[];
  /** The translation (may be trimmed with an ellipsis), and its translator. */
  tr: string | null;
  by: string | null;
  /** A sentence or two of Śaṅkara’s commentary on this passage, if a clean one exists. */
  gloss: string | null;
}

export interface GlossSource {
  /** "Śaṅkara, tr. S. Sitarama Sastri" */
  by: string;
}

export type ChariotPart = "atman" | "buddhi" | "manas" | "sarira" | "indriya" | "visaya" | "padam";

export interface ChariotData {
  /** Keyed by ref: 1.3.3 … 1.3.9. */
  verses: Record<string, PlateVerse>;
  /** A gloss per part of the chariot (from Śaṅkara on 1.3.3, 1.3.4 and 1.3.9). */
  parts: Partial<Record<ChariotPart, string>>;
  glossBy: string;
}

export interface LidData {
  verse: PlateVerse;
  /** The English of the first line alone (the veiling), and of the second (the prayer to unveil). */
  veiled: string | null;
  prayer: string | null;
  glossBy: string;
}

export interface SheathData {
  key: "anna" | "prana" | "manas" | "vijnana" | "ananda";
  name: string;
  deva: string;
  en: string;
  ref: string;
  label: string;
  href: string;
  /** The line of the passage that names this sheath. */
  sa: string;
  iast: string;
  gloss: string | null;
}
export interface SheathsData {
  sheaths: SheathData[];
  /** Śaṅkara on Brahman at the centre of the five. */
  centre: string | null;
  glossBy: string;
}

export interface StateData {
  key: "jagrat" | "svapna" | "susupti" | "turiya";
  name: string;
  en: string;
  /** The letter of Oṃ (MaU 9–11); empty for the Fourth, which has none (MaU 12). */
  letter: string;
  knower: string;
  verse: PlateVerse;
}
export interface StatesData {
  states: StateData[];
  /** MaU 6, the Lord of all, read with deep sleep. */
  lord: PlateVerse;
  /** Where the letters are assigned (MaU 9). */
  lettersHref: string;
  glossBy: string;
}

export interface PlateCommon {
  /** The verse being read, if the plate sits on a mantra page: sets the starting state. */
  focus?: string;
  /** Heading level of the plate title within the page. */
  level?: 2 | 3;
}
