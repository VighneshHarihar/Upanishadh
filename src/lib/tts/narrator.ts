// English narration of a translation or of Śaṅkara's commentary, streamed a sentence at a time. Two engines:
//   piper    Piper (voice en_GB-alan-medium) in a module worker (public/tts/piper-worker.js, bundled from
//            workers/piper-worker.js): about 94 MB downloaded once into the browser's private file system. The text is
//            cut into short pieces (narrationChunks); the first is made and played at once, and while one plays the
//            next is made, never more than two ahead. Played through one <audio> element, so speed keeps the pitch.
//   browser  the browser's own speechSynthesis: instant, no download; the most natural English voice on the system
//            is chosen (rankVoices), or the one picked in the dock.
// Which engine is asked once and remembered (prefs). One narration at a time: it shares the speaker with the chant
// player (claimAudio), and it stops when the reader leaves the page. Errors are shown, never retried silently.
import { useSyncExternalStore } from "react";
import { claimAudio, releaseAudio } from "@/lib/client/player";
import { PIPER, PIPER_BYTES, type Speed } from "./config";
import { getPrefs, piperStored, setPrefs, type Engine } from "./prefs";
import { narrationChunks, rankVoices, speakable } from "./text";

export type Part = "translation" | "commentary";
export interface NarrationItem {
  /** The passage id; with `part` it names what is being read. */
  key: string;
  label: string;
  part: Part;
  text: string;
}
export interface NarrationState {
  status: "idle" | "choose" | "loading" | "speaking" | "error";
  paused: boolean;
  engine: Engine | null;
  item: Omit<NarrationItem, "text"> | null;
  /** Piper's files while they download (or load from this browser): bytes so far and in all. */
  download: { loaded: number; total: number } | null;
  /** The piece being heard (1-based; 0 before the first) and how many there are. */
  sentence: number;
  sentences: number;
  /** Waiting for the next piece to be made. */
  starved: boolean;
  error: string | null;
}
const IDLE: NarrationState = { status: "idle", paused: false, engine: null, item: null, download: null, sentence: 0, sentences: 0, starved: false, error: null };
let state: NarrationState = IDLE;
const listeners = new Set<() => void>();
const set = (patch: Partial<NarrationState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const useNarration = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => IDLE,
  );

/** Timeline marks (performance.getEntriesByName): begin, ready, first-audio, sentence {i, ms, chars}, starved {i}. */
const MARKS = ["begin", "ready", "first-audio", "sentence", "starved"];
function mark(name: string, detail?: unknown) {
  try {
    performance.mark(`upasarathi:tts:${name}`, { detail });
  } catch {}
}

let job = 0;
let pending: NarrationItem | null = null;
let current: NarrationItem | null = null;
let chunks: string[] = [];
let from = 0;
let startPath = "";

// ── Piper ─────────────────────────────────────────────────────────────────────────────────────────
/** Pieces made but not yet heard, at most. */
const LOOKAHEAD = 2;
let worker: Worker | null = null;
let workerReady = false;
let el: HTMLAudioElement | null = null;
let ready: { i: number; url: string }[] = [];
let nextReq = 0;
let inflight = false;
let playing = -1;
let playingUrl: string | null = null;
let kokoroForgotten = false;

/** The earlier English voice (Kokoro, about 92 MB) is no longer used: free the space it took in this browser. */
function forgetKokoro() {
  if (kokoroForgotten || typeof caches === "undefined") return;
  kokoroForgotten = true;
  void (async () => {
    try {
      await caches.delete("kokoro-voices");
      if (!(await caches.has("transformers-cache"))) return;
      const c = await caches.open("transformers-cache");
      for (const req of await c.keys()) if (/Kokoro-82M/i.test(req.url)) await c.delete(req);
    } catch {}
  })();
}

function piperWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(PIPER.worker, { type: "module", name: "piper" });
  w.onmessage = (e: MessageEvent) => {
    if (worker !== w) return;
    const m = e.data;
    if (m.type === "progress") {
      if (state.status === "loading") set({ download: { loaded: m.loaded, total: m.total || PIPER_BYTES } });
    } else if (m.type === "ready") {
      workerReady = true;
      mark("ready", { ms: m.ms });
      if (state.status === "loading" && state.engine === "piper") set({ status: "speaking", download: null, starved: true });
    } else if (m.type === "audio") {
      if (m.job !== job) return;
      inflight = false;
      ready.push({ i: m.i, url: URL.createObjectURL(new Blob([m.wav], { type: "audio/wav" })) });
      mark("sentence", { i: m.i, ms: m.ms, chars: chunks[m.i]?.length ?? 0 });
      if (playing < 0 && !state.paused) playNext();
      else pump();
    } else if (m.type === "error") {
      // An error with no job comes from loading ahead (warm): it matters only if someone is now waiting for the voice.
      if (m.job === undefined ? state.status === "loading" && state.engine === "piper" : m.job === job) fail(m.message);
    }
  };
  w.onerror = (e) => {
    e.preventDefault();
    if (worker !== w) return;
    w.terminate();
    worker = null;
    workerReady = false;
    fail(`The voice could not start in this browser${e.message ? ` (${e.message})` : ""}. Try the browser voice.`);
  };
  worker = w;
  workerReady = false;
  forgetKokoro();
  return w;
}

/** A tenth of a second of silence: played inside the click, it lets this element play later without one (Safari). */
function silence(): string {
  const n = 2205;
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o: number, s: string) => [...s].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, PIPER.sampleRate, true);
  v.setUint32(28, PIPER.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([v.buffer], { type: "audio/wav" }));
}
let silenceUrl: string | null = null;

function audio(): HTMLAudioElement {
  if (el) return el;
  const a = new Audio();
  a.preload = "auto";
  a.preservesPitch = true;
  a.addEventListener("playing", () => {
    if (playing === from && a.src === playingUrl) mark("first-audio", { i: playing });
  });
  a.addEventListener("ended", () => {
    if (playing >= 0 && a.src === playingUrl) playNext();
  });
  a.addEventListener("error", () => {
    if (playing >= 0 && a.src === playingUrl) fail("This browser could not play the narration audio.");
  });
  el = a;
  return a;
}

function playFailed(e: unknown) {
  const name = (e as Error)?.name;
  if (name === "AbortError") return; // paused or moved on before it started: not a failure
  fail(name === "NotAllowedError" ? "The browser blocked playback. Press Listen again." : "This browser could not play the narration audio.");
}

function playNext() {
  const a = audio();
  if (playingUrl) URL.revokeObjectURL(playingUrl);
  playingUrl = null;
  const nx = ready.shift();
  if (!nx) {
    playing = -1;
    if (nextReq >= chunks.length && !inflight) return done();
    if (!state.starved) {
      if (state.sentence > from) mark("starved", { i: nextReq });
      set({ starved: true });
    }
    pump();
    return;
  }
  playing = nx.i;
  playingUrl = nx.url;
  a.src = nx.url;
  a.defaultPlaybackRate = a.playbackRate = getPrefs().speed;
  a.preservesPitch = true;
  if (!state.paused) a.play().catch(playFailed);
  set({ status: "speaking", sentence: nx.i + 1, starved: false });
  pump();
}

/** Ask for the next piece if nothing is being made and fewer than LOOKAHEAD are waiting (never while paused). */
function pump() {
  if (state.engine !== "piper" || !worker || state.paused || inflight || nextReq >= chunks.length || ready.length >= LOOKAHEAD) return;
  if (state.status !== "loading" && state.status !== "speaking") return;
  inflight = true;
  worker.postMessage({ type: "synth", job, i: nextReq, text: chunks[nextReq] });
  nextReq++;
}

function startPiper() {
  if (typeof Worker === "undefined" || typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
    return fail("This browser cannot run the natural voice. Try the browser voice.");
  }
  // Unlock the element inside the click.
  const a = audio();
  silenceUrl ||= silence();
  a.src = silenceUrl;
  a.play().catch(() => {});
  nextReq = from;
  piperWorker();
  if (workerReady) {
    mark("ready", { already: true });
    set({ status: "speaking", starved: true });
  } else set({ download: { loaded: 0, total: PIPER_BYTES } });
  pump();
}

// ── the browser's own voice ───────────────────────────────────────────────────────────────────────
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(t);
        resolve(speechSynthesis.getVoices());
      },
      { once: true },
    );
  });
}
/** This system's English voices, most natural first. */
export async function browserVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === "undefined") return [];
  return rankVoices(await voicesReady());
}

function speakBrowser() {
  if (typeof speechSynthesis === "undefined") return fail("This browser has no built-in voice.");
  const my = job;
  set({ status: "speaking", sentence: from, starved: false, download: null });
  void browserVoices().then((ranked) => {
    if (my !== job) return;
    const want = getPrefs().browserVoice;
    const voice = ranked.find((v) => v.voiceURI === want) ?? ranked[0] ?? null;
    const say = (i: number) => {
      if (my !== job) return;
      if (i >= chunks.length) return done();
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.rate = getPrefs().speed;
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = "en-GB";
      u.onstart = () => {
        if (my !== job) return;
        if (i === from) mark("first-audio", { i });
        set({ sentence: i + 1 });
      };
      u.onend = () => say(i + 1);
      u.onerror = (ev) => {
        if (my !== job || ev.error === "interrupted" || ev.error === "canceled") return;
        fail(`The browser voice stopped (${ev.error}).`);
      };
      speechSynthesis.speak(u);
    };
    say(from);
  });
}

// ── control ───────────────────────────────────────────────────────────────────────────────────────
/** Silence everything and drop what is waiting. `abortDownload` also ends a first-time download in progress. */
function halt(abortDownload: boolean) {
  if (worker) {
    if (!workerReady && abortDownload) {
      worker.terminate();
      worker = null;
    } else worker.postMessage({ type: "cancel", job });
  }
  if (el) {
    el.pause();
    if (el.getAttribute("src")) {
      el.removeAttribute("src");
      el.load();
    }
  }
  if (playingUrl) URL.revokeObjectURL(playingUrl);
  for (const r of ready) URL.revokeObjectURL(r.url);
  playingUrl = null;
  ready = [];
  playing = -1;
  inflight = false;
  nextReq = 0;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

function begin(item: NarrationItem, engine: Engine, at = 0) {
  halt(false);
  job++;
  pending = null;
  current = item;
  chunks = narrationChunks(speakable(item.text));
  from = Math.min(at, Math.max(0, chunks.length - 1));
  startPath = typeof location === "undefined" ? "" : location.pathname;
  for (const n of MARKS) performance.clearMarks?.(`upasarathi:tts:${n}`);
  mark("begin", { engine, chunks: chunks.length });
  const { text: _t, ...meta } = item;
  set({ ...IDLE, status: "loading", engine, item: meta, sentences: chunks.length, sentence: from });
  claimAudio("narrator", () => narrator.stop());
  if (!chunks.length) return fail("There is nothing here to read aloud.");
  if (engine === "piper") startPiper();
  else speakBrowser();
}
function done() {
  halt(false);
  releaseAudio("narrator");
  set({ ...IDLE });
}
function fail(error: string) {
  halt(false);
  job++;
  releaseAudio("narrator");
  set({ status: "error", error, paused: false, download: null, starved: false });
}
const active = () => state.status === "speaking" || state.status === "loading";

export const narrator = {
  get: () => state,
  /** The reader is about to press Listen (pointer or focus on the button): if they chose Piper and it is already
   *  stored, start loading it now, so the first sentence follows the click sooner. Never starts a download. */
  warm() {
    if (worker || getPrefs().engine !== "piper" || typeof Worker === "undefined") return;
    void piperStored().then((stored) => {
      if (stored && !worker) piperWorker().postMessage({ type: "load" });
    });
  },
  /** Read something aloud; asks for an engine the first time. Call it from a click (audio needs a user gesture). */
  request(item: NarrationItem) {
    const cur = state.item;
    if (cur && cur.key === item.key && cur.part === item.part && active()) {
      if (state.paused) narrator.resume();
      else narrator.pause();
      return;
    }
    const engine = getPrefs().engine;
    if (!engine) {
      halt(false);
      job++;
      pending = item;
      startPath = typeof location === "undefined" ? "" : location.pathname;
      const { text: _t, ...meta } = item;
      set({ ...IDLE, status: "choose", item: meta });
      return;
    }
    begin(item, engine);
  },
  /** The answer to "which voice?": remembered, then the pending text is read. */
  choose(engine: Engine) {
    setPrefs({ engine });
    if (pending) begin(pending, engine);
  },
  /** Switch engine mid-way: continues from the piece being heard (both engines read the same pieces). */
  switchEngine(engine: Engine) {
    setPrefs({ engine });
    if (!current || !(active() || state.status === "error")) return;
    begin(current, engine, Math.max(0, state.sentence - 1));
  },
  pause() {
    if (!active()) return;
    if (state.engine === "piper") el?.pause();
    else if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
    set({ paused: true });
  },
  resume() {
    if (!active()) return;
    claimAudio("narrator", () => narrator.stop());
    set({ paused: false });
    if (state.engine === "piper") {
      if (playing >= 0) el?.play().catch(playFailed);
      else if (ready.length) playNext();
      pump();
    } else if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
  },
  /** Stop, drop every piece waiting to be made or heard, and end a first-time download in progress. */
  stop() {
    halt(true);
    job++;
    pending = null;
    releaseAudio("narrator");
    set({ ...IDLE });
  },
  /** Called on every route change: leaving the page that is being read stops the narration. */
  leave(path: string) {
    if (state.status !== "idle" && path !== startPath) narrator.stop();
  },
  setSpeed(speed: Speed) {
    setPrefs({ speed });
    if (el) el.defaultPlaybackRate = el.playbackRate = speed;
  },
  /** Pick a browser voice; if it is reading, the current sentence starts again in the new voice. */
  setBrowserVoice(voiceURI: string | null) {
    setPrefs({ browserVoice: voiceURI });
    if (current && state.engine === "browser" && active()) begin(current, "browser", Math.max(0, state.sentence - 1));
  },
};
