"use client";
// Local-first personal data: bookmarks, notes and reading progress, kept in this browser only (no account).
import { useSyncExternalStore } from "react";

export interface Personal {
  bookmarks: string[];
  notes: Record<string, { text: string; at: string }>;
  /** Per Upanishad: the last passage opened and every passage read. */
  progress: Record<string, { last: string; read: string[]; at: string }>;
}
const KEY = "upasarathi:personal";
const EMPTY: Personal = { bookmarks: [], notes: {}, progress: {} };
let state: Personal = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Personal {
  if (loaded || typeof window === "undefined") return state;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as Partial<Personal>) };
  } catch {
    /* storage unavailable: keep in memory */
  }
  return state;
}
function save(next: Personal) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: memory only */
  }
  listeners.forEach((l) => l());
}

export function usePersonal(): Personal {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => EMPTY,
  );
}
export const personal = {
  get: load,
  toggleBookmark(id: string) {
    const p = load();
    save({ ...p, bookmarks: p.bookmarks.includes(id) ? p.bookmarks.filter((x) => x !== id) : [id, ...p.bookmarks] });
  },
  setNote(id: string, text: string) {
    const p = load();
    const notes = { ...p.notes };
    if (text.trim()) notes[id] = { text, at: new Date().toISOString() };
    else delete notes[id];
    save({ ...p, notes });
  },
  markRead(up: string, id: string) {
    const p = load();
    const cur = p.progress[up] ?? { last: id, read: [], at: "" };
    if (cur.last === id && cur.read.includes(id)) return;
    save({ ...p, progress: { ...p.progress, [up]: { last: id, read: cur.read.includes(id) ? cur.read : [...cur.read, id], at: new Date().toISOString() } } });
  },
  clear() {
    save(EMPTY);
  },
};
