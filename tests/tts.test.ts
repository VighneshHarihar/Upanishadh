// Local speech: the text each engine is given, narration pieces, voice ranking, the chant's play-without-gaps gate,
// the badge, and pinned runtime URLs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { aksharas, chantSegments, chantText, cleanDeva, friendly, narrationChunks, rankVoices, sentencesOf, speakable } from "../src/lib/tts/text.ts";
import { AI_CHANT_BADGE, PIPER, PIPER_BYTES, PIPER_RUNTIME, VAGDHENU } from "../src/lib/tts/config.ts";
import { shouldRelease } from "../src/lib/tts/stream-player.ts";

const ROOT = join(import.meta.dirname, "..");

test("the AI chant badge says exactly what it is and is not", () => {
  assert.equal(AI_CHANT_BADGE, "AI Chant · Vāgdhenu (classical meter, no Vedic svaras)");
});

test("akṣaras count written and inherent vowels, not half-consonants", () => {
  assert.equal(aksharas("श्रेयश्च"), 3); // śre-yaś-ca
  assert.equal(aksharas("प्रेयो मन्दो"), 4);
  assert.equal(aksharas("ओम्"), 1);
});

test("a verse is chanted hemistich by hemistich; numbers and daṇḍas are dropped", () => {
  const sa = ["श्रेयश्च प्रेयश्च मनुष्यमेतः तौ सम्परीत्य विविनक्ति धीरः ।", "श्रेयो हि धीरोऽभि प्रेयसो वृणीते प्रेयो मन्दो योगक्षेमाद्वृणीते ॥ २॥"];
  const segs = chantSegments(sa);
  assert.equal(segs.length, 2);
  assert.ok(segs.every((s) => !/[।॥०-९0-9]/.test(s)));
  assert.equal(chantText(sa).split("\n").length, 2);
  assert.equal(cleanDeva("ॐ पूर्णमदः ॥ १ ॥"), "ओम् पूर्णमदः");
});

test("long prose is cut at word boundaries, short sentences are joined, and nothing exceeds 40 syllables", () => {
  const prose = ["सूर्यश् चक्षुर् वातः प्राणो व्यात्तम् अग्निर् वैश्वानरः संवत्सर आत्माश्वस्य मेध्यस्य द्यौः पृष्ठम् अन्तरिक्षम् उदरं पृथिवी पाजस्यं दिशः पार्श्वे अवान्तरदिशः ।"];
  const segs = chantSegments(prose);
  assert.ok(segs.length >= 2);
  assert.ok(segs.every((s) => aksharas(s) <= 40));
  assert.equal(segs.join(" ").replace(/\s+/g, " "), cleanDeva(prose[0]));
  const short = ["वाच ऋग् रसः ।", "ऋचः साम रसः ।"];
  assert.equal(chantSegments(short).length, 1);
});

test("every passage in the corpus has chantable text, in pieces of at most 40 syllables", () => {
  const dir = join(ROOT, "data", "corpus");
  if (!existsSync(dir)) return;
  let n = 0;
  for (const up of readdirSync(dir)) {
    const f = join(dir, up, "verses.json");
    if (!existsSync(f)) continue;
    for (const v of JSON.parse(readFileSync(f, "utf8")) as { id: string; sa: string[] }[]) {
      const segs = chantSegments(v.sa);
      assert.ok(segs.length > 0, `${v.id} has nothing to chant`);
      for (const s of segs) assert.ok(aksharas(s) <= 40, `${v.id}: ${aksharas(s)} syllables in "${s}"`);
      n++;
    }
  }
  assert.ok(n > 1000);
});

test("narration text drops Devanagari and footnotes and spells IAST for an English voice", () => {
  const s = speakable("Śaṅkara says the Ātman [12] is not born (न जायते). Com.— Upaniṣad means ‘sitting near’.");
  assert.ok(!/[ऀ-ॿ]/.test(s));
  assert.ok(!/\[12\]/.test(s));
  assert.match(s, /Shankara/);
  assert.match(s, /Atman/);
  assert.match(s, /Upanishad/);
});

test("sentences end at . ! ? before a capital, but not after abbreviations, initials or inside a citation", () => {
  assert.deepEqual(sentencesOf("See e.g. the Br. IV. iv. 22 text. Then S. Radhakrishnan says so. Who am I? I am Ātman. (He said. It is.) Done."), [
    "See e.g. the Br. IV. iv. 22 text.",
    "Then S. Radhakrishnan says so.",
    "Who am I?",
    "I am Ātman.",
    "(He said. It is.) Done.",
  ]);
  assert.deepEqual(sentencesOf("Thou art that, O Śvetaketu.—Having been thus taught, he said so."), ["Thou art that, O Śvetaketu.—", "Having been thus taught, he said so."]);
});

test("narration drops citations and trailing passage numbers", () => {
  const s = speakable("there is no Heaven’ (Bṛhadā. Upa. III. viii. 11.)—that through which all this is. Be it so, my dear’.—(7)");
  assert.ok(!/III|viii|\(7\)|Brihada/.test(s), s);
  assert.match(s, /no Heaven'—that through which/);
  assert.match(s, /my dear'\.$/);
});

test("narration pieces: a short first piece, then a ramp; at most 180 characters; nothing lost or reordered", () => {
  const text = speakable(
    "Here a chariot is imagined for the ātman, conditioned in Saṃsāra, entitled to acquire knowledge and perform Karma for attaining emancipation and for travelling in Saṃsāra, as a means to reach both. Know the ātman, who is the enjoyer of the fruits of Karma and is in the bondage of Saṃsāra, to be the lord of the chariot. Know the body to be verily the chariot, because like a chariot the body is drawn by the senses occupying the place of horses.",
  );
  const c = narrationChunks(text);
  assert.equal(c[0], "Here a chariot is imagined for the atman,");
  assert.ok(c.every((x) => x.length <= 180));
  assert.equal(c.join("").replace(/\s+/g, ""), text.replace(/\s+/g, ""));
  // A long clause with no punctuation is cut before a conjunction, not mid-phrase.
  const [first] = narrationChunks("Know the body to be verily the chariot because like a chariot the body is drawn by the senses occupying the place of horses.");
  assert.equal(first, "Know the body to be verily the chariot");
});

test("every commentary in the corpus splits into valid narration pieces", () => {
  const dir = join(ROOT, "public", "data", "bhashya");
  if (!existsSync(dir)) return;
  let n = 0;
  for (const up of readdirSync(dir))
    for (const f of readdirSync(join(dir, up)))
      for (const [id, b] of Object.entries(JSON.parse(readFileSync(join(dir, up, f), "utf8"))) as [string, { text: string }][]) {
        const text = speakable(b.text);
        const c = narrationChunks(text);
        assert.ok(c.length > 0, `${id}: nothing to read`);
        assert.ok(c[0].length <= 48, `${id}: first piece of ${c[0].length} characters`);
        let made = 0;
        for (const [k, x] of c.entries()) {
          assert.ok(x.length <= 180, `${id}: a piece of ${x.length} characters`);
          if (k > 0) assert.ok(x.length <= Math.max(48, 2 * made), `${id}: piece ${k} outgrows the ramp`);
          made += x.length;
        }
        assert.equal(c.join("").replace(/\s+/g, ""), text.replace(/\s+/g, ""), `${id}: text lost`);
        n++;
      }
  assert.ok(n > 1000);
});

test("browser voices: natural and online voices first, legacy desktop and novelty voices last, English only", () => {
  const v = (name: string, lang: string, localService = true) => ({ name, lang, voiceURI: name, localService });
  const ranked = rankVoices([
    v("Microsoft David - English (United States)", "en-US"),
    v("Fred", "en-US"),
    v("Google UK English Male", "en-GB", false),
    v("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB", false),
    v("Rishi", "en-IN"),
    v("Daniel (Enhanced)", "en-GB"),
    v("Google Deutsch", "de-DE", false),
    v("Microsoft Zira Desktop - English (United States)", "en-US"),
  ]).map((x) => x.name);
  assert.equal(ranked[0], "Microsoft Ryan Online (Natural) - English (United Kingdom)");
  assert.deepEqual(ranked.slice(1, 4), ["Google UK English Male", "Daniel (Enhanced)", "Rishi"]);
  assert.deepEqual(ranked.slice(-3), ["Microsoft David - English (United States)", "Microsoft Zira Desktop - English (United States)", "Fred"]);
  assert.ok(!ranked.includes("Google Deutsch"));
});

test("the AI chant is held until it can run to the end without a gap", () => {
  // Faster than real time: play as soon as the first piece is ready.
  assert.equal(shouldRelease({ done: 1, total: 5, made: 4, elapsed: 2 }), true);
  // Half real time, first of four pieces: the rest (12 s of audio) takes 24 s to make; 4 s buffered is not enough.
  assert.equal(shouldRelease({ done: 1, total: 4, made: 4, elapsed: 8 }), false);
  // Three of four made at half real time: 4 s left takes 8 s, 12 s buffered covers it.
  assert.equal(shouldRelease({ done: 3, total: 4, made: 12, elapsed: 24 }), true);
  assert.equal(shouldRelease({ done: 4, total: 4, made: 16, elapsed: 32 }), true);
  assert.equal(shouldRelease({ done: 0, total: 4, made: 0, elapsed: 3 }), false);
});

test("the engine's progress lines are put in plain words", () => {
  assert.equal(friendly("Hemistich 2/4: Step 3/7 (Guided CFG · WEBGPU)"), "Line 2 of 4 · pass 3 of 7");
  assert.equal(friendly("Part 1/6: Preparing Prosodic Conditioning..."), "Line 1 of 6 · preparing");
  assert.match(friendly("Downloading ONNX WebGPU DiT Backbone: 12.3 / 191.6 MB"), /once · WebGPU DiT Backbone 12 of 192 MB/);
});

test("runtimes and models are pinned: exact versions, a commit for the chant engine, no 'latest'", async () => {
  const chant = readFileSync(join(ROOT, "public", "tts", "vagdhenu-worker.js"), "utf8");
  const urls = [...chant.matchAll(/https:\/\/cdn\.jsdelivr\.net\/[^"'\s]+/g)].map((m) => m[0]).concat([PIPER.ort, `${PIPER.phonemizer}.wasm`]);
  assert.ok(urls.length >= 4);
  for (const u of urls) assert.match(u, /@(\d+\.\d+\.\d+|[0-9a-f]{40})\//, u);
  assert.ok(chant.includes(VAGDHENU.lib) && chant.includes(VAGDHENU.ort));
  assert.ok(!/@latest|@\^|@~/.test(chant));
  // The narration worker is bundled from npm at exact versions, and the ONNX Runtime it runs must be the version of
  // the JavaScript it is bundled with.
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.dependencies["@mintplex-labs/piper-tts-web"], /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.dependencies["onnxruntime-web"], PIPER.ortVersion);
  const ort = JSON.parse(readFileSync(join(ROOT, "node_modules", "onnxruntime-web", "package.json"), "utf8"));
  assert.equal(ort.version, PIPER.ortVersion);
  assert.ok(PIPER.ort.includes(`onnxruntime-web@${PIPER.ortVersion}/`));
  assert.ok(PIPER_RUNTIME.every((f) => f.file.includes(f.key === "ort" ? PIPER.ortVersion : "1.0.0")));
  assert.equal(PIPER_BYTES, PIPER.bytes.model + PIPER.bytes.ort + PIPER.bytes.phonemizerData + PIPER.bytes.phonemizerWasm);
  // The voice is where the package fetches it from, under the file name the worker checks.
  const { HF_BASE, PATH_MAP } = await import("@mintplex-labs/piper-tts-web");
  assert.equal(`${HF_BASE}/${PATH_MAP[PIPER.voice]}`, PIPER.model);
  assert.equal(PIPER.model.split("/").at(-1), PIPER.opfs.voiceFile);
  // The worker asks for this voice, one thread, and no CDN loader.
  const src = readFileSync(join(ROOT, "workers", "piper-worker.js"), "utf8");
  assert.ok(src.includes("voiceId: PIPER.voice") && src.includes('pin("numThreads", 1)') && src.includes('pin("wasmPaths", undefined)'));
});
