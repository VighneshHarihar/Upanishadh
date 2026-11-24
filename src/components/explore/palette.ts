// Colours for the cosmos and the map. Kinds of node keep one colour each; in "by text" mode the thirteen Upanishads
// and their mantras take their own hue (grouped in families by the Veda each one closes), so clusters read as places.
import type { NodeType } from "@/lib/core/types";

export const TYPE_HEX: Record<"dark" | "light", Record<NodeType, string>> = {
  dark: { Upanishad: "#f0c674", Verse: "#a3aba5", Concept: "#7fb2f0", Dilemma: "#b9a6f5", Axis: "#9fe0c6", Story: "#eba7c0", Person: "#e4e7e2", External: "#9aa39c", Veda: "#ffd98a", Stem: "#d8c79a" },
  light: { Upanishad: "#9a6514", Verse: "#6d746f", Concept: "#2d6fc2", Dilemma: "#6a54cf", Axis: "#2a6a54", Story: "#b0457a", Person: "#3c423e", External: "#7b827d", Veda: "#8a5a00", Stem: "#6f5a24" },
};

/** Hues by Veda family: Ṛg warm red, Śukla Yajur gold, Kṛṣṇa Yajur ember, Sāma teal-green, Atharva blue-violet. */
export const TEXT_HEX: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    aitareya: "#ef8f8f",
    kaushitaki: "#f5a3a3",
    isha: "#f3cf7a",
    brihadaranyaka: "#e8b85c",
    katha: "#f0956c",
    taittiriya: "#f2b07e",
    shvetashvatara: "#e07a5f",
    maitri: "#f7c59f",
    kena: "#7fd1b0",
    chandogya: "#a5d67c",
    prashna: "#8fb6f5",
    mundaka: "#76aef2",
    mandukya: "#b9a2f7",
  },
  light: {
    aitareya: "#b23b3b",
    kaushitaki: "#c45656",
    isha: "#a4730f",
    brihadaranyaka: "#8f6a12",
    katha: "#b7502a",
    taittiriya: "#a65b22",
    shvetashvatara: "#9c3d22",
    maitri: "#a8662e",
    kena: "#1f7a5a",
    chandogya: "#4d8a22",
    prashna: "#2f5fa8",
    mundaka: "#2f68b8",
    mandukya: "#6447c8",
  },
};
export const VEDA_HEX: Record<"dark" | "light", Record<string, string>> = {
  dark: { rig: "#ef8f8f", yajur: "#f3cf7a", sama: "#8fd6a6", atharva: "#9fa8f7" },
  light: { rig: "#b23b3b", yajur: "#8f6a12", sama: "#2f7a4a", atharva: "#4a52b8" },
};

export const TYPE_LABEL: Record<NodeType, string> = {
  Upanishad: "Upanishads",
  Verse: "Mantras",
  Concept: "Concepts",
  Dilemma: "Human situations",
  Axis: "Alignment axes",
  Story: "Stories",
  Person: "People",
  External: "Saṃhitā, Gītā, Sūtra",
  Veda: "Vedas",
  Stem: "Sanskrit stems",
};
export const TYPE_ORDER: NodeType[] = ["Veda", "Upanishad", "Verse", "Axis", "Concept", "Dilemma", "Story", "Person", "Stem", "External"];

export function nodeColor(n: { type: NodeType; up?: string; id: string }, by: "text" | "type", dark: boolean): string {
  const mode = dark ? "dark" : "light";
  if (n.type === "Veda") return VEDA_HEX[mode][n.id.slice(5)] ?? TYPE_HEX[mode].Veda;
  if (by === "text") {
    const up = n.type === "Upanishad" ? n.id.slice(3) : n.type === "Verse" ? n.up : undefined;
    if (up && TEXT_HEX[mode][up]) return TEXT_HEX[mode][up];
  }
  return TYPE_HEX[mode][n.type];
}
