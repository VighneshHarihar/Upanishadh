"use client";
// App-wide overlays: model settings and the command palette can be opened from anywhere.
import { useSyncExternalStore } from "react";

interface UiState {
  settings: boolean;
  palette: boolean;
}
let state: UiState = { settings: false, palette: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<UiState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useUi = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
export const ui = {
  openSettings: () => set({ settings: true }),
  closeSettings: () => set({ settings: false }),
  openPalette: () => set({ palette: true }),
  closePalette: () => set({ palette: false }),
};
