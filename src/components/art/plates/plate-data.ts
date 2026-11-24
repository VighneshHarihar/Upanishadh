// Text for the Living Plates, read from the corpus (public/data) on the server: translations trimmed to their
// opening, a sentence or two of Śaṅkara chosen where the commentary reads cleanly (the Taittirīya commentary is OCR,
// so its scanning errors are mended inline). Server-only: it reads the data files from disk.
import { getBhashya, getCorpus } from "@/lib/server/data";
import { excerpt, excerpts, segment, sentences, trimTr, type Cut } from "./excerpt";
import type { ChariotData, ChariotPart, LidData, PlateVerse, SheathData, SheathsData, StateData, StatesData } from "./types";

export type Kind = "chariot" | "lid" | "sheaths" | "states";

const KAU = ["1.3.3", "1.3.4", "1.3.5", "1.3.6", "1.3.7", "1.3.8", "1.3.9"];
const VERSES: Record<Kind, string[]> = {
  chariot: KAU.map((r) => `KaU_${r}`),
  lid: ["IU_15"],
  sheaths: ["TU_2.1", "TU_2.2", "TU_2.3", "TU_2.4", "TU_2.5"],
  states: ["MaU_3", "MaU_4", "MaU_5", "MaU_6", "MaU_7"],
};
/** Guided paths that carry a plate (paths added later light up by id). */
export const PATHS: Record<string, Kind> = { chariot: "chariot", satya: "lid", sheaths: "sheaths", "four-states": "states" };

/** Which plate, if any, belongs with a passage. */
export function plateKind(verseId: string): Kind | null {
  return (Object.keys(VERSES) as Kind[]).find((k) => VERSES[k].includes(verseId)) ?? null;
}

const ABBREV: Record<string, string> = { katha: "KaU", isha: "IU", taittiriya: "TU", mandukya: "MaU" };

function verse(up: string, id: string, gloss?: Cut[], max = 230): PlateVerse | null {
  const v = getCorpus(up).find((x) => x.id === id);
  if (!v) return null;
  return {
    id,
    ref: v.ref,
    label: `${ABBREV[up]} ${v.ref}`,
    href: `/u/${up}/${v.ref}`,
    sa: v.sa,
    iast: v.iast,
    tr: trimTr(v.tr?.text, max),
    by: v.tr?.by ?? null,
    gloss: gloss ? excerpts(getBhashya(up)[id]?.text, gloss) : null,
  };
}
function glossBy(up: string, id: string): string {
  const b = getBhashya(up)[id];
  return b ? `${b.author.startsWith("Śaṅkara") ? "Śaṅkara" : b.author}, tr. ${b.translator}` : "Śaṅkara";
}

// ── I · the chariot ───────────────────────────────────────────────────────────────────────────────────────────
const CHARIOT_GLOSS: Record<string, Cut[]> = {
  "1.3.5": [{ from: "the senses which stand in the place of the horses", to: "other driver." }],
  "1.3.6": [{ from: "the senses standing in the place of the horses", to: "other driver." }],
  "1.3.9": [{ from: "the knowing man reaches the end of the road", to: "ties of Samsara." }],
};
const PART_GLOSS: Record<ChariotPart, [string, Cut]> = {
  atman: ["KaU_1.3.3", { from: "Know the atman, who is the enjoyer", to: "lord of the chariot." }],
  sarira: ["KaU_1.3.3", { from: "Know the body to be verily the chariot", to: "place of horses." }],
  buddhi: ["KaU_1.3.3", { from: "Know also the intelligence to be the driver", to: "guided by the driver;" }],
  manas: ["KaU_1.3.3", { from: "Know the mind with its characteristics", to: "horses by the reins." }],
  indriya: ["KaU_1.3.4", { from: "Those who are versed in the construction of chariots", to: "drawing the body." }],
  visaya: ["KaU_1.3.4", { from: "Know the objects (such as form, etc.)", to: "to be the roads." }],
  padam: ["KaU_1.3.9", { from: "The man of knowledge attains", to: "(the Self-luminous)." }],
};
export function chariot(): ChariotData | null {
  const verses: Record<string, PlateVerse> = {};
  for (const r of KAU) {
    const v = verse("katha", `KaU_${r}`, CHARIOT_GLOSS[r]);
    if (v) verses[r] = v;
  }
  if (!verses["1.3.3"] || !verses["1.3.5"] || !verses["1.3.6"]) return null;
  const b = getBhashya("katha");
  const parts: ChariotData["parts"] = {};
  for (const [k, [id, cut]] of Object.entries(PART_GLOSS) as [ChariotPart, [string, Cut]][]) {
    const g = excerpt(b[id]?.text, cut);
    if (g) parts[k] = g;
  }
  return { verses, parts, glossBy: glossBy("katha", "KaU_1.3.3") };
}

// ── II · the golden lid ───────────────────────────────────────────────────────────────────────────────────────
export function lid(): LidData | null {
  const v = verse("isha", "IU_15", [{ from: /‘Hira[nṇ]maya’ means/, to: "forming a cover.", fix: [["Hiranmaya", "Hiraṇmaya"], ["Patrena", "Pātreṇa"]] }], 1000);
  if (!v) return null;
  // The translator's explanatory aside ("ie., Purusha in the solar orb") is left out of the plate.
  const [veiled, prayer] = sentences((v.tr ?? "").replace(/\s*\((?:ie|i\.e)\.?,?[^)]*\)/gi, ""));
  return { verse: v, veiled: veiled ?? null, prayer: prayer ?? null, glossBy: glossBy("isha", "IU_15") };
}

// ── III · the five sheaths ────────────────────────────────────────────────────────────────────────────────────
const SHEATHS: (Omit<SheathData, "ref" | "label" | "href" | "sa" | "iast" | "gloss"> & { id: string; saWord: string; iaWord: string; cuts: Cut[] })[] = [
  {
    key: "anna", id: "TU_2.1", name: "Annamaya", deva: "अन्नमय", en: "the self made of food", saWord: "न्नरसमयः", iaWord: "nnarasamayaḥ",
    cuts: [{ from: /annarasamaya[hḥ], consists/, to: "food substance.", fix: [["annarasamayah", "annarasamayaḥ"]] }],
  },
  {
    key: "prana", id: "TU_2.2", name: "Prāṇamaya", deva: "प्राणमय", en: "the self made of vital breath", saWord: "प्राणमयः", iaWord: "prāṇamayaḥ",
    cuts: [{ from: /pr[aā][nṇ]a is air \(vital force\)/, to: "predominantly of air.", fix: [["pranamaya", "prāṇamaya"], ["prana is", "prāṇa is"]] }],
  },
  {
    key: "manas", id: "TU_2.3", name: "Manomaya", deva: "मनोमय", en: "the self made of mind", saWord: "मनोमयः", iaWord: "manomayaḥ",
    cuts: [{ from: /Mana[hḥ] means the internal organ/, to: "volition etc.", fix: [["Manah ", "Manaḥ "]] }, { from: "It is the inner self of the vital body." }],
  },
  {
    key: "vijnana", id: "TU_2.4", name: "Vijñānamaya", deva: "विज्ञानमय", en: "the self made of understanding", saWord: "विज्ञानमयः", iaWord: "vijñānamayaḥ",
    cuts: [{ from: /Vij[hñn][aā]namaya is the self/, to: "authoritative by nature.", fix: [["Vijhanamaya", "Vijñānamaya"], ["Vijnanamaya", "Vijñānamaya"], ["vijnana", "vijñāna"], ["wellascertained", "well-ascertained"]] }],
  },
  {
    key: "ananda", id: "TU_2.5", name: "Ānandamaya", deva: "आनन्दमय", en: "the self made of bliss", saWord: "नन्दमयः", iaWord: "nandamayaḥ",
    cuts: [{ from: /So the [dāa]nandamaya/, to: "the supreme Self.", fix: [["dnandamaya", "ānandamaya"], [" atma ", " ātmā "]] }],
  },
];
export function sheaths(): SheathsData | null {
  const corpus = getCorpus("taittiriya");
  const b = getBhashya("taittiriya");
  const out: SheathData[] = [];
  for (const s of SHEATHS) {
    const v = corpus.find((x) => x.id === s.id);
    if (!v) return null;
    out.push({
      key: s.key,
      name: s.name,
      deva: s.deva,
      en: s.en,
      ref: v.ref,
      label: `TU ${v.ref}`,
      href: `/u/taittiriya/${v.ref}`,
      sa: segment(v.sa, s.saWord) ?? v.sa[0],
      iast: segment(v.iast, s.iaWord) ?? v.iast[0],
      gloss: excerpts(b[s.id]?.text, s.cuts),
    });
  }
  const centre = excerpt(b["TU_2.2"]?.text, { from: "Brahman is the inmost of all the selves", to: "the blissful one." });
  return { sheaths: out, centre, glossBy: glossBy("taittiriya", "TU_2.1") };
}

// ── IV · the four states ──────────────────────────────────────────────────────────────────────────────────────
const STATES: (Omit<StateData, "verse"> & { id: string; cuts: Cut[] })[] = [
  { key: "jagrat", id: "MaU_3", name: "Jāgrat", en: "waking", letter: "अ", knower: "Vaiśvānara", cuts: [{ from: "The meaning is that consciousness appears", to: "on account of Avidyā." }] },
  { key: "svapna", id: "MaU_4", name: "Svapna", en: "dream", letter: "उ", knower: "Taijasa", cuts: [{ from: "He (the Taijasa) is called the Antaḥprajña", to: "previous waking state." }] },
  { key: "susupti", id: "MaU_5", name: "Suṣupti", en: "deep sleep", letter: "म", knower: "Prājña", cuts: [{ from: "As at night, owing to the indiscrimination", to: "become a mass (of consciousness)." }] },
  { key: "turiya", id: "MaU_7", name: "Turīya", en: "the Fourth", letter: "", knower: "", cuts: [{ from: "As the nature of the rope is", to: "three states, as Turīya." }] },
];
export function states(): StatesData | null {
  const out: StateData[] = [];
  for (const { id, cuts, ...s } of STATES) {
    const v = verse("mandukya", id, cuts);
    if (!v) return null;
    out.push({ ...s, verse: v });
  }
  const lord = verse("mandukya", "MaU_6", [{ from: "He is the Antaryāmin", to: "everything from within." }]);
  if (!lord) return null;
  return { states: out, lord, lettersHref: "/u/mandukya/9", glossBy: glossBy("mandukya", "MaU_3") };
}
