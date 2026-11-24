"use client";
// The Map: Veda → Upanishad → mantra. The default view is a crisp, keyboard-navigable focus subgraph (≤15 nodes);
// the whole map (2D, grouped by Veda) and the 3D cosmos are optional views. A glass dock on the right holds what is
// selected, the path finder and the conversation.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { askStore, useAsk, type AskMessage } from "@/lib/client/ask-store";
import { explore, useExplore } from "@/lib/client/explore-store";
import { loadGraph, loadIndex, useAsync } from "@/lib/client/data";
import type { GraphData, KbIndex, NodeType } from "@/lib/core/types";
import { PathPanel } from "./PathPanel";
import { AskPanel } from "@/components/ask/AskPanel";
import { SUGGESTIONS } from "@/components/ask/suggestions";
import { SourceBody } from "@/components/verse/Drawer";
import { TEXT_HEX, TYPE_HEX, TYPE_LABEL, TYPE_ORDER, nodeColor } from "./palette";
import { useTheme } from "@/lib/client/theme";
import { IconBack, IconChat, IconClose, IconEye, IconEyeOff, IconFit, IconLayers, IconMap, IconMinus, IconOrbit, IconPause, IconPlay, IconPlus, IconReplay, IconRoute, IconSend } from "@/components/ui/Icons";

const Cosmos3D = dynamic(() => import("./Cosmos3D"), { ssr: false, loading: () => <Loading /> });
const Cosmos2D = dynamic(() => import("./Cosmos2D"), { ssr: false, loading: () => <Loading /> });
const FocusGraph = dynamic(() => import("./FocusGraph"), { ssr: false, loading: () => <Loading /> });

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <p className="thinking text-[14px] text-text-3">Gathering the map</p>
    </div>
  );
}

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

const DOCK_W = 452;

export function ExploreApp() {
  const st = useExplore();
  const ask = useAsk();
  const wide = useWide();
  const dark = useTheme() === "dark";
  const graph = useAsync<GraphData>(loadGraph, []);
  const kb = useAsync<KbIndex>(loadIndex, []);
  const [legendOpen, setLegendOpen] = useState(true);

  // Deep links: ?node=<id> selects and flies; ?q=<question> asks.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const node = q.get("node");
    const question = q.get("q");
    const view = q.get("view");
    if (view === "3d" || view === "2d" || view === "focus") explore.setView(view);
    if (q.get("roots") === "1") explore.setRoots(true);
    if (node) explore.select(node);
    if (question) {
      explore.setDock("ask");
      askStore.ask(question);
    }
    if (!node && !question && ask.highlight) explore.setDock("ask");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!wide) setLegendOpen(false);
  }, [wide]);

  const dockOpen = st.dock !== null;
  const offset = dockOpen && wide ? DOCK_W + 16 : 0;
  const counts = useMemo(() => {
    const c = {} as Record<NodeType, number>;
    for (const n of graph?.nodes ?? []) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [graph]);
  const selectedNode = useMemo(() => graph?.nodes.find((n) => n.id === st.selected) ?? null, [graph, st.selected]);

  const showInGraph = (m: AskMessage) => askStore.showInGraph(m);
  const askAbout = (id: string) => {
    const n = graph?.nodes.find((x) => x.id === id);
    if (!n) return;
    const q =
      n.type === "Verse"
        ? `Explain ${n.label}: what is it saying, and what does it mean for how I live?`
        : n.type === "Dilemma"
          ? `${n.label}: what do the Upanishads say about this?`
          : n.type === "Story"
            ? `Tell me the story of ${n.label} and what it teaches.`
            : n.type === "Upanishad"
              ? `What is the ${n.label} Upanishad about, and where should I begin?`
              : n.type === "Veda"
                ? `What is the essence of the ${n.label}, and how do its Upanishads distil it?`
                : n.type === "Stem"
                  ? `What does the word ${n.label} mean across the Upanishads?`
                  : `What do the Upanishads teach about ${n.label}?`;
    explore.setDock("ask");
    askStore.ask(q);
  };

  return (
    <div className="explore-root relative overflow-hidden" style={{ height: "calc(100dvh - var(--nav-h))" }}>
      {st.view === "3d" ? (
        <Cosmos3D offsetRight={offset} />
      ) : st.view === "2d" ? (
        <Cosmos2D offsetRight={offset} />
      ) : graph && kb ? (
        <div className="absolute inset-y-0 left-0" style={{ right: offset }}>
          <FocusGraph graph={graph} ix={kb} />
        </div>
      ) : (
        <Loading />
      )}

      {/* ── top-left: title and view controls ── */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100vw-24px)] flex-col gap-2 sm:left-5 sm:top-5">
        <div className="glass pointer-events-auto px-4 py-3.5 sm:px-5">
          <p className="eyebrow !text-[10.5px]">The map · Veda → Upanishad → mantra</p>
          <h1 className="display mt-0.5 text-[21px] sm:text-[24px]">{st.view === "focus" && selectedNode ? selectedNode.label : "Four Vedas, thirteen Upanishads"}</h1>
          <p className="mt-1 hidden text-[12.5px] text-text-3 sm:block">
            {graph ? `${(counts.Verse ?? 0).toLocaleString()} passages · ${counts.Concept} concepts · ${counts.Story} stories · ${counts.Stem} key words · ${graph.edges.length.toLocaleString()} links` : "Loading…"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="seg !rounded-[10px] !p-[2px]" role="group" aria-label="View">
              <button aria-pressed={st.view === "focus"} onClick={() => explore.setView("focus")} className="!h-8 !px-3 !text-[13px]" title="One idea and its closest links (keyboard-friendly)">
                <IconMap size={14} /> Focus
              </button>
              <button aria-pressed={st.view === "2d"} onClick={() => explore.setView("2d")} className="!h-8 !px-3 !text-[13px]" title="Everything, grouped by Veda">
                <IconLayers size={14} /> Whole map
              </button>
              <button aria-pressed={st.view === "3d"} onClick={() => explore.setView("3d")} className="!h-8 !px-3 !text-[13px]" title="The 3D cosmos (needs WebGL)">
                <IconOrbit size={14} /> 3D
              </button>
            </div>
            <button className={`btn btn-sm !h-8 ${st.roots ? "btn-accent" : ""}`} aria-pressed={st.roots} onClick={() => explore.setRoots(!st.roots)} title="Show how each Upanishad distils its Veda, and the Saṃhitā mantras it takes up">
              Vedic Roots (Sāra)
            </button>
            {st.view !== "focus" && (
              <div className="seg !rounded-[10px] !p-[2px]">
                <button aria-pressed={st.colorBy === "text"} onClick={() => explore.setColorBy("text")} className="!h-8 !px-3 !text-[13px]">By text</button>
                <button aria-pressed={st.colorBy === "type"} onClick={() => explore.setColorBy("type")} className="!h-8 !px-3 !text-[13px]">By kind</button>
              </div>
            )}
          </div>
          {st.view === "focus" && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button className="btn btn-ghost btn-sm !h-7" disabled={!st.trail.length} onClick={explore.back} aria-label="Back"><IconBack size={13} /> Back</button>
              <button className="btn btn-ghost btn-sm !h-7" disabled={!st.selected} onClick={explore.home}>Root map</button>
              <button className="btn btn-ghost btn-sm !h-7" onClick={() => explore.setDock("path")}><IconRoute size={13} /> Find a path</button>
            </div>
          )}
        </div>
      </div>

      {/* ── answer banner ── */}
      {ask.highlight && (
        <div className="absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 sm:top-5 md:block" style={{ marginLeft: -offset / 2 }}>
          <div className="glass reveal flex max-w-[min(560px,46vw)] items-center gap-3 !rounded-full py-1.5 pl-4 pr-1.5">
            <span className="dot" style={{ background: "var(--gold)" }} />
            <p className="min-w-0 truncate text-[13px]">
              <span className="text-text-3">{ask.highlight.nodes.length} nodes behind</span> “{ask.highlight.label}”
            </p>
            <button className="btn btn-ghost btn-sm !rounded-full" onClick={askStore.clearHighlight} aria-label="Clear highlight">
              <IconClose size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── camera ── */}
      <div className={`absolute top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-1 ${st.view === "focus" ? "" : "sm:flex"}`} style={{ right: offset + 16 }}>
        <div className="glass flex flex-col p-1 !rounded-xl">
          <button className="btn btn-ghost btn-icon" onClick={() => explore.camera("zoomIn")} aria-label="Zoom in" title="Zoom in"><IconPlus size={17} /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => explore.camera("zoomOut")} aria-label="Zoom out" title="Zoom out"><IconMinus size={17} /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => explore.camera("fit")} aria-label="Fit everything" title="Fit everything"><IconFit size={16} /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => explore.camera("home")} aria-label="Reset view" title="Reset view"><IconReplay size={16} /></button>
          {st.view === "3d" && (
            <button className="btn btn-ghost btn-icon" onClick={() => explore.setAutoRotate(!st.autoRotate)} aria-label={st.autoRotate ? "Stop rotating" : "Rotate"} title={st.autoRotate ? "Stop rotating" : "Rotate"}>
              {st.autoRotate ? <IconPause size={15} /> : <IconPlay size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* ── legend ── */}
      <div className={`absolute bottom-3 left-3 z-10 hidden sm:bottom-5 sm:left-5 ${st.view === "focus" ? "" : "sm:block"}`}>
        {legendOpen ? (
          <div className="glass reveal w-[262px] px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="eyebrow !text-[10.5px]">Legend</span>
              <button className="btn btn-ghost btn-sm !h-6 !px-1.5" onClick={() => setLegendOpen(false)} aria-label="Hide legend"><IconClose size={13} /></button>
            </div>
            <ul className="space-y-0.5">
              {TYPE_ORDER.map((t) => {
                const off = st.hidden.includes(t);
                return (
                  <li key={t}>
                    <button className={`legend-row ${off ? "opacity-40" : ""}`} onClick={() => explore.toggleType(t)} aria-pressed={!off}>
                      <Glyph type={t} color={TYPE_HEX[dark ? "dark" : "light"][t]} />
                      <span className="flex-1 text-left">{TYPE_LABEL[t]}</span>
                      <span className="num text-text-4">{counts[t] ?? ""}</span>
                      {off ? <IconEyeOff size={13} /> : <IconEye size={13} className="text-text-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {st.colorBy === "text" && kb && (
              <>
                <p className="eyebrow mb-1.5 mt-3 !text-[10.5px]">Texts</p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                  {kb.texts.map((t) => (
                    <button key={t.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[12px] text-text-2 hover:bg-surface-3" onClick={() => explore.select(`up:${t.id}`)}>
                      <span className="dot !h-2 !w-2" style={{ background: TEXT_HEX[dark ? "dark" : "light"][t.id] }} />
                      <span className="truncate">{t.iast}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="mt-3 border-t border-line pt-2 text-[11.5px] leading-snug text-text-4">{st.view === "3d" ? "Drag to orbit" : "Drag to pan"} · scroll to zoom · click a point to open it</p>
          </div>
        ) : (
          <button className="glass btn !h-10 !rounded-xl" onClick={() => setLegendOpen(true)}>
            <IconLayers size={15} /> Legend
          </button>
        )}
      </div>

      {/* ── ask bar (when the conversation is not open) ── */}
      {st.dock !== "ask" && <AskBar left={wide && legendOpen && st.view !== "focus" ? 300 : 0} right={offset + (wide ? 72 : 0)} hasMessages={ask.messages.length > 0} />}

      {/* ── dock ── */}
      {dockOpen && (
        <aside className={`explore-dock reveal ${wide ? "" : "explore-dock-sheet"}`} style={wide ? { width: DOCK_W } : undefined} aria-label={st.dock === "ask" ? "Conversation" : st.dock === "path" ? "Path finder" : "Details"}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="seg !p-[2px]">
              <button aria-pressed={st.dock === "details"} disabled={!st.selected} onClick={() => explore.setDock("details")} className="!h-8 !text-[13px] disabled:opacity-40">Details</button>
              <button aria-pressed={st.dock === "path"} onClick={() => explore.setDock("path")} className="!h-8 !text-[13px]"><IconRoute size={14} /> Path</button>
              <button aria-pressed={st.dock === "ask"} onClick={() => explore.setDock("ask")} className="!h-8 !text-[13px]">
                <IconChat size={14} /> Ask{ask.messages.length ? ` · ${Math.ceil(ask.messages.length / 2)}` : ""}
              </button>
            </div>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-sm" onClick={() => explore.setDock(null)} aria-label="Close panel"><IconClose /></button>
          </div>
          <div className="min-h-0 flex-1">
            {st.dock === "ask" ? (
              <AskPanel onShowInGraph={showInGraph} inExplore />
            ) : st.dock === "path" ? (
              graph ? <PathPanel graph={graph} /> : null
            ) : st.selected && selectedNode ? (
              <div className="scroll-thin h-full overflow-y-auto">
                <div className="flex items-center gap-2 px-5 pt-4">
                  <span className="dot" style={{ background: nodeColor({ type: selectedNode.type, up: selectedNode.up, id: selectedNode.id }, st.colorBy, dark) }} />
                  <span className="text-[12px] text-text-3">{TYPE_LABEL[selectedNode.type].replace(/s$/, "")}</span>
                  <div className="flex-1" />
                  <button className="btn btn-sm" onClick={() => askAbout(selectedNode.id)}>
                    <IconChat size={14} /> Ask about this
                  </button>
                </div>
                <SourceBody id={st.selected} onNavigate={(id) => explore.select(id)} inExplore />
              </div>
            ) : (
              <p className="p-5 text-text-3">Select a point in the map.</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function AskBar({ left, right, hasMessages }: { left: number; right: number; hasMessages: boolean }) {
  const { draft, busy } = useAsk();
  const send = (q: string) => {
    if (!q.trim() || busy) return;
    explore.setDock("ask");
    askStore.ask(q);
  };
  return (
    <div className="pointer-events-none absolute bottom-3 z-10 flex justify-center px-3 sm:bottom-5" style={{ left, right }}>
      <div className="pointer-events-auto w-full max-w-[680px]">
        {!hasMessages && (
          <div className="mb-2 hidden flex-wrap justify-center gap-1.5 md:flex">
            {SUGGESTIONS.slice(1, 4).map((q) => (
              <button key={q} className="glass chip-q" onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        )}
        <form
          className="glass ask-bar"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <IconChat size={17} className="ml-1 shrink-0 text-accent" />
          <input value={draft} onChange={(e) => askStore.setDraft(e.target.value)} placeholder={hasMessages ? "Continue the conversation…" : "Ask the Upanishads anything…"} aria-label="Ask the Upanishads" />
          {hasMessages && !draft && (
            <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => explore.setDock("ask")}>Open conversation</button>
          )}
          <button className="btn btn-accent btn-icon shrink-0 !h-9 !w-9 !rounded-full" disabled={!draft.trim() || busy} aria-label="Ask">
            <IconSend size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Glyph({ type, color }: { type: NodeType; color: string }) {
  const s = 14;
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden className="shrink-0">
      {type === "Upanishad" && (<><circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1" opacity=".7" /><circle cx="7" cy="7" r="3.6" fill={color} /></>)}
      {type === "Verse" && <circle cx="7" cy="7" r="2.2" fill={color} />}
      {type === "Veda" && (<><circle cx="7" cy="7" r="6.2" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" /><circle cx="7" cy="7" r="4" fill={color} /></>)}
      {type === "Stem" && <rect x="4" y="4" width="6" height="6" rx="1.2" fill={color} />}
      {type === "Axis" && (<><circle cx="7" cy="7" r="5.2" fill="none" stroke={color} strokeWidth="1.4" /><circle cx="7" cy="7" r="2.6" fill={color} /></>)}
      {type === "Concept" && <circle cx="7" cy="7" r="4" fill={color} />}
      {type === "Dilemma" && (<><circle cx="7" cy="7" r="4.6" fill="none" stroke={color} strokeWidth="2" /><circle cx="7" cy="7" r="1.6" fill={color} /></>)}
      {type === "Story" && <path d="M7 1.8 11.4 7 7 12.2 2.6 7z" fill={color} />}
      {type === "Person" && <circle cx="7" cy="7" r="3" fill={color} />}
      {type === "External" && (<><circle cx="7" cy="7" r="4.8" fill="none" stroke={color} strokeWidth=".9" /><circle cx="7" cy="7" r="2.4" fill={color} /></>)}
    </svg>
  );
}
