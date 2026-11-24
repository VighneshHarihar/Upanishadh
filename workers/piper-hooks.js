// Options merged into every espeak-ng phonemizer instance that @mintplex-labs/piper-tts-web creates (one per sentence).
// scripts/build-tts-worker.mjs wraps the package's createPiperPhonemize to apply them; piper-worker.js fills them in
// once the binaries are loaded: the compiled module and the 18 MB data package are reused instead of fetched again.
/** @type {Record<string, unknown>} */
export const hooks = {};
