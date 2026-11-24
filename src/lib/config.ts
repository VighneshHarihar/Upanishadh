// Site configuration: where this site and its sibling graphs live. Override with environment variables at build time.
//   NEXT_PUBLIC_SITE_URL        this site's public origin (share cards, Open Graph images); localhost when unset
//   NEXT_PUBLIC_GITAVISWA_URL   GitaViśva, for Bhagavad Gītā verses     default https://gitaviswa.vercel.app
//   NEXT_PUBLIC_VEDANVAYA_URL   VedAnvaya, for Saṃhitā mantras          unset by default (see below)
// Saṃhitā references link to VedAnvaya when its address is set; otherwise to the hymn (Ṛgveda sūkta) or chapter
// (Vājasaneyi adhyāya) on Sanskrit Wikisource, which is always reachable. Set a variable to "off" for plain text.
const origin = (v: string | undefined, fallback: string) => {
  const x = (v ?? fallback).trim();
  return x === "off" ? "" : x.replace(/\/+$/, "");
};
export const GITAVISWA_URL = origin(process.env.NEXT_PUBLIC_GITAVISWA_URL, "https://gitaviswa.vercel.app");
export const VEDANVAYA_URL = origin(process.env.NEXT_PUBLIC_VEDANVAYA_URL, "");
const VEDANVAYA_OFF = process.env.NEXT_PUBLIC_VEDANVAYA_URL?.trim() === "off";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

const BASE: Record<string, string> = { gitaviswa: GITAVISWA_URL, vedanvaya: VEDANVAYA_URL };
const DEVA_DIGITS = "०१२३४५६७८९";
const deva = (n: string) => n.replace(/\d/g, (d) => DEVA_DIGITS[Number(d)]);
/** Sanskrit Wikisource page for a Saṃhitā reference such as "RV 1.164.20" (the hymn) or "YV 40.1" (the chapter). */
export function wikisourceUrl(label: string | null | undefined): string | null {
  const m = /^(RV|YV)\s+(\d+)\.(\d+)/.exec(label ?? "");
  if (!m) return null;
  const title = m[1] === "RV" ? `ऋग्वेदः_सूक्तं_${deva(m[2])}.${deva(m[3])}` : `शुक्लयजुर्वेदः/अध्यायः_${deva(m[2])}`;
  return `https://sa.wikisource.org/wiki/${encodeURI(title)}`;
}

/** The link for an external passage (a Gītā verse, a Saṃhitā mantra), or null when its site is switched off. */
export function externalUrl(ext: { site?: string | null; path?: string | null; label?: string | null } | undefined | null): string | null {
  if (!ext?.site || !ext.path) return null;
  const base = BASE[ext.site];
  if (base) return `${base}${ext.path}`;
  if (ext.site === "vedanvaya" && !VEDANVAYA_OFF) return wikisourceUrl(ext.label);
  return null;
}
/** Where Saṃhitā links go in this build, for the About page. */
export const SAMHITA_LINKS: "vedanvaya" | "wikisource" | "off" = VEDANVAYA_URL ? "vedanvaya" : VEDANVAYA_OFF ? "off" : "wikisource";
