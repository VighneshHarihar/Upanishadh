// UpaSārathi · English narration worker (module worker). Piper TTS (Rhasspy; voice en_GB-alan-medium) through
// @mintplex-labs/piper-tts-web on ONNX Runtime Web (WASM, one thread). Bundled with esbuild by
// scripts/build-tts-worker.mjs into public/tts/piper-worker.js, so Next never bundles onnxruntime-web.
//
// Everything is downloaded once and kept in the browser's origin private file system (OPFS): the voice by the
// package (piper/), the ONNX Runtime and espeak-ng phonemizer binaries here (upasarathi-tts/). The phonemizer is
// compiled once and its data handed to every instance (the package makes a fresh instance per call), so a sentence
// costs only its synthesis.
//
// One sentence per request: the page asks for sentence N+1 while N plays and never has more than two waiting, so
// stopping costs at most the one sentence being made. Requests from a cancelled job are dropped unheard.
//
// Protocol, in:  {type:"load"} · {type:"synth", job, i, text} · {type:"cancel", job}   (cancels every job ≤ job)
//          out: {type:"progress", loaded, total} · {type:"ready", ms}
//               {type:"audio", job, i, wav: ArrayBuffer (16-bit WAV), ms} · {type:"error", job?, i?, message}
import * as ort from "onnxruntime-web/wasm";
import { TtsSession } from "@mintplex-labs/piper-tts-web";
import { hooks } from "./piper-hooks.js";
import { PIPER, PIPER_BYTES, PIPER_RUNTIME } from "../src/lib/tts/config.ts";

/** A sentence that takes longer than this to make means something is wrong; say so instead of waiting forever. */
const SYNTH_TIMEOUT_MS = 30_000;

// ── OPFS ─────────────────────────────────────────────────────────────────────────────────────────
const dir = async (name) => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
/** A stored file's bytes, if it is there and has the expected size. */
async function readStored(d, name, bytes) {
  try {
    const f = await (await d.getFileHandle(name)).getFile();
    return f.size === bytes ? await f.arrayBuffer() : null;
  } catch {
    return null;
  }
}
async function writeStored(d, name, buf) {
  try {
    const h = await d.getFileHandle(name, { create: true });
    if (h.createWritable) {
      const w = await h.createWritable();
      await w.write(buf);
      await w.close();
    } else {
      const a = await h.createSyncAccessHandle();
      a.truncate(0);
      a.write(new Uint8Array(buf), { at: 0 });
      a.flush();
      a.close();
    }
  } catch {
    // Storage full or unavailable (some private windows): it works this time and downloads again next time.
  }
}
/** Is the voice already stored whole? A truncated copy (an interrupted write) is removed so the package fetches it again. */
async function voiceStored(d) {
  try {
    const f = await (await d.getFileHandle(PIPER.opfs.voiceFile)).getFile();
    if (f.size === PIPER.bytes.model) return true;
    await d.removeEntry(PIPER.opfs.voiceFile);
  } catch {}
  return false;
}

// ── downloads, with one progress figure for all of them ──────────────────────────────────────────
const got = { model: 0, ort: 0, phonemizerWasm: 0, phonemizerData: 0 };
let lastReport = 0;
function report(force = false) {
  const now = performance.now();
  if (!force && now - lastReport < 120) return;
  lastReport = now;
  const loaded = Object.values(got).reduce((a, b) => a + b, 0);
  self.postMessage({ type: "progress", loaded: Math.min(loaded, PIPER_BYTES), total: PIPER_BYTES });
}
async function download(url, bytes, onBytes) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok || !res.body) throw new Error(`Could not download ${url.split("/").pop()} (HTTP ${res.status}).`);
  const out = new Uint8Array(bytes);
  const extra = [];
  let n = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.length <= bytes) out.set(value, n);
    else extra.push(value);
    n += value.length;
    onBytes(Math.min(n, bytes));
  }
  if (n !== bytes || extra.length) throw new Error(`The download of ${url.split("/").pop()} was incomplete (${n} of ${bytes} bytes).`);
  return out.buffer;
}

// ── load once ────────────────────────────────────────────────────────────────────────────────────
let session = null;
let loading = null;
function load() {
  return (loading ||= (async () => {
    const t0 = performance.now();
    const [runtimeDir, voiceDir] = await Promise.all([dir(PIPER.opfs.runtimeDir), dir(PIPER.opfs.voiceDir)]);
    if (await voiceStored(voiceDir)) got.model = PIPER.bytes.model;
    const [ortBinary, phonemizerWasm, phonemizerData] = await Promise.all(
      PIPER_RUNTIME.map(async (f) => {
        const kept = await readStored(runtimeDir, f.file, f.bytes);
        if (kept) {
          got[f.key] = f.bytes;
          report();
          return kept;
        }
        const buf = await download(f.url, f.bytes, (n) => {
          got[f.key] = n;
          report();
        });
        await writeStored(runtimeDir, f.file, buf);
        return buf;
      }),
    );
    report(true);

    // ONNX Runtime: one thread (the site is not cross-origin isolated, so threads are unavailable and asking for
    // them only logs a warning); its binary from OPFS and its loader from this bundle, never from a CDN (the package
    // sets both a thread count and a CDN path, so those two settings are pinned); errors only in the console.
    const pin = (key, value) => Object.defineProperty(ort.env.wasm, key, { configurable: true, enumerable: true, get: () => value, set: () => {} });
    pin("numThreads", 1);
    pin("wasmPaths", undefined);
    ort.env.wasm.wasmBinary = ortBinary;
    ort.env.logLevel = "error";

    // The phonemizer: compiled once; every instance gets the same module and data package. Its stderr is ignored (the
    // package would throw from inside the callback and hang the sentence; a real failure is caught by the timeout).
    const compiled = await WebAssembly.compile(phonemizerWasm);
    Object.assign(hooks, {
      getPreloadedPackage: () => phonemizerData,
      instantiateWasm: (imports, receive) => {
        WebAssembly.instantiate(compiled, imports).then((instance) => receive(instance, compiled));
        return {};
      },
      printErr: () => {},
    });

    // The voice: read from OPFS, or downloaded (with progress) and stored there by the package.
    try {
      session = await TtsSession.create({
        voiceId: PIPER.voice,
        progress: (p) => {
          if (p.url?.endsWith(".onnx")) {
            got.model = Math.min(p.loaded, PIPER.bytes.model);
            report();
          }
        },
        wasmPaths: { onnxWasm: PIPER.ort, piperData: `${PIPER.phonemizer}.data`, piperWasm: `${PIPER.phonemizer}.wasm` },
      });
    } catch (e) {
      // The package keeps one session per page; a failed one must not be handed back on the next attempt.
      TtsSession._instance = null;
      throw e;
    }
    got.model = PIPER.bytes.model;
    report(true);
    // Warm up: the first run of a fresh session is slow (WebAssembly not yet optimized, buffers not yet sized), so a
    // syllable is made and discarded here, as part of loading, and the reader's first sentence runs at full speed.
    await session.predict("Om.");
    self.postMessage({ type: "ready", ms: Math.round(performance.now() - t0) });
  })().catch((e) => {
    loading = null;
    session = null;
    throw e;
  }));
}

// ── one sentence at a time ───────────────────────────────────────────────────────────────────────
let chain = Promise.resolve();
let cancelledUpTo = -1;
const live = (job) => job > cancelledUpTo;

function plain(e) {
  const m = String(e?.message || e || "unknown error");
  if (e?.name === "QuotaExceededError") return "There is not enough storage in this browser for the voice (about 94 MB).";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "The voice could not be downloaded. Check the connection, then press Listen again.";
  return `The voice stopped: ${m}`;
}
function withTimeout(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, reject) => (t = setTimeout(() => reject(new Error("one sentence took too long to make")), ms)))]).finally(() => clearTimeout(t));
}

function synth({ job, i, text }) {
  chain = chain.then(async () => {
    if (!live(job)) return;
    try {
      await load();
      if (!live(job)) return;
      const t0 = performance.now();
      const blob = await withTimeout(session.predict(text), SYNTH_TIMEOUT_MS);
      const wav = await blob.arrayBuffer();
      if (!live(job)) return;
      self.postMessage({ type: "audio", job, i, wav, ms: Math.round(performance.now() - t0) }, [wav]);
    } catch (e) {
      if (live(job)) self.postMessage({ type: "error", job, i, message: plain(e) });
    }
  });
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "synth") synth(m);
  else if (m.type === "cancel") cancelledUpTo = Math.max(cancelledUpTo, m.job);
  else if (m.type === "load") load().catch((err) => self.postMessage({ type: "error", message: plain(err) }));
};
