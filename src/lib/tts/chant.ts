// Vāgdhenu: an AI chant for the passages that have no human recording. The model (about 300 MB) runs in a module
// worker (public/tts/vagdhenu-worker.js), WebGPU where the browser has it and WASM otherwise; it is downloaded once,
// after the reader agrees, and kept in the Cache API. Each passage is chanted hemistich by hemistich and played as it
// is made; the finished recording is kept in IndexedDB, so the next play is instant and goes through the site player.
// Everything synthesized is badged AI_CHANT_BADGE: classical meter, no Vedic svaras.
import { useSyncExternalStore } from "react";
import { claimAudio, player, releaseAudio } from "@/lib/client/player";
import { loadVerse } from "@/lib/client/data";
import { VAGDHENU } from "./config";
import { getChant, hasChant, putChant } from "./idb";
import { getPrefs, inCache, setPrefs } from "./prefs";
import { MAX_HOLD_S, shouldRelease, StreamPlayer } from "./stream-player";
import { chantText, friendly } from "./text";

export interface ChantState {
  /** confirm: waiting for the reader to agree to the download. loading: model download / start-up. generating:
   *  synthesizing (and playing what is ready). done: just finished; the recording is saved. */
  phase: "idle" | "confirm" | "loading" | "generating" | "done" | "error";
  key: string | null;
  label: string;
  message: string;
  /** 0–100 for the current phase. */
  pct: number;
  part: number;
  parts: number;
  provider: "webgpu" | "wasm" | null;
  paused: boolean;
  starved: boolean;
  /** Playback is held until enough is buffered to play through without gaps. */
  held: boolean;
  error: string | null;
  /** Passages known (this session) to have a saved chant. */
  saved: Record<string, true>;
}
const IDLE: Omit<ChantState, "saved"> = { phase: "idle", key: null, label: "", message: "", pct: 0, part: 0, parts: 0, provider: null, paused: false, starved: false, held: false, error: null };
let state: ChantState = { ...IDLE, saved: {} };
const listeners = new Set<() => void>();
const set = (patch: Partial<ChantState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useChant = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );

const keyOf = (id: string) => `${VAGDHENU.audioTag}:${id}`;
const urls = new Map<string, string>();
let worker: Worker | null = null;
let ready = false;
let sp: StreamPlayer | null = null;
let job = 0;
/** When synthesis of the current job began (after the model was ready), for the release gate. */
let t0 = 0;
/** When the first chunk of the current job arrived (the hold is capped from then). */
let firstAt = 0;
let target: { id: string; up: string; label: string } | null = null;

/** Is the model already downloaded? */
export const modelCached = () => inCache(VAGDHENU.cacheName, VAGDHENU.probe);
/** Does this browser offer WebGPU (the fast path)? */
export async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}
/** Has this passage a saved AI chant? (also marks it in state for the buttons) */
export async function isSaved(id: string): Promise<boolean> {
  if (state.saved[id]) return true;
  const ok = await hasChant(keyOf(id));
  if (ok) set({ saved: { ...state.saved, [id]: true } });
  return ok;
}

async function playSaved(id: string, label: string): Promise<boolean> {
  const rec = await getChant(keyOf(id));
  if (!rec) return false;
  let src = urls.get(id);
  if (!src) {
    src = URL.createObjectURL(rec.blob);
    urls.set(id, src);
  }
  player.toggle({ id: `ai:${id}`, label, src, ai: true });
  return true;
}

function chantWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(VAGDHENU.worker, { type: "module", name: "vagdhenu" });
  w.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === "status") {
      if (!ready) set({ phase: "loading", message: friendly(m.message), pct: Math.round(m.progress ?? 0) });
      else if (m.job === job) set({ message: friendly(m.message), pct: Math.round(m.progress ?? state.pct) });
      return;
    }
    if (m.type === "ready") {
      ready = true;
      t0 = performance.now();
      set({ provider: m.provider, phase: state.phase === "loading" ? "generating" : state.phase, pct: 0, message: "Preparing the first line…" });
      return;
    }
    if (m.job !== job) return;
    if (m.type === "chunk") {
      if (!sp) return;
      sp.push(m.samples, m.sr);
      if (!firstAt) firstAt = performance.now();
      if (sp.held && shouldRelease({ done: m.index + 1, total: m.total, made: sp.made, elapsed: (performance.now() - t0) / 1000 })) sp.release();
      set({ part: m.index + 1, parts: m.total, starved: false, held: sp.held });
    } else if (m.type === "done") {
      sp?.end();
      set({ held: false });
      const id = target?.id;
      if (id) {
        const blob = new Blob([m.wav], { type: "audio/wav" });
        void putChant(keyOf(id), { blob, duration: m.duration, meter: m.meter, provider: m.provider, createdAt: Date.now() }).then((ok) => {
          if (ok) set({ saved: { ...state.saved, [id]: true } });
        });
      }
      set({ phase: "done", pct: 100, message: `Chanted in ${m.meter} · saved on this device`, provider: m.provider });
    } else if (m.type === "error") fail(m.message);
  };
  w.onerror = (e) => fail(e.message || "The chant model could not start in this browser.");
  worker = w;
  return w;
}

async function generate(id: string, up: string, label: string, player0: StreamPlayer) {
  job++;
  const my = job;
  target = { id, up, label };
  sp?.stop();
  sp = player0;
  player0.onDone = () => {
    if (sp !== player0) return;
    sp = null;
    releaseAudio("chant");
    if (state.phase === "done" || state.phase === "generating") set({ ...IDLE, saved: state.saved });
  };
  claimAudio("chant", () => chant.stop());
  set({ ...IDLE, saved: state.saved, phase: ready ? "generating" : "loading", key: id, label, message: ready ? "Preparing the first line…" : "Starting the chant model…" });
  const v = await loadVerse(id, up);
  if (my !== job) return;
  if (!v) return fail("This passage could not be loaded.");
  const text = chantText(v.sa);
  if (!text) return fail("This passage has no Sanskrit text to chant.");
  t0 = performance.now();
  firstAt = 0;
  set({ held: true });
  chantWorker().postMessage({ type: "chant", job: my, text });
}

function fail(error: string) {
  job++;
  sp?.stop();
  sp = null;
  // A failed or abandoned run may leave the engine mid-step; start clean next time (the weights stay cached).
  worker?.terminate();
  worker = null;
  ready = false;
  releaseAudio("chant");
  set({ ...IDLE, saved: state.saved, phase: "error", key: target?.id ?? null, label: target?.label ?? "", error });
}

export const chant = {
  get: () => state,
  /** The "Chant with Vāgdhenu" button. Call it from the click: audio may only start on a user gesture. */
  request(id: string, up: string, label: string) {
    if (state.key === id && (state.phase === "loading" || state.phase === "generating")) {
      if (state.paused) chant.resume();
      else chant.pause();
      return;
    }
    const sp0 = new StreamPlayer({ hold: true });
    void (async () => {
      if (await playSaved(id, label)) return sp0.stop();
      if (getPrefs().chantOk || (await modelCached())) return generate(id, up, label, sp0);
      sp0.stop();
      target = { id, up, label };
      set({ ...IDLE, saved: state.saved, phase: "confirm", key: id, label });
    })();
  },
  /** The reader agreed to the one-time download. */
  confirm() {
    setPrefs({ chantOk: true });
    if (target) void generate(target.id, target.up, target.label, new StreamPlayer({ hold: true }));
  },
  dismiss() {
    if (state.phase === "confirm" || state.phase === "error" || state.phase === "done") set({ ...IDLE, saved: state.saved });
  },
  /** Start hearing what is ready now, accepting pauses while the rest is made. */
  playNow() {
    sp?.release();
    set({ held: false });
  },
  pause() {
    sp?.pause();
    set({ paused: true });
  },
  resume() {
    sp?.resume();
    claimAudio("chant", () => chant.stop());
    set({ paused: false });
  },
  /** Stop listening. A run still generating is abandoned (the engine has no cancel, so its worker is ended). */
  stop() {
    const generating = state.phase === "loading" || state.phase === "generating";
    job++;
    sp?.stop();
    sp = null;
    if (generating) {
      worker?.terminate();
      worker = null;
      ready = false;
    }
    releaseAudio("chant");
    set({ ...IDLE, saved: state.saved });
  },
  poll() {
    if (sp?.held && firstAt && (performance.now() - firstAt) / 1000 > MAX_HOLD_S) {
      sp.release();
      set({ held: false });
    }
    if (sp && state.phase === "generating" && !state.paused) {
      const starved = sp.starved;
      if (starved !== state.starved) set({ starved });
    }
  },
  /** Replay a saved chant through the site player. */
  playSaved,
};
