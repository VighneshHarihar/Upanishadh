// Local text-to-speech, entirely in the browser: no key, no server. Two engines, each in its own module worker under
// public/tts/, so Next never bundles their runtimes; every runtime and model URL is pinned, and each is downloaded once.
//
//   English narration of translations and Śaṅkara's commentary: Piper (Rhasspy; voice en_GB-alan-medium) through
//   @mintplex-labs/piper-tts-web on ONNX Runtime Web, streamed sentence by sentence; the worker is bundled from
//   workers/piper-worker.js by scripts/build-tts-worker.mjs. The browser's own speechSynthesis is the zero-download
//   "Browser voice".
//   Sanskrit recitation where no human recording exists: Vāgdhenu (IISc Bengaluru, Prof. Prathosh A P), the
//   flow-matching śloka-to-chant model, ported to ONNX Runtime Web by Hemanth HM. It chants in classical meter and
//   has no Vedic svaras (udātta, anudātta, svarita), so it is never presented as a Vedic recitation.

/** The exact badge on every synthesized chant. */
export const AI_CHANT_BADGE = "AI Chant · Vāgdhenu (classical meter, no Vedic svaras)";

/** ONNX Runtime Web: the same version as the npm dependency the narration worker is bundled with (a test checks). */
const ORT_VERSION = "1.23.2";
export const PIPER = {
  worker: "/tts/piper-worker.js",
  voice: "en_GB-alan-medium",
  voiceLabel: "Alan · British English",
  /** Where @mintplex-labs/piper-tts-web fetches the voice (Rhasspy's Piper voices, mirrored by Diffusion Studio). */
  model: "https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx",
  ort: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`,
  ortVersion: ORT_VERSION,
  /** espeak-ng compiled to WebAssembly: turns English text into the phonemes Piper reads. */
  phonemizer: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize",
  sampleRate: 22_050,
  /** Origin private file system (OPFS): the package keeps the voice in piper/, the worker keeps the runtimes here. */
  opfs: { voiceDir: "piper", voiceFile: "en_GB-alan-medium.onnx", runtimeDir: "upasarathi-tts" },
  /** Bytes of each download (the voice from the Hub listing; the runtimes measured). Also an integrity check: a file
   *  of any other size is fetched again. */
  bytes: { model: 63_201_294, ort: 11_905_541, phonemizerData: 18_077_249, phonemizerWasm: 635_212 },
} as const;
/** Everything Piper needs, downloaded once: about 94 MB. */
export const PIPER_BYTES = Object.values(PIPER.bytes).reduce((a, b) => a + b, 0);
/** The runtimes the worker fetches itself and keeps in OPFS (file names carry their versions). */
export const PIPER_RUNTIME = [
  { key: "ort", url: `${PIPER.ort}ort-wasm-simd-threaded.wasm`, file: `ort-wasm-simd-threaded-${ORT_VERSION}.wasm`, bytes: PIPER.bytes.ort },
  { key: "phonemizerWasm", url: `${PIPER.phonemizer}.wasm`, file: "piper_phonemize-1.0.0.wasm", bytes: PIPER.bytes.phonemizerWasm },
  { key: "phonemizerData", url: `${PIPER.phonemizer}.data`, file: "piper_phonemize-1.0.0.data", bytes: PIPER.bytes.phonemizerData },
] as const;

export const SPEEDS = [0.8, 1, 1.25, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];

export const VAGDHENU = {
  worker: "/tts/vagdhenu-worker.js",
  /** The browser engine (sanskrit-tts-web dist/index.mjs), pinned to a commit. */
  lib: "https://cdn.jsdelivr.net/gh/hemanth/sanskrit-tts-web@aedd58f6f96d13b24b4899dc4faec0bcc8b53fdc/dist/index.mjs",
  ort: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.all.min.mjs",
  /** WebGPU weights and the CPU (MatMulInteger) weights; the engine picks one by what the browser supports. */
  repos: { webgpu: "gnumanth/sanskrit-tts-onnx", wasm: "gnumanth/sanskrit-tts-wasm" },
  /** Weights + prosody bank, from the Hub listings (bytes): WebGPU 297.4 MB, CPU 296.0 MB; plus 23.8 MB of runtime. */
  bytes: { webgpu: 297_421_278, wasm: 296_041_287, runtime: 23_824_254 },
  /** The engine's own Cache API bucket and its largest file, to tell whether the model is already here. */
  cacheName: "vagdhenu-models-v10",
  probe: [
    "https://huggingface.co/gnumanth/sanskrit-tts-wasm/resolve/main/vagdhenu_dit_step_q8.onnx",
    "https://huggingface.co/gnumanth/sanskrit-tts-onnx/resolve/main/vagdhenu_dit_step_q8.onnx",
  ],
  sampleRate: 24_000,
  /** Bumped if the engine, seed or segmentation changes, so stale audio is not replayed. */
  audioTag: "vagdhenu-v10-s60-1",
} as const;

export const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;
