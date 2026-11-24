"use client";
// Bring-your-own-key settings, kept in this browser only (localStorage). Keys are sent per request to /api/llm,
// which relays them to the provider and stores nothing.
import { useSyncExternalStore } from "react";
import { PROVIDERS, needsKey, type ProviderId } from "@/lib/core/llm";

export interface Settings {
  provider: ProviderId;
  model: string;
  judgeProvider: ProviderId;
  judgeModel: string;
  keys: Partial<Record<ProviderId, string>>;
  ollamaBaseUrl: string;
  compatibleBaseUrl: string;
}
const KEY = "upasarathi:settings";
const DEFAULTS: Settings = {
  provider: "anthropic",
  model: PROVIDERS.anthropic.defaultModel,
  judgeProvider: "anthropic",
  judgeModel: PROVIDERS.anthropic.defaultJudge,
  keys: {},
  ollamaBaseUrl: "http://localhost:11434",
  compatibleBaseUrl: "",
};

let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Settings {
  if (loaded || typeof window === "undefined") return current;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      current = { ...DEFAULTS, ...saved };
      if (!(current.provider in PROVIDERS)) current = { ...current, provider: DEFAULTS.provider, model: DEFAULTS.model };
      if (!(current.judgeProvider in PROVIDERS)) current = { ...current, judgeProvider: current.provider };
    }
  } catch {
    /* storage unavailable: defaults */
  }
  return current;
}

export function getSettings(): Settings {
  return load();
}
export function saveSettings(next: Partial<Settings>) {
  current = { ...load(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}
export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => DEFAULTS,
  );
}
export const hasKey = (s: Settings, p: ProviderId = s.provider) => !needsKey(p) || Boolean(s.keys[p]);
export const baseUrlFor = (s: Settings, p: ProviderId) => (p === "ollama" ? s.ollamaBaseUrl : p === "compatible" ? s.compatibleBaseUrl : undefined);
