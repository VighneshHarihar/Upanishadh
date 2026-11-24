"use client";
// The script the Sanskrit is read in: Devanagari (as printed), IAST (the corpus romanisation), or one of seven
// regional scripts made by a deterministic table (src/components/reader/translit.ts, loaded only when chosen).
// Kept in this browser; mirrored on <html data-script> so CSS can follow it before React hydrates.
import { useSyncExternalStore } from "react";

export const SCRIPTS = [
  { id: "deva", label: "Devanagari", native: "देवनागरी", lang: "sa-Deva" },
  { id: "iast", label: "IAST", native: "", lang: "sa-Latn" },
  { id: "beng", label: "Bengali", native: "বাংলা", lang: "sa-Beng" },
  { id: "orya", label: "Odia", native: "ଓଡ଼ିଆ", lang: "sa-Orya" },
  { id: "taml", label: "Tamil", native: "தமிழ்", lang: "sa-Taml" },
  { id: "telu", label: "Telugu", native: "తెలుగు", lang: "sa-Telu" },
  { id: "knda", label: "Kannada", native: "ಕನ್ನಡ", lang: "sa-Knda" },
  { id: "mlym", label: "Malayalam", native: "മലയാളം", lang: "sa-Mlym" },
  { id: "gujr", label: "Gujarati", native: "ગુજરાતી", lang: "sa-Gujr" },
] as const;
export type ScriptId = (typeof SCRIPTS)[number]["id"];
export type RegionalScript = Exclude<ScriptId, "deva" | "iast">;

const KEY = "upasarathi:script";
const IDS = new Set<string>(SCRIPTS.map((s) => s.id));
export const scriptInfo = (id: ScriptId) => SCRIPTS.find((s) => s.id === id) ?? SCRIPTS[0];
export const isRegional = (id: ScriptId): id is RegionalScript => id !== "deva" && id !== "iast";

/** Before first paint: <html data-script> from storage, so the block can wait for its script instead of flashing. */
export const SCRIPT_BOOT = `try{var s=localStorage.getItem("${KEY}");if(s)document.documentElement.dataset.script=s}catch(e){}`;

let current: ScriptId | null = null;
const listeners = new Set<() => void>();

function read(): ScriptId {
  if (typeof window === "undefined") return "deva";
  if (current) return current;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage unavailable: Devanagari */
  }
  current = saved && IDS.has(saved) ? (saved as ScriptId) : "deva";
  return current;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Another tab changed it: follow.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = null;
    document.documentElement.dataset.script = read();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setScript(id: ScriptId) {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode: this page only */
  }
  document.documentElement.dataset.script = id;
  listeners.forEach((l) => l());
}

export const useScript = (): ScriptId => useSyncExternalStore(subscribe, read, () => "deva");

const noop = () => () => {};
/** False during server render and hydration, true afterwards (and on any client-only mount). */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);
