import Link from "next/link";
import type { Metadata } from "next";
import { Ready } from "@/components/ui/Ready";
import { getCorpus, getFacts, getIndex, getRubric } from "@/lib/server/data";
import { getBench } from "@/lib/server/bench";
import { VEDA_ORDER } from "@/lib/core/layout";
import { SIDES, SIDE_LABEL } from "@/lib/core/judge";
import { GITAVISWA_URL, SAMHITA_LINKS, VEDANVAYA_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "About · sources, method and coverage",
  description: "Where every text, translation, chant and commentary comes from; how the Veda-Sāra lineage and the knowledge graph are built; how the three-way AI test works; and exactly what is missing.",
};

const SRC: Record<string, { sa: string; note?: string }> = {
  kaushitaki: { sa: "Sanskrit Wikisource (कौषीतकिब्राह्मणोपनिषत्), transliterated to IAST here", note: "Wikisource recension, four adhyāyas." },
  maitri: { sa: "Sanskrit Wikisource (मैत्रायण्युपनिषत्), transliterated to IAST here", note: "Wikisource numbering of seven prapāṭhakas; other editions divide the later chapters differently." },
};
const RECENSION: Record<string, string> = {
  isha: "Kāṇva recension (Vājasaneyi Saṃhitā 40, 18 mantras); the Mādhyandina orders the last verses differently.",
  kena: "Jaiminīya (Talavakāra) text, four khaṇḍas.",
  katha: "Two adhyāyas of three vallīs each.",
  brihadaranyaka: "Kāṇva recension, the one Śaṅkara commented on; the Mādhyandina (Śatapatha Brāhmaṇa 14) differs in order and numbering.",
  chandogya: "Kauthuma text, eight prapāṭhakas.",
  taittiriya: "Three vallīs: Śikṣā, Brahmānanda, Bhṛgu.",
  mandukya: "Twelve mantras; Gauḍapāda’s Kārikā is not included.",
  shvetashvatara: "Six adhyāyas. The bhāṣya given here is traditionally attributed to Śaṅkara; many scholars hold it to be by a later Advaitin, and every passage says so.",
  maitri: "Also called the Maitrāyaṇīya. Lineage follows its Maitrāyaṇī school; the Muktikā list places it in the Sāmaveda.",
};

export default function AboutPage() {
  const ix = getIndex();
  const facts = getFacts();
  const rubric = getRubric();
  const bench = getBench();
  const rows = ix.texts.map((t) => {
    const vs = getCorpus(t.id);
    return {
      t,
      total: vs.length,
      translated: vs.filter((v) => v.tr).length,
      untranslated: vs.filter((v) => !v.tr).map((v) => v.ref),
      audio: vs.filter((v) => v.audio).length,
      bhashya: vs.filter((v) => v.hasBhashya).length,
      words: vs.filter((v) => v.words?.length).length,
      shanti: vs.some((v) => v.shanti),
    };
  });
  const byVeda = VEDA_ORDER.map((v) => ({ veda: ix.vedas.find((x) => x.id === v)!, texts: ix.texts.filter((t) => t.lineage?.veda === v) }));
  const noAudio = rows.filter((r) => r.audio <= (r.shanti ? 1 : 0));
  const partialAudio = rows.filter((r) => r.audio > 1 && r.audio < r.total);
  const noBhashya = rows.filter((r) => r.bhashya === 0);
  const untranslated = rows.filter((r) => r.untranslated.length);

  return (
    <div className="gutter pb-28 pt-12">
      <Ready />
      <div className="max-w-[880px]">
        <p className="eyebrow">About</p>
        <h1 className="display mt-3 text-[clamp(38px,4.6vw,64px)] leading-[1.04]">Four Vedas. Thirteen Principal Upanishads. One essence.</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-text-2">
          UpaSārathi sets the thirteen Principal Upanishads beside each other as a knowledge graph and roots each in its Veda: every passage in Devanagari, IAST and English, with the chant, Śaṅkara’s commentary and a word-by-word reading. A lab built on the same graph uses the texts to test AI answers: does an answer serve the person, or please them? It is a reflective and research tool, not a religious authority or personal advice. Everything that is an editorial reading (a takeaway, a concept link, a situation a verse speaks to) is labelled as editorial.
        </p>
        <nav className="mt-8 flex flex-wrap gap-2 text-[13.5px]" aria-label="On this page">
          {[["sources", "Sources"], ["coverage", "Coverage and gaps"], ["veda-sara", "Veda-Sāra"], ["graph", "The graph"], ["method", "3-way method"], ["glossary", "Glossary"], ["privacy", "Privacy"], ["credits", "Credits"]].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="chip">{l}</a>
          ))}
        </nav>
      </div>

      {/* ── facts ── */}
      <section className="mt-14 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [facts.texts.total, "Upanishads"],
          [facts.mantras.total.toLocaleString(), "passages"],
          [facts.shanti, "śānti mantras"],
          [facts.translatedVerses.toLocaleString(), "translated"],
          [facts.audioVerses, "chanted"],
          [facts.bhashyaVerses, "with Śaṅkara’s bhāṣya"],
          [facts.analysedVerses.toLocaleString(), "word by word"],
          [facts.concepts, "concepts"],
          [facts.stories, "stories"],
          [facts.stems, "key words"],
          [facts.lemmas.toLocaleString(), "lemmas indexed"],
          [facts.semanticEdges.toLocaleString(), "meaningful links"],
        ].map(([n, l]) => (
          <div key={String(l)} className="tile p-4">
            <p className="num text-[26px] font-semibold">{n}</p>
            <p className="text-[12.5px] text-text-3">{l}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-[12px] text-text-4">Corpus hash {facts.corpusHash}: every recorded AI run states the hash it was made against, and the build re-checks them. When the corpus grows, runs recorded against an earlier version are re-verified against today’s and carried forward only if every check still passes; each keeps the fingerprint it was first recorded against.</p>

      {/* ── sources ── */}
      <section id="sources" className="mt-20 scroll-mt-24">
        <h2 className="display text-[32px]">Sources and translators</h2>
        <p className="mt-3 max-w-[80ch] text-[15px] leading-relaxed text-text-2">
          Devanagari, IAST, word-by-word analysis and the chant come from <a className="underline" href="https://upanishads.org.in/" target="_blank" rel="noreferrer">upanishads.org.in</a> (except where noted). English translations are in the tradition of Śaṅkara, from the Advaita Ashrama and Sri Ramakrishna Math editions as published there; a second reading by Sri Aurobindo appears where available. Śaṅkara’s commentary (bhāṣya) is quoted from the English translations at <a className="underline" href="https://www.wisdomlib.org/" target="_blank" rel="noreferrer">Wisdom Library</a> (Ganganatha Jha’s Chāndogya, Swami Mādhavānanda’s Bṛhadāraṇyaka, and the shorter texts), with the edition named on every passage.
        </p>
        <p className="mt-3 max-w-[80ch] text-[15px] leading-relaxed text-text-2">
          Some texts exist only in print. Swami Gambhīrānanda’s translations of the commentary on the Taittirīya and Aitareya (<i>Eight Upaniṣads</i>) and on the Śvetāśvatara, and R. E. Hume’s 1921 translation of the later Maitrī, are read from scans of the printed books at <a className="underline" href="https://archive.org/" target="_blank" rel="noreferrer">archive.org</a> and cleaned automatically; these passages are marked “from a scan”, and scanning errors remain, mostly in transliterated Sanskrit words. Word-by-word analysis comes from upanishads.org.in where it has it, then from the gold annotation of Oliver Hellwig’s <a className="underline" href="https://github.com/OliverHellwig/sanskrit" target="_blank" rel="noreferrer">Digital Corpus of Sanskrit</a>, and for the Maitrī and most of the Kauṣītaki from an automatic analysis (the Dharmamitra segmenter and the vidyut dictionary), which each passage labels as automatic.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="bench-table w-full min-w-[900px] text-[13.5px]">
            <thead>
              <tr>
                <th className="text-left">Upanishad</th>
                <th className="text-left">Text</th>
                <th className="text-left">Translation</th>
                <th className="text-right">Translated</th>
                <th className="text-right">Chanted</th>
                <th className="text-right">Bhāṣya</th>
                <th className="text-right">Word by word</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t.id}>
                  <td><Link href={`/u/${r.t.id}`} className="font-semibold hover:text-accent">{r.t.iast}</Link><br /><span className="text-[12px] text-text-3">{r.total} passages{r.shanti ? " incl. śānti" : ""}</span></td>
                  <td className="max-w-[280px] text-[12.5px] text-text-2">{SRC[r.t.id]?.sa ?? "upanishads.org.in"}{RECENSION[r.t.id] && <span className="block text-text-3">{RECENSION[r.t.id]}</span>}</td>
                  <td className="text-[12.5px] text-text-2">{r.t.translators.join(", ")}{r.t.translation === "partial" && <span className="block text-text-3">English in part</span>}</td>
                  <td className="num text-right">{r.translated}/{r.total}</td>
                  <td className="num text-right">{r.audio}/{r.total}</td>
                  <td className="num text-right">{r.bhashya || "–"}{r.t.bhashya && <span className="block text-[11.5px] font-normal text-text-3">{r.t.bhashya.translator}</span>}</td>
                  <td className="num text-right">{r.words || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── coverage ── */}
      <section id="coverage" className="mt-20 max-w-[920px] scroll-mt-24">
        <h2 className="display text-[32px]">Coverage, gaps and edge cases</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-2">Every passage of all thirteen texts is here in Devanagari and IAST. Where something else is missing, the site says so instead of showing an empty control: no play button without a recording, no commentary box without commentary.</p>
        <ul className="mt-6 space-y-4 text-[14.5px] leading-relaxed text-text-2">
          <li>
            <b className="text-text">No chant recording:</b> {noAudio.map((r) => r.t.iast).join(", ")}{noAudio.some((r) => r.shanti) ? " (the śānti invocation only, where one exists)" : ""}. <b className="text-text">Partial:</b>{" "}
            {partialAudio.map((r) => `${r.t.iast} ${r.audio}/${r.total}`).join(" · ")}. Whole-text recordings, where they exist, play from each text’s page (“Play Full Upanishad”); they are long, uncompressed files.
          </li>
          <li><b className="text-text">No Śaṅkara commentary:</b> {noBhashya.map((r) => r.t.iast).join(" and ")}, on which Śaṅkara wrote none. Elsewhere the commentary is given passage by passage; where he comments on several mantras at once each of them says so, and the few he passes over (repeated formulas such as BU 3.7.4–22, and the lineage lists) have none: {rows.filter((r) => r.bhashya > 0 && r.bhashya < r.total - (r.shanti ? 1 : 0)).map((r) => `${r.t.iast} ${r.bhashya}/${r.total - (r.shanti ? 1 : 0)}`).join(" · ")}.</li>
          <li>
            <b className="text-text">Sanskrit and IAST only, no English yet:</b>{" "}
            {untranslated.map((r) => `${r.t.iast} ${r.untranslated.length > 6 ? `${r.untranslated.length} passages` : r.untranslated.join(", ")}`).join(" · ")}.
          </li>
          <li><b className="text-text">The Maitrī</b> follows Wikisource’s numbering. Its English for prapāṭhakas 1–4 (Krishna Warrier) is given per chapter, so a passage there shows its chapter’s translation, labelled as such; prapāṭhakas 5–7 are translated section by section from R. E. Hume (1921), read from a scan.</li>
          <li><b className="text-text">The Kauṣītaki</b> follows the Wikisource recension; its English (Krishna Warrier) is per passage where the edition aligns.</li>
          <li><b className="text-text">Word-by-word analysis</b> covers {facts.analysedVerses.toLocaleString()} passages, every one of the thirteen texts. The automatic analysis of the Maitrī and most of the Kauṣītaki is good but not perfect: it was measured at 0.96 precision for words and 0.88 for dictionary forms on a held-out text, and an occasional compound is split wrongly.</li>
          <li><b className="text-text">Chant:</b> passages with no human recording offer an optional <i>AI chant</i> made in your browser by the Vāgdhenu model (a one-time download of about 321 MB, kept in the browser). It is always labelled “AI Chant · Vāgdhenu (classical meter, no Vedic svaras)” and never replaces a recording. English translations and commentary can also be read aloud, sentence by sentence: by Piper’s Alan voice (British English; about 94 MB once, kept in the browser, then it works offline) or instantly by your browser’s own voice.</li>
          <li><b className="text-text">Joint translations:</b> some translators render two or three mantras together; each such passage says so (“translated together as …”).</li>
          <li><b className="text-text">Takeaways</b> (the “in plain English” boxes) are editorial, written for {facts.anchors > 0 ? "key passages" : "a few passages"}, and never stand in for the translation.</li>
          <li><b className="text-text">Saṃhitā links</b> go to {SAMHITA_LINKS === "vedanvaya" ? <a className="underline" href={VEDANVAYA_URL} target="_blank" rel="noreferrer">VedAnvaya</a> : SAMHITA_LINKS === "wikisource" ? <>the hymn or chapter on <a className="underline" href="https://sa.wikisource.org/" target="_blank" rel="noreferrer">Sanskrit Wikisource</a></> : "nowhere in this deployment (they show as plain references)"}; Gītā links go to <a className="underline" href={GITAVISWA_URL} target="_blank" rel="noreferrer">GitaViśva</a>. Each Saṃhitā parallel is checked word for word against the VedAnvaya text when the site is built.</li>
        </ul>
      </section>

      {/* ── veda-sara ── */}
      <section id="veda-sara" className="mt-20 scroll-mt-24">
        <h2 className="display text-[32px]">Veda-Sāra: each Upanishad and its Veda</h2>
        <p className="mt-3 max-w-[80ch] text-[15px] leading-relaxed text-text-2">
          The Upanishads close the four Vedas (Vedānta, “the end of the Veda”) and distil them (<i>sāra</i>, essence). The Yajurveda is one Veda in two sections, Śukla (“white”) and Kṛṣṇa (“black”); its texts name their section. Each text is linked to its Veda, school (śākhā) and the Saṃhitā, Brāhmaṇa or Āraṇyaka it belongs to. Where an Upanishad takes up a Saṃhitā mantra, the link names it as identical or a parallel, checked against the Saṃhitā text by wording similarity at build time. Key Brahma Sūtra readings of Upanishad passages are linked as editorial.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {byVeda.map(({ veda, texts }) => (
            <div key={veda.id} className="tile p-5">
              <p className="text-[17px] font-semibold">{veda.label} <span className="deva text-[15px] text-text-3">{veda.sa}</span></p>
              <p className="mt-1 text-[13px] text-text-3">{veda.essence}</p>
              <ul className="mt-3 space-y-2 text-[13px]">
                {texts.map((t) => (
                  <li key={t.id}><Link href={`/u/${t.id}`} className="font-semibold hover:text-accent">{t.iast}</Link>{t.lineage?.sectionLabel && <span className="text-text-3"> · {t.lineage.sectionLabel.split(" ")[0]} section</span>}<span className="block text-text-3">{t.lineage?.school} · {t.lineage?.seat}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── graph ── */}
      <section id="graph" className="mt-20 max-w-[920px] scroll-mt-24">
        <h2 className="display text-[32px]">The knowledge graph</h2>
        <ul className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-text-2">
          <li><b className="text-text">{facts.nodes.toLocaleString()} nodes, {facts.edges.toLocaleString()} links</b>: Vedas, Upanishads, passages, {facts.concepts} concepts, {facts.dilemmas} human situations, {facts.stories} stories, {facts.persons} people, {facts.stems} key-word stems, and passages beyond the thirteen.</li>
          <li><b className="text-text">No dead dots.</b> The build fails if any passage lacks a meaningful link (a teaching, a story, a key word, a cross-reference) or if any node is isolated.</li>
          <li><b className="text-text">Śaṅkara cross-references</b> ({facts.shankaraLinks}): where his commentary on one passage quotes another, detected from the bhāṣya text and marked “from Śaṅkara’s bhāṣya”.</li>
          <li><b className="text-text">Mandatory passages</b> are checked by the build: the {facts.shanti} śānti mantras, the four Mahāvākyas, Uddālaka’s analogies (ChU 6.8–6.16), neti neti, Gārgī, Janaka and Yājñavalkya, Pippalāda’s six questions, the five sheaths, and the two birds (MuU 3.1.1 ↔ ŚU 4.6).</li>
          <li><b className="text-text">The map</b> opens on a focused view of at most fifteen nodes, navigable by keyboard; the whole map (grouped by Veda) and the 3D cosmos are optional views.</li>
        </ul>
      </section>

      {/* ── method ── */}
      <section id="method" className="mt-20 scroll-mt-24">
        <h2 className="display text-[32px]">The 3-way method</h2>
        <div className="mt-4 grid max-w-[1100px] grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
          <ol className="list-decimal min-w-0 space-y-3 pl-5 text-[14.5px] leading-relaxed text-text-2 [overflow-wrap:anywhere]">
            <li><b className="text-text">Baseline:</b> the model with “{rubric.baselineSystem}”.</li>
            <li><b className="text-text">Honesty control:</b> the same model with a strong honesty prompt and no scripture. The build fails if this prompt mentions any scripture term.</li>
            <li><b className="text-text">UpaSārathi:</b> the same model given an evidence packet from the graph (chosen by code, not by a model) and the Sārathi prompt; citations outside the packet are removed and one repair pass is allowed.</li>
            <li><b className="text-text">Checks:</b> every quotation is looked up. Attributed to one of the thirteen and not found: <i>fabricated</i>. From outside the thirteen: <i>outside the verified corpus</i>, never counted as false.</li>
            <li><b className="text-text">Blind judge:</b> the three answers as A, B, C in an order fixed by the prompt’s hash; scores on {rubric.axes.length} axes (0–4) are kept only when they quote their answer verbatim; totals use only the axes where all three kept verified evidence.</li>
            <li><b className="text-text">Multi-turn pushback:</b> one preset follows the first answer with “{rubric.presets.find((p) => p.followUp)?.followUp}”; the judge reads the final answer.</li>
          </ol>
          <div className="min-w-0 overflow-x-auto">
            <table className="bench-table w-full min-w-[420px] text-[13.5px]">
              <thead>
                <tr><th className="text-left">Model</th>{SIDES.map((s) => <th key={s} className="text-right">{SIDE_LABEL[s]}</th>)}<th className="text-right">Runs</th></tr>
              </thead>
              <tbody>
                {bench.models.map((m) => (
                  <tr key={m.model}><td>{m.model}<br /><span className="text-[11.5px] text-text-3">judge {m.judge}</span></td>{SIDES.map((s) => <td key={s} className="num text-right">{m.pct[s] === null ? "–" : `${m.pct[s]}%`}</td>)}<td className="num text-right">{m.complete}/{m.runs}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-text-4">Share of the maximum over comparable axes, all recorded samples. <Link href="/harness#benchmark" className="underline">Every run, replayable</Link>.</p>
          </div>
        </div>
      </section>

      {/* ── glossary ── */}
      <section id="glossary" className="mt-20 scroll-mt-24">
        <h2 className="display text-[32px]">Glossary</h2>
        <p className="mt-2 text-[14px] text-text-3">These terms are explained wherever they appear on the site: hover, tap or focus a dotted word.</p>
        <dl className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {[...ix.glossary].sort((a, b) => a.term.localeCompare(b.term)).map((g) => (
            <div key={g.id}>
              <dt className="text-[15px] font-semibold">{g.term} <span className="deva text-[14px] font-normal text-text-3">{g.sa}</span></dt>
              <dd className="text-[13.5px] leading-relaxed text-text-2">{g.short}{g.concept && <> <Link href={`/map?node=concept:${g.concept}`} className="text-accent underline underline-offset-2">map</Link></>}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── privacy ── */}
      <section id="privacy" className="mt-20 max-w-[880px] scroll-mt-24">
        <h2 className="display text-[32px]">Local-first</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-2">
          There is no account and no database. Your conversations, bookmarks, notes, reading progress and model keys are kept in this browser’s storage only. A key is sent per request to the provider you chose, through a relay that does not log or store it. Clearing site data removes everything.
        </p>
      </section>

      {/* ── credits ── */}
      <section id="credits" className="mt-20 max-w-[880px]">
        <h2 className="display text-[32px]">With gratitude</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-2">
          This site stands on the work of translators, editors, publishers and scholars. Their texts are quoted with attribution on every passage, for study and without commercial use. If you value them, buy their books.
        </p>
        <dl className="credits mt-8 grid gap-x-10 gap-y-6 text-[14.5px] leading-relaxed sm:grid-cols-2">
          {[
            ["Advaita Ashrama, Kolkata", "https://advaitaashrama.org/", "Swami Gambhīrānanda’s Eight Upaniṣads and Śvetāśvatara with Śaṅkara’s commentary; Swami Mādhavānanda’s Bṛhadāraṇyaka with Śaṅkara’s commentary."],
            ["Sri Ramakrishna Math, Chennai", "https://chennaimath.org/", "Swami Swahananda’s Chāndogya and Swami Tyāgīśānanda’s Śvetāśvatara, the translations in the tradition of Śaṅkara."],
            ["Wisdom Library", "https://www.wisdomlib.org/", "Ganganatha Jha’s Chāndogya with Śaṅkara’s commentary, Mādhavānanda’s Bṛhadāraṇyaka and the shorter bhāṣyas, carefully kept online."],
            ["upanishads.org.in", "https://upanishads.org.in/", "The Devanagari and IAST text, Sri Aurobindo’s renderings, the word-by-word analysis and the chant recordings."],
            ["Internet Archive", "https://archive.org/", "Scans of the printed editions, from which the Taittirīya, Aitareya and Śvetāśvatara commentaries and R. E. Hume’s 1921 Thirteen Principal Upanishads are read."],
            ["Digital Corpus of Sanskrit", "https://github.com/OliverHellwig/sanskrit", "Oliver Hellwig’s gold-standard morphological annotation, behind most of the word-by-word lookup."],
            ["Dharmamitra and vidyut", "https://dharmamitra.org/", "The Sanskrit segmenter and the vidyut dictionary (Ambuda) behind the automatic analysis of the Maitrī and Kauṣītaki."],
            ["Sanskrit Wikisource and GRETIL", "https://sa.wikisource.org/", "The Kauṣītaki and Maitrī texts, and the Saṃhitā texts that the Veda-Sāra parallels are checked against (through VedAnvaya)."],
            ["Vāgdhenu", "https://huggingface.co/gnumanth/sanskrit-tts-onnx", "The open Sanskrit speech model (IISc Bengaluru, ported to the browser by Hemanth HM) behind the labelled AI chant."],
            ["Piper", "https://github.com/rhasspy/piper", "Rhasspy’s open neural voice that reads the English aloud: the Alan voice from Mycroft’s Mimic 3 recordings, run in your browser by Mintplex Labs’ piper-tts-web on ONNX Runtime, with espeak-ng for pronunciation."],
          ].map(([name, href, what]) => (
            <div key={name} className="border-t border-line pt-4">
              <dt className="font-semibold"><a href={href} target="_blank" rel="noreferrer" className="underline decoration-[var(--line-3)] underline-offset-4 hover:decoration-[var(--gold)]">{name}</a></dt>
              <dd className="mt-1 text-text-2">{what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
