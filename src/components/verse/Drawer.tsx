"use client";
// One drawer for the whole app: any citation or graph node opens it, wherever it appears.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadBhashya, loadGraph, loadIndex, loadVerse } from "@/lib/client/data";
import type { Bhashya, GraphData, KbIndex, Verse } from "@/lib/core/types";
import { REL_LABEL } from "@/lib/core/graph";
import { externalUrl } from "@/lib/config";
import { AudioButton } from "./AudioButton";
import { AiChantButton } from "@/components/tts/AiChantButton";
import { ListenControls } from "@/components/tts/ListenControls";
import { Lineage } from "./Lineage";
import { WordStrip } from "./Words";
import { Gloss } from "@/components/ui/Glossary";
import { IconClose, IconExternal } from "@/components/ui/Icons";

const Ctx = createContext<{ open: (id: string) => void }>({ open: () => {} });
export const useDrawer = () => useContext(Ctx);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((x: string) => setId(x), []);
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {id && (
        <>
          <div className="scrim" onClick={() => setId(null)} />
          <aside className="drawer reveal" role="dialog" aria-modal="true" aria-label="Source">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
              <span className="eyebrow">Source</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setId(null)} aria-label="Close" autoFocus>
                <IconClose />
              </button>
            </div>
            <SourceBody id={id} onNavigate={setId} />
          </aside>
        </>
      )}
    </Ctx.Provider>
  );
}

export function CiteChip({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  const { open } = useDrawer();
  return (
    <button type="button" className={`cite ${className}`} onClick={() => open(id)} title="Open the source">
      {label}
    </button>
  );
}

function useIndexAndGraph() {
  const [ix, setIx] = useState<KbIndex | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  useEffect(() => {
    loadIndex().then(setIx);
    loadGraph().then(setGraph);
  }, []);
  return { ix, graph };
}
const mapHref = (id: string) => `/map?node=${encodeURIComponent(id)}`;

/** The source view for any node (mantra, Veda, Upanishad, concept, situation, story, person, word, external), shared by the drawer and the map. */
export function SourceBody({ id, onNavigate, inExplore = false }: { id: string; onNavigate: (id: string) => void; inExplore?: boolean }) {
  const { ix, graph } = useIndexAndGraph();
  if (!ix || !graph) return <p className="muted p-5">Loading…</p>;
  const loc = ix.verseIds.find((v) => v[0] === id);
  if (loc) return <VerseView id={id} up={loc[1]} ix={ix} graph={graph} onNavigate={onNavigate} inExplore={inExplore} />;
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return <p className="muted p-5">Not found: {id}</p>;
  const seeInMap = !inExplore && <Link className="btn btn-sm" href={mapHref(id)}>See it in the map</Link>;

  if (node.type === "External") {
    const ext = ix.external[id];
    const href = ext?.url ?? externalUrl(ext);
    return (
      <div className="space-y-3 p-5">
        <p className="eyebrow">Beyond the thirteen · {ext?.title ?? node.sub}</p>
        <h2 className="text-xl font-semibold">{node.label}</h2>
        <Related id={id} graph={graph} onNavigate={onNavigate} />
        {href ? (
          <a className="btn" href={href} target="_blank" rel="noreferrer">Open in {ext?.corpus} <IconExternal size={14} /></a>
        ) : (
          <p className="muted text-[13px]">{ext?.corpus ? `${ext.corpus} is not linked on this site yet (set its address in the site configuration).` : "Reference only."}</p>
        )}
        {seeInMap}
      </div>
    );
  }
  if (node.type === "Veda") {
    const veda = ix.vedas.find((v) => `veda:${v.id}` === id);
    const texts = ix.texts.filter((t) => `veda:${t.lineage?.veda}` === id);
    return (
      <div className="space-y-4 p-5">
        <p className="eyebrow">Veda · the root</p>
        <h2 className="text-2xl font-semibold tracking-tight">{node.label} <span className="deva text-[20px] text-text-3">{veda?.sa}</span></h2>
        <p className="reading text-[15.5px]"><Gloss>{veda?.essence ?? node.sub ?? ""}</Gloss></p>
        <div>
          <p className="eyebrow mb-2">Its Upanishads (the sāra, the essence)</p>
          <ul className="space-y-2">
            {texts.map((t) => (
              <li key={t.id} className="card-soft p-3">
                <Link href={`/u/${t.id}`} className="font-semibold hover:text-accent">{t.iast} Upaniṣad</Link>
                <p className="text-[12.5px] text-text-3">{t.lineage?.sectionLabel ? `${t.lineage.sectionLabel.split(" ")[0]} section · ` : ""}{t.lineage?.school} · {t.lineage?.seat}</p>
              </li>
            ))}
          </ul>
        </div>
        {seeInMap}
      </div>
    );
  }
  if (node.type === "Upanishad") {
    const t = ix.texts.find((x) => `up:${x.id}` === id);
    if (!t) return null;
    return (
      <div className="space-y-4 p-5">
        <p className="eyebrow">Upanishad · {t.count} passages</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t.iast} Upaniṣad <span className="deva text-[20px] text-text-3">{t.sa}</span></h2>
        <Lineage text={t} />
        <p className="reading text-[15.5px]"><Gloss>{t.tagline}</Gloss></p>
        <Related id={id} graph={graph} onNavigate={onNavigate} />
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-sm btn-accent" href={`/u/${t.id}`}>Read it</Link>
          {seeInMap}
        </div>
      </div>
    );
  }
  if (node.type === "Stem") return <StemView id={id} ix={ix} graph={graph} label={node.label} sub={node.sub} onNavigate={onNavigate} seeInMap={seeInMap} />;

  const concept = ix.concepts.find((c) => `concept:${c.id}` === id);
  const dilemma = ix.dilemmas.find((d) => `dilemma:${d.id}` === id);
  const story = ix.stories.find((s) => `story:${s.id}` === id);
  return (
    <div className="space-y-4 p-5">
      <p className="eyebrow">{node.type === "Dilemma" ? "Human situation" : node.type}</p>
      <h2 className="text-2xl font-semibold tracking-tight">{node.label}</h2>
      {concept && <p className="deva text-[19px]">{concept.sa} <span className="iast text-[15px]">· {concept.en}</span></p>}
      <p className="reading text-[15.5px]"><Gloss>{concept?.desc ?? dilemma?.desc ?? story?.summary ?? node.sub ?? ""}</Gloss></p>
      {dilemma && (
        <div className="grid gap-2">
          <p className="chip-preyas rounded-lg border px-3 py-2 text-[14px]"><b>Preyas</b> · {dilemma.preyas}</p>
          <p className="chip-accent rounded-lg border px-3 py-2 text-[14px]"><b>Śreyas</b> · {dilemma.shreyas}</p>
        </div>
      )}
      <Related id={id} graph={graph} onNavigate={onNavigate} />
      {seeInMap}
    </div>
  );
}

function StemView({ id, ix, graph, label, sub, onNavigate, seeInMap }: { id: string; ix: KbIndex; graph: GraphData; label: string; sub?: string; onNavigate: (id: string) => void; seeInMap: React.ReactNode }) {
  const groups = useMemo(() => {
    const where = new Map(ix.verseIds.map((v) => [v[0], v]));
    const by = new Map<string, { id: string; ref: string }[]>();
    for (const e of graph.edges) {
      if (e.type !== "HAS_STEM" || e.t !== id) continue;
      const v = where.get(e.s);
      if (v) (by.get(v[1]) ?? by.set(v[1], []).get(v[1])!).push({ id: v[0], ref: v[2] });
    }
    return ix.texts.filter((t) => by.has(t.id)).map((t) => ({ t, list: by.get(t.id)! }));
  }, [id, ix, graph]);
  const total = groups.reduce((n, g) => n + g.list.length, 0);
  return (
    <div className="space-y-4 p-5">
      <p className="eyebrow">Word · stem</p>
      <h2 className="iast text-2xl font-semibold tracking-tight">{label}</h2>
      <p className="reading text-[15.5px]">{sub?.replace(/ · \d+ passages$/, "")}</p>
      <p className="text-[13px] text-text-3">Occurs in {total} passages across {groups.length} Upanishads.</p>
      <div className="space-y-2">
        {groups.map(({ t, list }) => (
          <div key={t.id} className="text-[13px]">
            <span className="mr-1.5 font-semibold">{t.iast}</span>
            <span className="text-text-4">{list.length} · </span>
            {list.slice(0, 18).map((v) => (
              <button key={v.id} className="cite mb-1 mr-1" onClick={() => onNavigate(v.id)}>{v.ref === "0" ? "śānti" : v.ref}</button>
            ))}
            {list.length > 18 && <span className="text-text-4">+{list.length - 18}</span>}
          </div>
        ))}
      </div>
      {seeInMap}
    </div>
  );
}

function Related({ id, graph, onNavigate }: { id: string; graph: GraphData; onNavigate: (id: string) => void }) {
  const rel = useMemo(() => graph.edges.filter((e) => (e.s === id || e.t === id) && !["PART_OF", "NEXT", "HAS_STEM"].includes(e.type)).slice(0, 30), [graph, id]);
  if (!rel.length) return null;
  const label = (x: string) => graph.nodes.find((n) => n.id === x)?.label ?? x;
  return (
    <div>
      <p className="eyebrow mb-2">Connections</p>
      <ul className="space-y-2">
        {rel.map((e, i) => {
          const other = e.s === id ? e.t : e.s;
          const verb = e.s === id ? REL_LABEL[e.type].out : REL_LABEL[e.type].in;
          return (
            <li key={i} className="text-[13.5px]">
              <span className="muted">{verb} </span>
              <button className="cite" onClick={() => onNavigate(other)}>{label(other)}</button>
              {e.why && (
                <p className="mt-0.5 text-text-3">
                  {e.why}
                  {e.basis === "editorial" ? <span className="text-text-4"> · editorial</span> : e.basis === "shankara" ? <span className="text-text-4"> · from Śaṅkara’s bhāṣya</span> : null}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VerseView({ id, up, ix, graph, onNavigate, inExplore }: { id: string; up: string; ix: KbIndex; graph: GraphData; onNavigate: (id: string) => void; inExplore: boolean }) {
  const [v, setV] = useState<Verse | null>(null);
  const [b, setB] = useState<Bhashya | null>(null);
  useEffect(() => {
    setV(null);
    setB(null);
    loadVerse(id, up).then((x) => setV(x ?? null));
    loadBhashya(id, up).then((x) => setB(x ?? null));
  }, [id, up]);
  const t = ix.texts.find((x) => x.id === up);
  const roots = useMemo(
    () =>
      graph.edges
        .filter((e) => e.type === "ROOTED_IN" && e.s === id)
        .map((e) => ({ label: graph.nodes.find((n) => n.id === e.t)?.label ?? e.t, kind: e.kind, href: externalUrl(ix.external[e.t]) })),
    [graph, id, ix],
  );
  if (!v || !t) return <p className="muted p-5">Loading…</p>;
  return (
    <div className="space-y-4 p-5">
      <div>
        <p className="eyebrow">{t.iast} Upaniṣad · {v.shanti ? "Śānti mantra (peace invocation)" : v.section}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t.abbrev} {v.shanti ? "śānti" : v.ref}</h2>
      </div>
      <Lineage text={t} compact roots={roots} />
      <div className="deva text-[20px]">{v.sa.map((l, i) => <div key={i}>{l}</div>)}</div>
      <div className="iast text-[15px]">{v.iast.map((l, i) => <div key={i}>{l}</div>)}</div>
      <div className="flex flex-wrap items-start gap-2">
        {v.audio ? (
          <AudioButton src={v.audio.mp3} label="Hear the chant" track={{ id, label: `${t.abbrev} ${v.shanti ? "śānti" : v.ref}` }} />
        ) : (
          <AiChantButton id={id} up={up} label={`${t.abbrev} ${v.shanti ? "śānti" : v.ref}`} />
        )}
        <ListenControls id={id} label={`${t.abbrev} ${v.shanti ? "śānti" : v.ref}`} translation={v.tr?.text} commentary={b?.text} />
      </div>
      {v.tr ? (
        <figure className="card-soft p-4">
          <blockquote className="reading text-[16px]">{v.tr.text}</blockquote>
          <figcaption className="mt-2 text-[12.5px] text-text-3">{v.tr.by} · Śaṅkara tradition{v.tr.joint ? ` · translated together as ${t.abbrev} ${v.tr.joint}` : ""}</figcaption>
        </figure>
      ) : (
        <p className="card-soft p-4 text-[13.5px] text-text-3">No English translation for this passage in our sources yet. The Sanskrit and IAST above are complete.</p>
      )}
      {v.takeaway && (
        <div className="takeaway">
          <p className="eyebrow !text-[10.5px]">In plain English · editorial</p>
          <p className="mt-1 text-[14.5px]"><Gloss>{v.takeaway}</Gloss></p>
        </div>
      )}
      {v.words && v.words.length > 0 && <WordStrip words={v.words} onOpen={onNavigate} />}
      {b && (
        <details className="card p-4">
          <summary className="flex items-center justify-between"><span className="font-semibold">{b.author === "Śaṅkara" ? "Śaṅkara’s commentary" : `Commentary · ${b.author}`}</span><span className="text-[12px] text-text-3">tr. {b.translator}{b.ocr ? " · from a scan" : ""}</span></summary>
          <div className="reading mt-3 max-h-[42vh] overflow-y-auto whitespace-pre-line pr-1 text-[14.5px]">{b.text}</div>
          <a className="mt-2 inline-flex items-center gap-1 text-[12px] text-text-3 underline" href={b.source} target="_blank" rel="noreferrer">Source <IconExternal size={12} /></a>
        </details>
      )}
      {v.alt.map((a, i) => (
        <details key={i} className="card-soft p-4">
          <summary className="text-[13.5px] font-semibold">Another reading · {a.by}</summary>
          <p className="reading mt-2 text-[15px]">{a.text}</p>
          <p className="mt-1 text-[12px] text-text-3">{a.cite}</p>
        </details>
      ))}
      <Related id={id} graph={graph} onNavigate={onNavigate} />
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-sm" href={`/u/${up}/${v.ref}`}>Open in the reader</Link>
        {!inExplore && <Link className="btn btn-sm btn-ghost" href={mapHref(id)}>See it in the map</Link>}
      </div>
    </div>
  );
}
