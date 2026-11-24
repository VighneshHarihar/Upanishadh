"use client";
// Ask: one conversation shared by every page, plus the subgraph the latest answer is drawn from (the map lights it up).
// The conversation is kept in this browser (localStorage), local-first: no account, nothing stored on a server.
import { useSyncExternalStore } from "react";
import { askRequest, askRetrieve, auditAnswer, composeOfflineAnswer, type AskTurn } from "@/lib/core/ask";
import type { Citation } from "@/lib/core/citations";
import type { GEdge } from "@/lib/core/types";
import { loadEngine } from "./data";
import { browserTransport } from "./transport";
import { getSettings, hasKey } from "./settings";
import { LlmError } from "@/lib/core/llm";

export interface AskMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  pending?: boolean;
  offline?: boolean;
  model?: string;
  error?: string;
  subgraph?: { nodes: string[]; edges: GEdge[] };
  question?: string;
  crisis?: boolean;
}
export interface AskState {
  open: boolean;
  busy: boolean;
  messages: AskMessage[];
  highlight: { label: string; nodes: string[]; edges: GEdge[] } | null;
  draft: string;
}

let state: AskState = { open: false, busy: false, messages: [], highlight: null, draft: "" };
const listeners = new Set<() => void>();
const KEY = "upasarathi:ask";
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (!hydrated || typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const keep = state.messages.filter((m) => !m.pending).slice(-60).map(({ pending: _p, ...m }) => m);
      localStorage.setItem(KEY, JSON.stringify(keep));
    } catch {
      /* storage full or blocked: the conversation stays in memory */
    }
  }, 400);
}
const set = (patch: Partial<AskState>) => {
  state = { ...state, ...patch };
  if (patch.messages) persist();
  listeners.forEach((l) => l());
};
/** Restore the saved conversation once, after hydration (never during server render). */
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as AskMessage[]) : [];
    if (saved.length && !state.messages.length) set({ messages: saved });
  } catch {
    /* ignore a corrupt entry */
  }
}
const update = (id: string, patch: Partial<AskMessage>) => set({ messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });

export const useAsk = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
export const askStore = {
  open: (draft?: string) => set({ open: true, ...(draft !== undefined ? { draft } : {}) }),
  close: () => set({ open: false }),
  toggle: () => set({ open: !state.open }),
  setDraft: (draft: string) => set({ draft }),
  clear: () => set({ messages: [], highlight: null }),
  hydrate,
  clearHighlight: () => set({ highlight: null }),
  showInGraph: (m: AskMessage) => m.subgraph && set({ highlight: { label: m.question ?? "Answer", nodes: m.subgraph.nodes, edges: m.subgraph.edges } }),
  ask,
};

async function ask(question: string) {
  const q = question.trim();
  if (!q || state.busy) return;
  const uid = `u${Date.now()}`;
  const aid = `a${Date.now()}`;
  const history: AskTurn[] = state.messages.filter((m) => !m.pending && !m.error).map((m) => ({ role: m.role, content: m.text, citations: m.citations.map((c) => c.id!).filter(Boolean) }));
  set({
    busy: true,
    open: true,
    draft: "",
    messages: [...state.messages, { id: uid, role: "user", text: q, citations: [] }, { id: aid, role: "assistant", text: "", citations: [], pending: true, question: q }],
  });
  try {
    const { E } = await loadEngine();
    const d = askRetrieve(E, q, history);
    const subgraph = { nodes: d.subgraph.nodes, edges: d.subgraph.edges };
    set({ highlight: d.status === "INSUFFICIENT_EVIDENCE" ? null : { label: q, nodes: subgraph.nodes, edges: subgraph.edges } });
    const s = getSettings();
    if (d.crisis || !hasKey(s) || d.status === "INSUFFICIENT_EVIDENCE") {
      const text = composeOfflineAnswer(E, d);
      const a = auditAnswer(E, text, d);
      update(aid, { text: a.text, citations: a.citations, pending: false, offline: true, subgraph, crisis: d.crisis });
      return;
    }
    const req = askRequest(s.provider, s.model, q, d.packet, history);
    const r = await browserTransport().complete(req, (_d, full) => update(aid, { text: full }));
    const a = auditAnswer(E, r.text, d);
    update(aid, { text: a.text, citations: a.citations, pending: false, model: r.model, subgraph });
  } catch (e) {
    const msg = e instanceof LlmError ? `${e.code === "rate-daily" ? "Daily limit reached" : e.code === "auth" ? "The key was rejected" : e.code === "refusal" ? "The model declined" : "Could not reach the model"}: ${e.message}` : (e as Error).message;
    // Fall back to the graph's own answer so a provider failure never leaves the person with nothing.
    try {
      const { E } = await loadEngine();
      const d = askRetrieve(E, q, history);
      const a = auditAnswer(E, composeOfflineAnswer(E, d), d);
      update(aid, { text: a.text, citations: a.citations, pending: false, offline: true, error: msg, subgraph: { nodes: d.subgraph.nodes, edges: d.subgraph.edges } });
    } catch {
      update(aid, { pending: false, error: msg });
    }
  } finally {
    set({ busy: false });
  }
}
