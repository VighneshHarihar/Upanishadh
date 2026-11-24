// Bundles the English narration worker: workers/piper-worker.js → public/tts/piper-worker.js (one ES module, minified).
// It carries @mintplex-labs/piper-tts-web and onnxruntime-web, so Next and Turbopack never bundle them (onnxruntime-web
// resolves its own WebAssembly at run time, which page bundlers mishandle). Runs before `next build` and `next dev`.
//
// Two adjustments to the package, both at bundle time:
//   · its espeak-ng phonemizer factory is wrapped to merge workers/piper-hooks.js into every instance, so the worker
//     can hand it a compiled module and the data package once instead of a fetch per sentence;
//   · its bundled catalogue of every Piper voice (147 KB, used only by voices(), which this site never calls) is left out.
import { build } from "esbuild";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(ROOT, "workers", "piper-hooks.js");
const out = join(ROOT, "public", "tts", "piper-worker.js");
const EXPORT = /export\s*\{\s*createPiperPhonemize\s*\};?\s*$/;

const piperPatches = {
  name: "piper-patches",
  setup(b) {
    b.onResolve({ filter: /^piper-hooks$/ }, () => ({ path: HOOKS }));
    // The phonemizer chunk is piper-<hash>.js (letters and digits only, unlike the entry, piper-tts-web.js).
    b.onLoad({ filter: /piper-tts-web[\\/]dist[\\/]piper-[A-Za-z0-9_]+\.js$/ }, async (args) => {
      const src = await readFile(args.path, "utf8");
      if (!EXPORT.test(src)) throw new Error(`${args.path}: createPiperPhonemize export not found (did @mintplex-labs/piper-tts-web change?)`);
      const wrapped = src.replace(
        EXPORT,
        `import { hooks as __hooks } from "piper-hooks";\nconst __createPiperPhonemize = (arg = {}) => createPiperPhonemize(Object.assign({}, arg, __hooks));\nexport { __createPiperPhonemize as createPiperPhonemize };\n`,
      );
      return { contents: wrapped, loader: "js" };
    });
    b.onLoad({ filter: /piper-tts-web[\\/]dist[\\/]voices_static-[\w-]+\.js$/ }, () => ({ contents: "export default {};", loader: "js" }));
  },
};

await build({
  entryPoints: [join(ROOT, "workers", "piper-worker.js")],
  outfile: out,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  // The phonemizer's Node branch (never taken in a browser) requires these.
  external: ["fs", "path", "crypto", "node:*"],
  legalComments: "eof",
  plugins: [piperPatches],
  logLevel: "warning",
});
console.log(`narration worker → public/tts/piper-worker.js (${((await stat(out)).size / 1024).toFixed(0)} KB)`);
