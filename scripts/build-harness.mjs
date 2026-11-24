// Bundles the harness CLI into one file, with the knowledge graph, rubric and corpus facts embedded:
//   public/downloads/upasarathi-harness.mjs   (node ≥ 18, no install step)
// Embeds the index, every passage (the light form the engine uses) and the compact graph; the browser-only
// layout, lemma and bhāṣya files are left out.
import { build } from "esbuild";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = join(ROOT, "public", "data");
const read = async (f) => JSON.parse(await readFile(join(D, f), "utf8"));
const [index, graph, rubric, facts, pkg] = await Promise.all([read("index.json"), read("graph.json"), read("rubric.json"), read("facts.json"), readFile(join(ROOT, "package.json"), "utf8").then(JSON.parse)]);
const verses = (await Promise.all(index.texts.map((t) => read(`verses/${t.id}.json`)))).flat();
const out = join(ROOT, "public", "downloads", "upasarathi-harness.mjs");
await mkdir(dirname(out), { recursive: true });
await build({
  entryPoints: [join(ROOT, "harness", "cli.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  minify: true,
  legalComments: "none",
  define: {
    __UPASARATHI_DATA__: JSON.stringify({ index, verses, graph, rubric, facts }),
    __UPASARATHI_VERSION__: JSON.stringify(`${pkg.version}+${facts.corpusHash}`),
  },
  banner: {
    js: `#!/usr/bin/env node\n// UpaSārathi alignment harness ${pkg.version} (corpus ${facts.corpusHash}). MIT licence. Run: node upasarathi-harness.mjs --help\nimport { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);`,
  },
  logLevel: "warning",
});
console.log(`harness → public/downloads/upasarathi-harness.mjs (${((await stat(out)).size / 1024).toFixed(0)} KB)`);
