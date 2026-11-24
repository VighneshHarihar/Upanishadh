// Optional, offline: chant the passages that have no human recording with Vāgdhenu on your own machine, in a batch.
//
// The site does not need this. Readers chant a passage on their own device with the in-browser engine
// (src/lib/tts, public/tts/vagdhenu-worker.js), which downloads ~300 MB once. This script is the documented fallback
// for anyone who would rather pre-generate audio: it drives `cowchant`, the command-line build of the same model
// (Prof. Prathosh A P's Vāgdhenu, IISc Bengaluru: IndicF5 flow-matching DiT + BigVGAN, with the full 64-step ODE, so
// it is slower but a little cleaner than the 7-step browser port).
//
//   pip install cowchant            # CPU; `pip install "cowchant[gpu]"` for CUDA. First run downloads ~2 GB of weights.
//   node scripts/gen-vagdhenu.mjs --check                    # is cowchant installed?
//   node scripts/gen-vagdhenu.mjs                            # dry run: what would be chanted, and the commands
//   node scripts/gen-vagdhenu.mjs --run --text chandogya     # chant one Upanishad's unrecorded passages
//   node scripts/gen-vagdhenu.mjs --run --ids ChU_1.1.3,BU_1.4.10 --device cuda
//
// Options: --text <id>[,<id>]  --ids <id>[,<id>]  --limit <n>  --out <dir> (default .cache/vagdhenu)  --device cpu|cuda|mps
//          --seed <n> (default 60, the browser engine's seed)  --cowchant <path to the executable>
// Output: <out>/<passage id>.wav (24 kHz) and <out>/manifest.json. Resumable: passages already in <out> are skipped.
// The text given to the model is the same as in the browser (chantText in src/lib/tts/text.ts): one hemistich or
// short prose phrase per line, daṇḍas and numbers removed.
//
// Every file this makes is a synthesized chant in classical meter without Vedic svaras. Wherever it is published it
// must carry the same badge as in the app: "AI Chant · Vāgdhenu (classical meter, no Vedic svaras)".
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chantText } from "../src/lib/tts/text.ts";
import { AI_CHANT_BADGE } from "../src/lib/tts/config.ts";

const ROOT = join(import.meta.dirname, "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const list = (name) => (opt(name) ? opt(name).split(",").map((s) => s.trim()).filter(Boolean) : null);

const exe = opt("cowchant", "cowchant");
const out = join(ROOT, opt("out", join(".cache", "vagdhenu")));
const seed = opt("seed", "60");
const device = opt("device");

function cowchant(args, input) {
  return spawnSync(exe, args, { encoding: "utf8", input, shell: process.platform === "win32" });
}

if (flag("check")) {
  const r = cowchant(["--list-meters"]);
  if (r.error || r.status !== 0) {
    console.error(`cowchant is not available (${r.error?.message ?? r.stderr?.trim() ?? `exit ${r.status}`}). Install it with: pip install cowchant`);
    process.exit(1);
  }
  console.log(`cowchant is installed. Meters:\n${r.stdout.trim()}`);
  process.exit(0);
}

// Passages with no human recording.
const texts = list("text");
const ids = list("ids");
const limit = Number(opt("limit", "0")) || Infinity;
const corpus = join(ROOT, "data", "corpus");
const todo = [];
for (const up of (await readdir(corpus, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
  if (texts && !texts.includes(up)) continue;
  const f = join(corpus, up, "verses.json");
  if (!existsSync(f)) continue;
  for (const v of JSON.parse(await readFile(f, "utf8"))) {
    if (v.audio) continue;
    if (ids && !ids.includes(v.id)) continue;
    todo.push({ id: v.id, up, text: chantText(v.sa) });
  }
}
const missing = todo.filter((t) => !existsSync(join(out, `${t.id}.wav`)));
const pending = missing.slice(0, limit);
console.log(`${todo.length} passages without a human recording${texts ? ` in ${texts.join(", ")}` : ""}; ${todo.length - missing.length} already chanted in ${out}; ${pending.length} to do now.`);

const argsFor = (t, input) => ["--input", input, "-o", join(out, `${t.id}.wav`), "--seed", seed, ...(device ? ["--device", device] : [])];
if (!flag("run")) {
  for (const t of pending.slice(0, 5)) console.log(`\n${t.id}\n${t.text}\n  → ${exe} ${argsFor(t, join(out, "_input", `${t.id}.txt`)).join(" ")}`);
  if (pending.length > 5) console.log(`\n… and ${pending.length - 5} more. Add --run to chant them.`);
  process.exit(0);
}

await mkdir(join(out, "_input"), { recursive: true });
const manifestPath = join(out, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { badge: AI_CHANT_BADGE, engine: "cowchant (Vāgdhenu)", seed: Number(seed), passages: {} };
let made = 0;
for (const [i, t] of pending.entries()) {
  const input = join(out, "_input", `${t.id}.txt`);
  await writeFile(input, t.text, "utf8");
  const started = Date.now();
  process.stdout.write(`[${i + 1}/${pending.length}] ${t.id} … `);
  const r = cowchant(argsFor(t, input));
  if (r.error || r.status !== 0) {
    console.log(`failed: ${(r.error?.message ?? r.stderr ?? "").trim().split("\n").at(-1)}`);
    continue;
  }
  manifest.passages[t.id] = { file: `${t.id}.wav`, up: t.up, text: t.text, seconds: Math.round((Date.now() - started) / 100) / 10, at: new Date().toISOString() };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 1), "utf8");
  made++;
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
console.log(`\n${made} chanted into ${out}. Each is a synthesized chant: label it "${AI_CHANT_BADGE}" wherever it is used.`);
