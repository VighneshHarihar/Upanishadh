// UpaSārathi · Sanskrit chant worker (module worker). Vāgdhenu, the flow-matching śloka-to-chant model (Prof. Prathosh
// A P, IISc Bengaluru), in its in-browser ONNX port by Hemanth HM (sanskrit-tts-web): a conditioner, a 22-block DiT
// stepped by a rectified-flow ODE, and a Vocos vocoder at 24 kHz, with a prosody bank of classical meters. It chants
// in classical meter; it has no Vedic svaras. The engine uses WebGPU when the browser has it and WASM SIMD otherwise,
// and keeps the weights (about 300 MB) in the Cache API ("vagdhenu-models-v10").
// Protocol, in:  {type:"chant", job, text, meter?}
//          out: {type:"status", job, stage, message, progress} · {type:"ready", provider}
//               {type:"chunk", job, index, total, samples: Float32Array, sr} · {type:"done", job, wav, duration, meter, provider}
//               {type:"error", job, message}
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.all.min.mjs";
const LIB = "https://cdn.jsdelivr.net/gh/hemanth/sanskrit-tts-web@aedd58f6f96d13b24b4899dc4faec0bcc8b53fdc/dist/index.mjs";

let lib = null;
let voice = null;
let starting = null;
let job = 0;

function start() {
  return (starting ||= (async () => {
    // The engine looks for ONNX Runtime on globalThis before trying a bare import or a <script> tag (neither works in
    // a worker), so it is loaded here first.
    const ortMod = await import(ORT);
    globalThis.ort = ortMod.default && ortMod.default.InferenceSession ? ortMod.default : ortMod;
    lib = await import(LIB);
    voice = await lib.sanskritTts({
      backend: "onnx", // WebGPU weights when WebGPU works; the engine switches to its CPU weights otherwise
      onProgress: (s) => self.postMessage({ type: "status", job, stage: s.stage, message: s.message, progress: s.progress }),
    });
    self.postMessage({ type: "ready", provider: voice.engine.provider });
  })());
}

async function chant({ job: my, text, meter }) {
  job = my;
  try {
    await start();
    // Meter: the engine's own scansion; prose (no meter found) is chanted against its prose (gadya) reference.
    const m = meter || lib.detectMeterKey(text) || "gadya";
    const res = await voice.chant(text, {
      meter: m,
      onProgress: (s) => self.postMessage({ type: "status", job: my, stage: s.stage, message: s.message, progress: s.progress }),
      onChunk: (c) => {
        // The engine keeps its own arrays for the final mix, so the chunk is copied before it is transferred.
        const gated = c.gatedSamples || c.samples;
        const gap = c.gapSamples || new Float32Array(0);
        const out = new Float32Array(gated.length + gap.length);
        out.set(gated, 0);
        out.set(gap, gated.length);
        self.postMessage({ type: "chunk", job: my, index: c.chunkIndex, total: c.totalChunks, samples: out, sr: c.sampleRate }, [out.buffer]);
      },
    });
    const wav = res.wav;
    self.postMessage({ type: "done", job: my, wav, duration: res.durationSec, meter: res.meter, provider: voice.engine.provider }, [wav]);
  } catch (e) {
    self.postMessage({ type: "error", job: my, message: String((e && e.message) || e) });
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "chant") chant(m);
};
