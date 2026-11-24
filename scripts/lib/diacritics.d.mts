// Types for scripts/lib/diacritics.mjs (used by the tests).
export declare function fold(w: string): string;
export declare function buildLexicon(iastTexts: string[]): Map<string, string>;
export declare function buildEnglish(texts: string[]): Set<string>;
export declare function restoreDiacritics(text: string, lex: Map<string, string>, english: Set<string>): { text: string; fixed: number };
