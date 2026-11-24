import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getFacts, getIndex } from "@/lib/server/data";
import { VEDA_ORDER } from "@/lib/core/layout";
import { Art } from "@/components/ui/Art";
import { UpanishadEmblem } from "@/components/art/UpanishadEmblem";

export const metadata: Metadata = { title: "Read the 13 Principal Upanishads", description: "All thirteen Principal Upanishads, grouped by the Veda each one distils: Devanagari, IAST, translation, chant and Śaṅkara’s commentary." };

export default function TextsPage() {
  const ix = getIndex();
  const facts = getFacts();
  const byVeda = VEDA_ORDER.map((v) => ({ veda: ix.vedas.find((x) => x.id === v)!, texts: ix.texts.filter((t) => t.lineage?.veda === v).sort((a, b) => (b.lineage?.section ?? "").localeCompare(a.lineage?.section ?? "") || a.order - b.order) })).filter((g) => g.veda && g.texts.length);
  return (
    <>
      <Ready />
      <Art name="two-birds" alt="Two luminous birds on one tree" className="flex min-h-[clamp(380px,52vh,560px)] items-end" position="50% 58%">
        <div className="gutter on-art w-full pb-14 pt-24">
          <p className="eyebrow !text-[rgba(241,239,233,0.62)]">Read</p>
          <h1 className="display mt-3 text-[clamp(40px,5vw,76px)] leading-[1.02]">The 13 Principal Upanishads</h1>
          <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-[rgba(241,239,233,0.85)]">
            {facts.mantras.total.toLocaleString()} passages and {facts.shanti} peace invocations, every one in Devanagari and IAST, {facts.translatedVerses.toLocaleString()} with an English translation, {facts.audioVerses} chanted, and Śaṅkara&apos;s commentary on {facts.bhashyaVerses.toLocaleString()}. Grouped by the Veda each one distils.
          </p>
        </div>
      </Art>
      <div className="gutter pb-24">
        {byVeda.map(({ veda, texts }) => (
          <section key={veda.id} className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="display text-[28px]">{veda.label} <span className="deva text-[20px] text-text-3">{veda.sa}</span></h2>
              <Link href={`/map?node=veda:${veda.id}&roots=1`} className="max-w-[60ch] text-[13px] text-text-3 hover:text-text">{veda.essence}</Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {texts.map((t) => (
                <Link key={t.id} href={`/u/${t.id}`} className="tile group flex min-h-[230px] flex-col p-6">
                  <span className="flex items-start justify-between gap-3">
                    <UpanishadEmblem id={t.id} size={52} className="-ml-1 -mt-1 shrink-0 text-text-2 transition-colors group-hover:text-text" />
                    <span className="text-[12px] text-text-4">{t.count} passages</span>
                  </span>
                  <span className="deva mt-5 text-[22px] text-text-2" style={{ lineHeight: 1.3 }}>{t.sa}</span>
                  <span className="display mt-1 text-[28px]">{t.iast}</span>
                  <span className="mt-2 text-[14px] leading-relaxed text-text-3">{t.tagline}</span>
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-5 text-[11.5px] text-text-4">
                    {t.lineage?.sectionLabel && (<><span className="text-text-3">{t.lineage.sectionLabel.split(" ")[0]} section</span><span>·</span></>)}
                    <span>{t.lineage?.school}</span>
                    <span>·</span>
                    <span>{t.audio ? "chant" : "no chant"}</span>
                    <span>·</span>
                    <span>{t.commented ? `bhāṣya ${t.commented}` : "no bhāṣya"}</span>
                    {t.translation === "partial" && (<><span>·</span><span>English in part</span></>)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
