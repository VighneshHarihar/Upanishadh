import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBhashya, getCorpus, getDarshanas, getGraph, getIndex, getText } from "@/lib/server/data";
import { Darshanas } from "@/components/verse/Darshanas";
import { REL_LABEL } from "@/lib/core/graph";
import type { GEdge } from "@/lib/core/types";
import { externalUrl, SITE_URL } from "@/lib/config";
import { AudioButton } from "@/components/verse/AudioButton";
import { AiChantButton } from "@/components/tts/AiChantButton";
import { ListenControls } from "@/components/tts/ListenControls";
import { CiteChip } from "@/components/verse/Drawer";
import { Lineage, TrayiStrip } from "@/components/verse/Lineage";
import { WordStrip } from "@/components/verse/Words";
import { PlayQueue, VerseActions, ViewToggles } from "@/components/verse/ReaderTools";
import { SanskritBlock } from "@/components/reader/SanskritBlock";
import { LivingPlate } from "@/components/art/plates/LivingPlate";
import { Gloss } from "@/components/ui/Glossary";
import { AskOpen } from "@/components/home/HomeClient";
import { TEXT_HEX } from "@/components/explore/palette";
import { IconArrow, IconBack, IconChat, IconExternal, IconMap } from "@/components/ui/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getIndex().verseIds.map(([, up, ref]) => ({ up, ref }));
}
const refLabel = (ref: string) => (ref === "0" ? "śānti" : ref);
export async function generateMetadata({ params }: { params: Promise<{ up: string; ref: string }> }): Promise<Metadata> {
  const { up, ref } = await params;
  const t = getText(up);
  const v = getCorpus(up).find((x) => x.ref === ref);
  const title = `${t?.iast} Upaniṣad ${refLabel(ref)}`;
  const root = t?.lineage ? [`Rooted in the ${t.lineage.vedaLabel}`, t.lineage.sectionLabel ? `${t.lineage.sectionLabel.split(" ")[0]} section` : null].filter(Boolean).join(" · ") : "";
  const og = `/og?t=${encodeURIComponent(`${t?.abbrev} ${refLabel(ref)}`)}&s=${encodeURIComponent((v?.tr?.text ?? v?.iast.join(" ") ?? "").slice(0, 220))}&d=${encodeURIComponent(v?.sa[0] ?? "")}&up=${encodeURIComponent(up)}&r=${encodeURIComponent(root)}`;
  return { title, description: v?.tr?.text.slice(0, 160), openGraph: { title, images: [{ url: og, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [og] } };
}

export default async function VersePage({ params }: { params: Promise<{ up: string; ref: string }> }) {
  const { up, ref } = await params;
  const t = getText(up);
  const verses = getCorpus(up);
  const i = verses.findIndex((x) => x.ref === ref);
  if (!t || i < 0) notFound();
  const v = verses[i];
  const prev = verses[i - 1];
  const next = verses[i + 1];
  const b = getBhashya(up)[v.id];
  const ix = getIndex();
  const graph = getGraph();
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const rel = graph.edges.filter((e) => (e.s === v.id || e.t === v.id) && !["PART_OF", "NEXT", "HAS_STEM"].includes(e.type));
  const of = (type: string) => rel.filter((e) => e.type === type);
  const stems = graph.edges.filter((e) => e.type === "HAS_STEM" && e.s === v.id).map((e) => e.t);
  const hue = TEXT_HEX.dark[t.id];
  const nearby = verses.slice(Math.max(0, i - 6), i + 7);
  const roots = of("ROOTED_IN").map((e) => ({ label: label(e.t), kind: e.kind, href: externalUrl(ix.external[e.t]) }));
  // Prasthānatrayī: Vedic root → this Upanishad → Brahma Sūtra → Gītā, from the graph's own links
  const trayi = {
    root: roots.map((r) => ({ label: r.label, href: r.href, external: true })),
    sutra: of("READ_BY").map((e) => ({ label: label(e.t), href: `/map?node=${encodeURIComponent(e.t)}`, title: e.why })),
    gita: rel.filter((e) => e.type === "CROSS_REFERENCES" && /^BG_/.test(e.s === v.id ? e.t : e.s)).map((e) => { const g = e.s === v.id ? e.t : e.s; return { label: label(g), href: externalUrl(ix.external[g]), title: e.why, external: true }; }),
  };
  const chanted = verses.filter((x) => x.audio).map((x) => ({ id: x.id, label: `${t.abbrev} ${refLabel(x.ref)}`, src: x.audio!.mp3 }));
  const fromHere = chanted.findIndex((x) => x.id === v.id);
  const commented = ix.texts.reduce((n, x) => n + (x.commented ?? 0), 0);
  const other = (e: GEdge) => (e.s === v.id ? e.t : e.s);
  const share = {
    title: `${t.abbrev} ${refLabel(v.ref)}`,
    subtitle: `${t.iast} Upaniṣad · ${v.shanti ? "Śānti mantra" : v.section}`,
    deva: v.sa.join(" "),
    iast: v.iast.join(" "),
    lines: v.tr ? [v.tr.text, `tr. ${v.tr.by}`] : [],
    url: `${SITE_URL}/u/${up}/${v.ref}`,
  };

  return (
    <div className="gutter grid gap-10 pb-28 pt-8 xl:grid-cols-[220px_minmax(0,1fr)_minmax(340px,440px)] xl:gap-12">
      <Ready />
      {/* ── left: where you are ── */}
      <nav className="hidden xl:sticky xl:top-[calc(var(--nav-h)+28px)] xl:block xl:h-fit" aria-label="Nearby mantras">
        <Link href={`/u/${up}`} className="text-[13px] text-text-3 hover:text-text">← {t.iast} Upaniṣad</Link>
        <p className="eyebrow mb-2 mt-6">{v.shanti ? "Peace invocation" : v.section}</p>
        <ul className="space-y-0.5 text-[13.5px]">
          {nearby.map((x) => (
            <li key={x.id}>
              <Link href={`/u/${up}/${x.ref}`} aria-current={x.id === v.id ? "page" : undefined} className={`flex items-center gap-2 rounded-md px-2 py-1 ${x.id === v.id ? "bg-surface-3 text-text" : "text-text-3 hover:text-text"}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.id === v.id ? hue : "var(--line-3)" }} />
                {t.abbrev} {refLabel(x.ref)}
                {x.hasBhashya && <span className="ml-auto text-[10px] text-accent" title="Śaṅkara’s commentary">Ś</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── centre: the mantra ── */}
      <article className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-[13px] text-text-3 xl:hidden">
          <Link href={`/u/${up}`} className="hover:text-text">← {t.iast} Upaniṣad · {v.section}</Link>
        </div>
        <p className="eyebrow hue-ink mt-4 xl:mt-0" style={{ "--hue-d": hue, "--hue-l": TEXT_HEX.light[t.id] } as React.CSSProperties}>{t.iast} Upaniṣad · {v.shanti ? "Śānti mantra (peace invocation)" : v.section}</p>
        <h1 className="display mt-2 text-[clamp(34px,3.4vw,52px)]">{t.abbrev} {refLabel(v.ref)}</h1>
        <div className="mt-3"><Lineage text={t} compact roots={roots} /></div>
        <TrayiStrip here={`${t.iast} ${refLabel(v.ref)}`} {...trayi} />
        <div className="mt-5"><ViewToggles /></div>
        <SanskritBlock v={v} />
        <div className="mt-6 flex flex-wrap gap-2">
          <AudioButton src={v.audio?.mp3} label="Hear the chant" track={{ id: v.id, label: `${t.abbrev} ${refLabel(v.ref)}` }} />
          {!v.audio && <AiChantButton id={v.id} up={up} label={`${t.abbrev} ${refLabel(v.ref)}`} />}
          <ListenControls id={v.id} label={`${t.abbrev} ${refLabel(v.ref)}`} translation={v.tr?.text} commentary={b?.text} />
          {fromHere >= 0 && chanted.length > 1 && <PlayQueue tracks={chanted} from={fromHere} title={`${t.iast} Upaniṣad`} label="Play on from here" />}
          <Link className="btn btn-sm" href={`/map?node=${encodeURIComponent(v.id)}`}><IconMap size={14} /> In the map</Link>
          <AskOpen className="btn btn-sm btn-ghost" question={`Explain ${t.abbrev} ${refLabel(v.ref)}: what is it saying, and what does it mean for how I live?`}><IconChat size={14} /> Ask about this mantra</AskOpen>
        </div>
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <VerseActions id={v.id} up={up} share={share} />
        </div>
        {v.tr ? (
          <figure className="v-tr mt-9 border-l-2 pl-6" style={{ borderColor: hue }}>
            <blockquote className="reading max-w-[68ch] text-[19px] leading-[1.75]"><Gloss max={4}>{v.tr.text}</Gloss></blockquote>
            <figcaption className="mt-3 text-[13px] text-text-3">
              {v.tr.by}{v.tr.ocr ? ` · ${v.tr.source}, text read from a scan` : " · in the tradition of Śaṅkara"}{v.tr.joint ? ` · this translation renders ${t.abbrev} ${v.tr.joint} together` : ""}
            </figcaption>
          </figure>
        ) : (
          <p className="v-tr mt-9 max-w-[68ch] rounded-2xl border border-dashed border-line-2 p-5 text-[14px] text-text-3">
            Our sources have no English translation for this passage yet. The Sanskrit and IAST above are complete; see <Link href="/about#coverage" className="underline">what is covered</Link>.
          </p>
        )}
        <LivingPlate verseId={v.id} />
        {v.takeaway && (
          <div className="takeaway mt-6 max-w-[68ch]">
            <p className="eyebrow !text-[10.5px]">In plain English · an editorial takeaway, not a translation</p>
            <p className="mt-1 text-[15.5px]"><Gloss>{v.takeaway}</Gloss></p>
          </div>
        )}
        {v.alt.map((a, k) => (
          <details key={k} className="v-alt card-soft mt-6 max-w-[76ch] p-5">
            <summary className="font-semibold">Secondary reading · {a.by}</summary>
            <p className="reading mt-2 text-[16px]">{a.text}</p>
            <p className="mt-1 text-[12.5px] text-text-3">{a.cite}</p>
          </details>
        ))}
        {v.words && v.words.length > 0 && <div className="mt-8 max-w-[80ch]"><WordStrip words={v.words} /></div>}
        {stems.length > 0 && (
          <div className="mt-6 max-w-[80ch]">
            <p className="eyebrow mb-2">Key words here</p>
            <div className="flex flex-wrap gap-1.5">{stems.map((s) => <CiteChip key={s} id={s} label={label(s)} className="iast" />)}</div>
          </div>
        )}
        <div className="mt-12 flex items-center justify-between gap-3 border-t border-line pt-5 text-[14px]">
          {prev ? <Link href={`/u/${up}/${prev.ref}`} className="btn btn-ghost"><IconBack size={15} /> {t.abbrev} {refLabel(prev.ref)}</Link> : <span />}
          {next ? <Link href={`/u/${up}/${next.ref}`} className="btn">{t.abbrev} {refLabel(next.ref)} <IconArrow size={15} /></Link> : <span />}
        </div>
      </article>

      {/* ── right: commentary and connections ── */}
      <aside className="scroll-thin min-w-0 space-y-6 xl:sticky xl:top-[calc(var(--nav-h)+28px)] xl:h-fit xl:max-h-[calc(100dvh-var(--nav-h)-48px)] xl:overflow-y-auto xl:pb-24 xl:pr-1">
        {b ? (
          <details className="v-bhashya card p-5" open>
            <summary className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold">{b.author === "Śaṅkara" ? "Śaṅkara’s commentary" : `Commentary · ${b.author}`} <span className="font-normal text-text-3">(bhāṣya)</span></span>
              {b.ocr && <span className="chip !text-[10.5px]" title="Read from an archive.org scan of the printed book and cleaned automatically; scanning errors remain, especially in transliterated Sanskrit">from a scan</span>}
            </summary>
            <p className="mt-1 text-[12.5px] text-text-3">tr. {b.translator}, {b.edition}{b.joint ? ` · one commentary on ${t.abbrev} ${b.joint}` : ""}</p>
            {b.note && <p className="mt-1 text-[12.5px] text-text-3">{b.note}</p>}
            <div className="reading scroll-thin mt-3 max-h-[52vh] overflow-y-auto whitespace-pre-line pr-1 text-[15px]">{b.text}</div>
            <a className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-text-3 underline" href={b.source} target="_blank" rel="noreferrer">Source: {b.source.includes("archive.org") ? "archive.org scan" : "Wisdom Library"} <IconExternal size={12} /></a>
          </details>
        ) : (
          <div className="v-bhashya rounded-2xl border border-dashed border-line-2 p-5 text-[13.5px] text-text-3">
            {t.bhashya ? `Śaṅkara’s commentary is included for ${t.commented ?? 0} passages of the ${t.iast}; not for this one yet.` : `No Śaṅkara commentary is available for the ${t.iast} on this site (${commented} passages across the thirteen have it).`}{" "}
            <Link href="/about#coverage" className="underline">Coverage</Link>
          </div>
        )}
        {rel.length > 0 && (
          <div className="card p-5">
            <p className="text-[16px] font-semibold">In the graph</p>
            <div className="mt-3 space-y-5">
              {([["TEACHES", "Teaches"], ["DIAGNOSES", "Speaks to"], ["IN_STORY", "Story"]] as const).map(([type, name]) =>
                of(type).length ? (
                  <div key={type}>
                    <p className="eyebrow">{name}</p>
                    <ul className="mt-2 space-y-2">{of(type).map((e, k) => <li key={k} className="text-[14px]"><CiteChip id={e.t} label={label(e.t)} /> {e.why && <span className="text-text-3"><Gloss max={2}>{e.why}</Gloss></span>}</li>)}</ul>
                  </div>
                ) : null,
              )}
              {[...of("CROSS_REFERENCES"), ...of("ROOTED_IN"), ...of("READ_BY")].length > 0 && (
                <div>
                  <p className="eyebrow">Parallels, roots and readings</p>
                  <ul className="mt-2 space-y-2">
                    {[...of("ROOTED_IN"), ...of("CROSS_REFERENCES"), ...of("READ_BY")].map((e, k) => {
                      const o = other(e);
                      const ext = ix.external[o];
                      const href = ext ? (ext.url ?? externalUrl(ext)) : null;
                      return (
                        <li key={k} className="text-[14px]">
                          <span className="text-text-3">{e.s === v.id ? REL_LABEL[e.type].out : REL_LABEL[e.type].in} </span>
                          {href ? <a className="cite" href={href} target="_blank" rel="noreferrer">{ext!.label} · {ext!.corpus} ↗</a> : <CiteChip id={o} label={ext ? `${ext.label} · ${ext.title ?? ext.corpus}` : label(o)} />}{" "}
                          <span className="text-text-3">{e.kind ? `${e.kind} · ` : ""}{e.why}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {of("CITES").length > 0 && (
                <div>
                  <p className="eyebrow">Śaṅkara cross-references</p>
                  <ul className="mt-2 space-y-2">
                    {of("CITES").map((e, k) => (
                      <li key={k} className="text-[14px]">
                        <span className="text-text-3">{e.s === v.id ? "Commenting here, Śaṅkara cites" : "Cited by Śaṅkara on"} </span>
                        <CiteChip id={other(e)} label={label(other(e))} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="mt-5 text-[12px] text-text-4">Links marked as teaching or speaking to a situation are editorial readings ({REL_LABEL.TEACHES.out}, {REL_LABEL.DIAGNOSES.out}), not translations.</p>
          </div>
        )}
      </aside>
      {/* three readings side by side: a full-width row under the reader, so each column keeps a readable measure */}
      {getDarshanas().passages.some((p) => p.verse === v.id) && <div className="min-w-0 xl:col-span-2 xl:col-start-2"><Darshanas data={getDarshanas()} verse={v.id} /></div>}
    </div>
  );
}
