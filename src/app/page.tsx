import Link from "next/link";
import { getCorpus, getFacts, getGraph, getIndex, getPaths } from "@/lib/server/data";
import { VEDA_ORDER } from "@/lib/core/layout";
import type { GEdge, GNode } from "@/lib/core/types";
import { Art } from "@/components/ui/Art";
import { AskOpen, HomeAsk, HomeReady, VedaMiniMap } from "@/components/home/HomeClient";
import { AudioButton } from "@/components/verse/AudioButton";
import { CiteChip } from "@/components/verse/Drawer";
import { SUGGESTIONS } from "@/components/ask/suggestions";
import { UpanishadEmblem } from "@/components/art/UpanishadEmblem";
import { IconArrow, IconBook, IconChat, IconMap, IconOrbit, IconRoute, IconScale } from "@/components/ui/Icons";

// The front door is the Upanishads themselves: the Vedas they distil, the texts, the ways in. The Alignment Harness
// is a lab built on the same graph and lives in its own tab, with one quiet pointer lower on this page.
export default function Home() {
  const facts = getFacts();
  const ix = getIndex();
  const graph = getGraph();
  const paths = getPaths();
  const quick = paths.reduce((a, b) => (b.minutes < a.minutes ? b : a), paths[0]);
  const verse = (up: string, id: string) => getCorpus(up).find((v) => v.id === id)!;
  const birds = verse("mundaka", "MuU_3.1.1");
  const chariot = verse("katha", "KaU_1.3.3");
  const horses = verse("katha", "KaU_1.3.4");
  // The Veda → Upanishad map: the four Vedas, and the thirteen texts that distil them (Śukla before Kṛṣṇa).
  const vedaNodes: GNode[] = [
    ...VEDA_ORDER.map((v) => graph.nodes.find((n) => n.id === `veda:${v}`)!),
    ...VEDA_ORDER.flatMap((v) => ix.texts.filter((t) => t.lineage?.veda === v).sort((x, y) => (y.lineage?.section ?? "").localeCompare(x.lineage?.section ?? "") || x.order - y.order)).map((t) => graph.nodes.find((n) => n.id === `up:${t.id}`)!),
  ].filter(Boolean).map((n) => ({ ...n, sub: undefined }));
  const vedaEdges: GEdge[] = ix.texts.map((t) => ({ s: `veda:${t.lineage?.veda}`, t: `up:${t.id}`, type: "PART_OF", basis: "text" }));
  const quiet = "btn btn-outline btn-lg !border-[rgba(255,255,255,0.3)] !text-white hover:!bg-[rgba(255,255,255,0.08)]";

  return (
    <>
      <HomeReady />
      {/* ── 1 · Hero: sit near ──────────────────────────────────────────────────────────── */}
      <Art name="hero-wide" portrait="hero-portrait" alt="A boy sits with a lamp at the door of a forest temple before dawn" eager className="hero grain flex items-end" imgClassName="kenburns" position="70% 60%">
        <div className="gutter on-art relative w-full pb-[max(112px,9vh)] pt-[calc(var(--nav-h)+12vh)]">
          <div className="max-w-[min(900px,66vw)] max-md:max-w-none">
            <p className="rise flex flex-wrap items-baseline gap-x-3 text-[#f3cf7a]">
              <span className="deva text-[clamp(18px,1.7vw,24px)]" style={{ lineHeight: 1.5 }}>उप · नि · षद्</span>
              <span className="text-[13.5px] tracking-wide text-[rgba(243,207,122,0.8)]"><i>upa-ni-ṣad</i>: to sit down near</span>
            </p>
            <h1 className="display hero-title rise rise-2 mt-3 !text-[clamp(44px,5.8vw,96px)]">Sit near the Upanishads.</h1>
            <p className="display rise rise-2 mt-3 text-[clamp(22px,2.3vw,36px)] leading-tight text-[#f3cf7a]">Four Vedas. Thirteen Principal Upanishads. One essence.</p>
            <p className="rise rise-3 mt-6 max-w-[660px] text-[clamp(16px,1.25vw,19px)] leading-relaxed text-[rgba(241,239,233,0.86)]">
              Each Upanishad closes a Veda: its <i>Vedānta</i>, the end of the Veda, and its <i>sāra</i>, the essence. Here are all thirteen, every passage in Devanagari, IAST and English, with the chant, Śaṅkara&apos;s commentary, and a map that traces each one back to the Veda it distils.
            </p>
            <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
              <Link href={`/paths/${quick.id}`} className="btn btn-accent btn-lg"><IconRoute size={18} /> Start a {quick.minutes}-Min Guided Path</Link>
              <Link href="/u" className={quiet}><IconBook size={17} /> Browse the 13 Upanishads</Link>
              <Link href="/map" className={quiet}><IconOrbit size={17} /> Explore the Graph</Link>
            </div>
          </div>
          <div className="stat-row rise rise-4 mt-[clamp(40px,8vh,96px)] border-t border-[rgba(255,255,255,0.14)] pt-6">
            <div><b>{facts.texts.total}</b><span>Upanishads</span></div>
            <div><b>{facts.mantras.total.toLocaleString()}</b><span>Passages</span></div>
            <div><b>{facts.bhashyaVerses.toLocaleString()}</b><span>With Śaṅkara</span></div>
            <div><b>{facts.audioVerses}</b><span>Chanted</span></div>
            <div><b>{facts.semanticEdges.toLocaleString()}</b><span>Meaningful links</span></div>
            <div className="ml-auto hidden max-w-[300px] self-end text-right text-[12.5px] leading-snug text-[rgba(241,239,233,0.6)] xl:block">
              “Arise, awake, and learn by approaching the exalted ones.” <CiteChip id="KaU_1.3.14" label="KaU 1.3.14" />
            </div>
          </div>
        </div>
      </Art>

      {/* ── 2 · Veda → Upanishad: the mini-map ───────────────────────────────────────────── */}
      <section id="vedas" className="border-b border-line bg-[var(--bg-2)] py-[clamp(64px,10vh,120px)]">
        <div className="gutter grid items-center gap-10 lg:grid-cols-[minmax(320px,0.7fr)_1.3fr] xl:gap-16">
          <div>
            <p className="eyebrow">Veda-Sāra · the roots</p>
            <h2 className="display band-title mt-3">From four Vedas to thirteen Upanishads.</h2>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-text-2">
              The Ṛgveda, the Yajurveda in its Śukla and Kṛṣṇa sections, the Sāmaveda and the Atharvaveda each close in Upanishads. Click a Veda to see its texts, a text to open its passages, and follow a mantra back to the Saṃhitā hymn it takes up, like the two birds of <CiteChip id="MuU_3.1.1" label="MuU 3.1.1" />, first sung in the Ṛgveda.
            </p>
            <ul className="mt-7 space-y-3 text-[15px]">
              {[
                [`${facts.concepts} ideas, ${facts.stories} stories, ${facts.persons} teachers and seekers`, "each linked to the passages that carry it; click any Sanskrit word to find it in every text"],
                [`${facts.shankaraLinks} Śaṅkara cross-references`, "where his commentary on one passage cites another"],
                [`${facts.vedaSaraLinks} Veda-Sāra links`, "into the Saṃhitās, the Gītā and the Brahma Sūtra, each checked against the text"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-[11px] h-px w-4 shrink-0 bg-[var(--gold)]" aria-hidden />
                  <span><b className="font-semibold">{t}</b><span className="block text-text-3">{d}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/map?roots=1" className="btn btn-accent btn-lg"><IconMap size={17} /> Explore the Graph</Link>
              <Link href="/u" className="btn btn-lg"><IconBook size={17} /> The library</Link>
            </div>
          </div>
          <div className="card overflow-hidden p-2">
            <VedaMiniMap nodes={vedaNodes} edges={vedaEdges} height={660} />
          </div>
        </div>
      </section>

      {/* ── 3 · Read: the two birds ──────────────────────────────────────────────────────── */}
      <section className="gutter grid items-center gap-10 py-[clamp(72px,11vh,140px)] lg:grid-cols-[1fr_1.15fr] xl:gap-20">
        <Art name="two-birds" alt="Two luminous birds on one tree; one eats the fruit, the other watches" shade="none" className="h-[clamp(420px,78vh,820px)] rounded-[28px] border border-line-2" position="50% 55%" />
        <div>
          <p className="eyebrow">Read · Muṇḍaka Upaniṣad 3.1.1 · Śvetāśvatara 4.6</p>
          <h2 className="display band-title mt-3">Read it the way it was written.</h2>
          <div className="mt-8 border-l-2 border-[var(--gold)] pl-6">
            <div className="deva text-[clamp(20px,1.7vw,26px)]">{birds.sa.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div className="iast mt-3 text-[15.5px]">{birds.iast.map((l, i) => <div key={i}>{l}</div>)}</div>
            <p className="reading mt-4 max-w-[60ch] text-[17px]">{birds.tr?.text}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {birds.audio && <AudioButton src={birds.audio.mp3} label="Hear the chant" track={{ id: birds.id, label: "MuU 3.1.1" }} />}
              <span className="text-[12.5px] text-text-3">{birds.tr?.by}</span>
            </div>
          </div>
          <ul className="mt-9 grid gap-x-8 gap-y-3 text-[14.5px] text-text-2 sm:grid-cols-2">
            <li><b className="text-text">Devanagari and IAST</b>, toggle either; every word looked up</li>
            <li><b className="text-text">English for all {facts.translatedVerses.toLocaleString()}</b> passages</li>
            <li><b className="text-text">Śaṅkara&apos;s commentary</b> on {facts.bhashyaVerses.toLocaleString()} passages</li>
            <li><b className="text-text">The chant</b> for {facts.audioVerses} mantras, with speed and loop</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/u/mundaka/3.1.1" className="btn btn-lg"><IconBook size={17} /> Open the reader</Link>
            <AskOpen question="Explain the two birds on one tree." className="btn btn-ghost btn-lg">Ask about the two birds <IconArrow size={15} /></AskOpen>
          </div>
        </div>
      </section>

      {/* ── 4 · Paths ────────────────────────────────────────────────────────────────────── */}
      <section className="gutter border-t border-line py-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Guided paths</p>
            <h2 className="display band-title mt-3">{paths.length} walks through the texts.</h2>
          </div>
          <Link href="/paths" className="btn">All paths <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {paths.map((p, i) => (
            <Link key={p.id} href={`/paths/${p.id}`} className="tile group flex min-h-[230px] flex-col p-6">
              <span className="num text-[13px] text-text-4">0{i + 1}</span>
              <span className="display mt-6 text-[24px] leading-tight">{p.title}</span>
              <span className="mt-2 text-[14px] text-text-3">{p.subtitle}</span>
              <span className="mt-auto flex items-center justify-between pt-6 text-[12.5px] text-text-3">
                <span>{p.steps.length} steps · {p.minutes} min</span>
                <IconArrow size={16} className="transition group-hover:translate-x-1 group-hover:text-accent" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 5 · The thirteen ─────────────────────────────────────────────────────────────── */}
      <section className="gutter pb-[clamp(72px,11vh,130px)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">The texts</p>
            <h2 className="display band-title mt-3">Thirteen Upanishads. Every passage.</h2>
          </div>
          <Link href="/u" className="btn">Open the library <IconArrow size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {ix.texts.map((t) => (
            <Link key={t.id} href={`/u/${t.id}`} className="tile group flex items-start gap-5 p-6">
              <UpanishadEmblem id={t.id} size={52} className="-my-1 -ml-1 shrink-0 text-text-2 transition-colors group-hover:text-text" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="display text-[24px]">{t.iast}</span>
                  <span className="deva text-[17px] text-text-3" style={{ lineHeight: 1.2 }}>{t.sa}</span>
                </span>
                <span className="mt-2 block text-[14px] leading-relaxed text-text-3">{t.tagline}</span>
                <span className="mt-4 block text-[12px] text-text-4">{t.count} passages · {t.lineage?.vedaLabel ?? t.veda}{t.lineage?.sectionLabel ? ` · ${t.lineage.sectionLabel.split(" ")[0]} section` : ""}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 6 · Ask ──────────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-line py-[clamp(72px,11vh,130px)]">
        <div className="gutter relative mx-auto max-w-[1100px] text-center">
          <span className="mx-auto mb-5 block h-px w-10 bg-[var(--gold)]" aria-hidden />
          <p className="eyebrow">Chat with the graph</p>
          <h2 className="display band-title mt-3">Ask the Upanishads.</h2>
          <p className="mx-auto mt-4 max-w-[62ch] text-[16.5px] leading-relaxed text-text-2">
            The graph finds the mantras, ideas and stories that bear on your question and answers from them. Connect a model with your own key for written answers; every citation is checked against the texts before you see it. Your conversations stay in this browser.
          </p>
          <div className="mt-9">
            <HomeAsk suggestions={SUGGESTIONS.slice(0, 5)} />
          </div>
        </div>
      </section>

      {/* ── 7 · The name: the chariot ────────────────────────────────────────────────────── */}
      <Art name="chariot" alt="A chariot with four horses races through morning mist, a charioteer at the reins" shade="light" className="flex min-h-[clamp(560px,86vh,900px)] items-center" position="62% 50%">
        <div className="gutter on-light w-full py-24">
          <div className="max-w-[min(600px,48vw)] max-md:max-w-none max-md:rounded-2xl max-md:bg-[rgba(238,238,233,0.86)] max-md:p-6">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[rgba(25,27,24,0.6)]">Why “UpaSārathi”</p>
            <h2 className="display band-title mt-3">The charioteer who sits near.</h2>
            <p className="deva mt-6 text-[clamp(18px,1.5vw,22px)] text-[#5a3d0c]">{chariot.sa[0]}</p>
            <p className="reading mt-2 text-[17px] !text-[#232521]">
              “{chariot.tr?.text} {horses.tr?.text?.split(".")[0]}.” <CiteChip id="KaU_1.3.3" label="KaU 1.3.3" /> <CiteChip id="KaU_1.3.4" label="1.3.4" />
            </p>
            <p className="mt-5 text-[16px] leading-relaxed text-[rgba(25,27,24,0.78)]">
              <i>Sārathi</i> is the charioteer; <i>upa</i>, near. The Kaṭha&apos;s image of the self in a chariot, the intellect at the reins and the senses as horses, is the way in: a guide that sits near, holds to the text, and points back to the way.
            </p>
            <Link href="/paths/chariot" className="btn btn-lg mt-8 !border-transparent !bg-[#191b18] !text-[#f1efe9] hover:!bg-[#2a2d29]"><IconRoute size={17} /> Walk the chariot path</Link>
          </div>
        </div>
      </Art>

      {/* ── 8 · The lab (secondary) ──────────────────────────────────────────────────────── */}
      <section className="gutter py-[clamp(56px,8vh,96px)]">
        <Link href="/harness" className="tile group grid items-center gap-6 p-7 md:grid-cols-[auto_1fr_auto] md:p-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line-2 text-[var(--gold)]"><IconScale size={26} /></span>
          <span>
            <span className="eyebrow">The lab · built on this graph</span>
            <span className="display mt-2 block text-[clamp(22px,2vw,30px)] leading-tight">The Alignment Harness</span>
            <span className="mt-2 block max-w-[78ch] text-[14.5px] leading-relaxed text-text-3">
              An engineering experiment that uses these passages as evidence: the same AI model answers three ways, a blind judge scores them, and every quotation is checked against the thirteen texts. Recorded runs, replays and a downloadable tool.
            </span>
          </span>
          <span className="btn">Open the lab <IconArrow size={15} className="transition group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* ── 9 · Close ────────────────────────────────────────────────────────────────────── */}
      <Art name="ashram" alt="A teacher and students seated in a circle beneath a great banyan by a river" shade="center" className="flex min-h-[clamp(560px,88vh,900px)] items-center" position="50% 60%">
        <div className="gutter on-art w-full py-24 text-center">
          <p className="deva text-[clamp(18px,1.6vw,24px)] text-[#f3cf7a]">उत्तिष्ठत जाग्रत प्राप्य वरान्निबोधत</p>
          <h2 className="display mt-3 text-[clamp(44px,6vw,96px)] leading-[1.02]">Arise. Awake.</h2>
          <p className="mx-auto mt-5 max-w-[54ch] text-[17px] leading-relaxed text-[rgba(241,239,233,0.85)]">
            “Arise, awake, and learn by approaching the exalted ones.” The Upanishads were taught like this: a few students, a teacher, a question. Bring yours. <CiteChip id="KaU_1.3.14" label="KaU 1.3.14" />
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={`/paths/${quick.id}`} className="btn btn-accent btn-lg"><IconRoute size={18} /> Start the {quick.minutes}-minute path</Link>
            <AskOpen className={quiet}><IconChat size={17} /> Ask a question</AskOpen>
          </div>
        </div>
      </Art>
    </>
  );
}
