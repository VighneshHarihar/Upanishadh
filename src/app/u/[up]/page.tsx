import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorpus, getIndex, getText } from "@/lib/server/data";
import { emblemMotif, UpanishadEmblem } from "@/components/art/UpanishadEmblem";
import { AskOpen } from "@/components/home/HomeClient";
import { Lineage, sectionOf } from "@/components/verse/Lineage";
import { ContinueReading, PlayQueue } from "@/components/verse/ReaderTools";
import { Gloss } from "@/components/ui/Glossary";
import { IconChat, IconMap } from "@/components/ui/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getIndex().texts.map((t) => ({ up: t.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ up: string }> }): Promise<Metadata> {
  const { up } = await params;
  const t = getText(up);
  const root = t?.lineage ? [`Rooted in the ${t.lineage.vedaLabel}`, sectionOf(t)].filter(Boolean).join(" · ") : "";
  const og = `/og?t=${encodeURIComponent(`${t?.iast} Upaniṣad`)}&s=${encodeURIComponent(t?.tagline ?? "")}&d=${encodeURIComponent(t?.sa ?? "")}&up=${encodeURIComponent(up)}&r=${encodeURIComponent(root)}`;
  return { title: `${t?.iast ?? ""} Upaniṣad`, description: t?.tagline, openGraph: { images: [{ url: og, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [og] } };
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
const refLabel = (ref: string) => (ref === "0" ? "śānti" : ref);

export default async function TextPage({ params }: { params: Promise<{ up: string }> }) {
  const { up } = await params;
  const t = getText(up);
  if (!t) notFound();
  const verses = getCorpus(up);
  const sections = [...new Set(verses.map((v) => v.section))];
  const track = (v: (typeof verses)[number]) => ({ id: v.id, label: `${t.abbrev} ${refLabel(v.ref)}`, src: v.audio!.mp3 });
  const chanted = verses.filter((v) => v.audio).map(track);
  const untranslated = verses.filter((v) => !v.tr).length;
  const refs = Object.fromEntries(verses.map((v) => [v.id, v.ref]));
  return (
    <div className="gutter grid gap-10 pb-28 pt-10 lg:grid-cols-[minmax(280px,360px)_1fr] xl:gap-16">
      <Ready />
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+28px)] lg:h-fit">
        <Link href="/u" className="text-[13px] text-text-3 hover:text-text">← All thirteen</Link>
        <UpanishadEmblem id={t.id} size={84} className="-ml-1.5 mt-7 block text-text-2" title={`Emblem of the ${t.iast}: ${emblemMotif(t.id)}`} />
        <p className="deva mt-4 text-[30px]" style={{ lineHeight: 1.35 }}>{t.sa}</p>
        <h1 className="display text-[44px] leading-[1.05]">{t.iast} Upaniṣad</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-text-2"><Gloss>{t.tagline}</Gloss></p>
        <div className="mt-4"><Lineage text={t} /></div>
        <p className="mt-4 text-[13px] leading-relaxed text-text-3">
          {t.count} passages{verses.some((v) => v.shanti) ? " with the śānti (peace) invocation" : ""}
          <br />
          Translation: {t.translators.join(", ")}
          {untranslated > 0 && <> · <Link href="/about#coverage" className="underline">{untranslated} passage{untranslated === 1 ? "" : "s"} in Sanskrit and IAST only</Link></>}
          <br />
          {chanted.length > 0 ? <>Chant{t.audio?.chanter ? ` by ${t.audio.chanter}` : ""}: {chanted.length} of {verses.length} passages, from upanishads.org.in</> : "No chant recording available"}
          <br />
          Śaṅkara’s commentary: {t.commented ? `${t.commented} passages` : "not available here"}
          {t.analysed ? <> · word-by-word analysis: {t.analysed}</> : null}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {t.audio?.whole && <PlayQueue tracks={[{ id: `${t.id}:whole`, label: `${t.iast} Upaniṣad · full recitation`, src: t.audio.whole }]} title={`${t.iast} · full`} label="Play Full Upanishad" />}
          {chanted.length > 1 && <PlayQueue tracks={chanted} title={`${t.iast} Upaniṣad`} label="Play mantra by mantra" />}
          <ContinueReading up={t.id} refs={refs} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={`/map?node=up:${t.id}`} className="btn btn-sm"><IconMap size={14} /> In the map</Link>
          <AskOpen className="btn btn-sm btn-ghost" question={`What is the ${t.iast} Upanishad about, and where should I begin?`}><IconChat size={14} /> Ask about it</AskOpen>
        </div>
        {sections.length > 1 && (
          <nav className="scroll-thin mt-8 hidden max-h-[38vh] overflow-y-auto border-t border-line pt-5 lg:block" aria-label="Sections">
            <p className="eyebrow mb-2">Sections</p>
            <ul className="space-y-1 text-[13.5px]">
              {sections.map((s) => (
                <li key={s}><a href={`#${slug(s)}`} className="text-text-3 hover:text-text">{s}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </aside>
      <div className="min-w-0">
        {sections.map((s) => {
          const list = verses.filter((v) => v.section === s);
          const sectionTracks = list.filter((v) => v.audio).map(track);
          return (
            <section key={s} id={slug(s)} className="mb-10 scroll-mt-[calc(var(--nav-h)+20px)]">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <h2 className="eyebrow">{s}</h2>
                {sectionTracks.length > 1 && <PlayQueue tracks={sectionTracks} title={`${t.iast} · ${s}`} label="Play chapter" />}
              </div>
              <ul className="divide-y divide-line">
                {list.map((v) => (
                  <li key={v.id}>
                    <Link href={`/u/${up}/${v.ref}`} className="grid gap-x-8 gap-y-1 rounded-lg px-2 py-4 transition hover:bg-surface-2 md:grid-cols-[6.5rem_minmax(0,1.05fr)_minmax(0,1fr)]">
                      <span className="num pt-1 text-[13px] font-semibold text-text-3">
                        {t.abbrev} {refLabel(v.ref)}
                        {v.hasBhashya && <span className="chip chip-accent ml-0 mt-2 !text-[10.5px] md:flex md:w-fit">Śaṅkara</span>}
                      </span>
                      <span className="deva text-[17px]" style={{ lineHeight: 1.85 }}>{v.sa.slice(0, 2).map((l, k) => <span key={k} className="block">{l}</span>)}</span>
                      <span className="line-clamp-3 text-[14px] leading-relaxed text-text-2">{v.tr?.text ?? <span className="iast text-text-3">{v.iast.slice(0, 2).join(" ")}</span>}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
