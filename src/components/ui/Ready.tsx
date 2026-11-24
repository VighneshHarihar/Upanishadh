"use client";
// For static pages: report window.__ready once fonts are loaded, so capture tools never wait in vain.
import { useReady } from "@/lib/client/capture";

export function Ready() {
  useReady(true);
  return null;
}
