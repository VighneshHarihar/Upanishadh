// Speech preferences, kept in this browser: which English voice engine (asked once), the browser voice if one was
// picked, the speed, and whether the reader has agreed to the one-time Vāgdhenu download.
import { useSyncExternalStore } from "react";
import { PIPER, PIPER_RUNTIME, SPEEDS, type Speed } from "./config";

export type Engine = "piper" | "browser";
export interface TtsPrefs {
  engine: Engine | null;
  /** voiceURI of the browser voice picked in the dock; null = the best-ranked one. */
  browserVoice: string | null;
  speed: Speed;
  chantOk: boolean;
}
const KEY = "upasarathi:tts";
const DEFAULTS: TtsPrefs = { engine: null, browserVoice: null, speed: 1, chantOk: false };

function read(): TtsPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<TtsPrefs> & { engine?: string };
    return {
      // "kokoro" (the earlier voice) is asked again: Piper is a different download.
      engine: raw.engine === "piper" || raw.engine === "browser" ? raw.engine : null,
      browserVoice: typeof raw.browserVoice === "string" ? raw.browserVoice : null,
      speed: SPEEDS.includes(raw.speed as Speed) ? (raw.speed as Speed) : DEFAULTS.speed,
      chantOk: raw.chantOk === true,
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs: TtsPrefs | null = null;
const listeners = new Set<() => void>();
export const getPrefs = (): TtsPrefs => (prefs ||= typeof window === "undefined" ? DEFAULTS : read());
export function setPrefs(patch: Partial<TtsPrefs>) {
  prefs = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
  listeners.forEach((l) => l());
}
export const usePrefs = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
    () => DEFAULTS,
  );

/** Phones and small-memory devices are better served by the browser's own voice than by a 94 MB model. */
export function lowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return (mem !== undefined && mem <= 2) || (mobile && (mem === undefined || mem < 4));
}

/** Is a file already in one of the browser's Cache API buckets (so no download is needed)? */
export async function inCache(cacheName: string, urls: readonly string[]): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const c = await caches.open(cacheName);
    for (const u of urls) if (await c.match(u)) return true;
  } catch {}
  return false;
}

/** Is the Piper voice, with its runtimes, already stored whole in this browser's private file system? */
export async function piperStored(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    const size = async (dir: string, file: string) => (await (await (await root.getDirectoryHandle(dir)).getFileHandle(file)).getFile()).size;
    if ((await size(PIPER.opfs.voiceDir, PIPER.opfs.voiceFile)) !== PIPER.bytes.model) return false;
    for (const f of PIPER_RUNTIME) if ((await size(PIPER.opfs.runtimeDir, f.file)) !== f.bytes) return false;
    return true;
  } catch {
    return false;
  }
}
