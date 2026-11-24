"use client";
// The theme lives on <html data-theme> (set before first paint by the boot script); this hook follows it.
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const read = (): Theme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => mo.disconnect();
    },
    read,
    () => "dark",
  );
}

export function toggleTheme() {
  const next: Theme = read() === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("upasarathi:theme", next);
  } catch {
    /* storage unavailable */
  }
}
