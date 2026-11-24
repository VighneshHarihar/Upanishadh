"use client";
// Path finder: the most meaningful short route between any two points (a mantra, an idea, a story, a Veda, a word).
import { useMemo, useState } from "react";
import type { GNode, GraphData } from "@/lib/core/types";
import { indexGraph, REL_LABEL, shortestPath } from "@/lib/core/graph";
import { explore, useExplore } from "@/lib/client/explore-store";
import { IconClose, IconRoute } from "@/components/ui/Icons";
import { KIND_COLOR } from "@/components/graph/MiniGraph";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PRESETS: [string, string, string][] = [
  ["Two Birds → Gītā", "MuU_3.1.1", "BG_13.14"],
  ["Naciketas → Neti neti", "story:naciketas", "concept:neti-neti"],
  ["Ṛgveda → Tat tvam asi", "veda:rig", "ChU_6.8.7"],
  ["Anger → Ātman", "dilemma:anger-revenge", "concept:atman"],
];

function NodePicker({ label, value, onChange, nodes }: { label: string; value: string | null; onChange: (id: string | null) => void; nodes: GNode[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const cur = nodes.find((n) => n.id === value);
  const hits = useMemo(() => {
    const f = fold(q.trim());
    if (f.length < 2) return [];
    return nodes
      .filter((n) => fold(n.label).includes(f) || fold(n.id).includes(f) || (n.sub && n.type !== "Verse" && fold(n.sub).includes(f)))
      .sort((a, b) => Number(!fold(a.label).startsWith(f)) - Number(!fold(b.label).startsWith(f)) || a.label.length - b.label.length)
      .slice(0, 8);
  }, [q, nodes]);
  return (
    <div className="relative">
      <label className="eyebrow !text-[10.5px]">{label}</label>
      {cur ? (
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-line-2 px-3 py-2">
          <span className="dot" style={{ background: KIND_COLOR[cur.type] }} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{cur.label}</span>
          <button className="btn btn-ghost btn-sm !h-7 !px-1.5" onClick={() => onChange(null)} aria-label={`Clear ${label}`}><IconClose size={13} /></button>
        </div>
      ) : (
        <>
          <input
            className="mt-1 w-full"
            value={q}
            placeholder="A mantra (KaU 1.2.23), idea, story, Veda, word…"
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { onChange(hits[0].id); setQ(""); } }}
            aria-label={label}
          />
          {open && hits.length > 0 && (
            <ul className="menu absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto p-1" role="listbox">
              {hits.map((n) => (
                <li key={n.id}>
                  <button className="menu-item w-full" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(n.id); setQ(""); }}>
                    <span className="dot" style={{ background: KIND_COLOR[n.type] }} />
                    <span className="truncate">{n.label}</span>
                    <span className="ml-auto text-[11px] text-text-4">{n.type === "Stem" ? "word" : n.type.toLowerCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function PathPanel({ graph }: { graph: GraphData }) {
  const { path, selected } = useExplore();
  const gi = useMemo(() => indexGraph(graph), [graph]);
  const [from, setFrom] = useState<string | null>(path?.from ?? selected);
  const [to, setTo] = useState<string | null>(path?.to ?? null);
  const [none, setNone] = useState(false);
  const run = (a = from, b = to) => {
    if (!a || !b) return;
    const p = shortestPath(gi, a, b);
    setNone(!p);
    explore.setPath(p ? { from: a, to: b, ...p } : null);
  };
  const label = (id: string) => gi.nodes.get(id)?.label ?? id;
  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto p-5">
      <div>
        <h2 className="text-[18px] font-semibold">Find a path</h2>
        <p className="mt-1 text-[13px] text-text-3">The most meaningful short route between two points. Teachings, stories and Śaṅkara’s citations count for more than “both are in the same text”.</p>
      </div>
      <NodePicker label="From" value={from} onChange={setFrom} nodes={graph.nodes} />
      <NodePicker label="To" value={to} onChange={setTo} nodes={graph.nodes} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-accent btn-sm" disabled={!from || !to} onClick={() => run()}><IconRoute size={14} /> Find the path</button>
        {path && <button className="btn btn-ghost btn-sm" onClick={() => { explore.setPath(null); setNone(false); }}>Clear</button>}
      </div>
      {!path && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.filter(([, a, b]) => gi.nodes.has(a) && gi.nodes.has(b)).map(([name, a, b]) => (
            <button key={name} className="chip" onClick={() => { setFrom(a); setTo(b); run(a, b); }}>{name}</button>
          ))}
        </div>
      )}
      {none && <p className="text-[13.5px] text-text-3">No meaningful path within reach between these two.</p>}
      {path && (
        <ol className="space-y-0">
          {path.nodes.map((id, i) => {
            const e = path.edges[i];
            const n = gi.nodes.get(id);
            return (
              <li key={id + i}>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-3" onClick={() => explore.select(id)}>
                  <span className="dot" style={{ background: n ? KIND_COLOR[n.type] : "var(--text-4)" }} />
                  <span className="text-[14px] font-semibold">{label(id)}</span>
                  <span className="ml-auto text-[11px] text-text-4">{n?.type === "Stem" ? "word" : n?.type.toLowerCase()}</span>
                </button>
                {e && (
                  <p className="ml-[13px] border-l border-dashed border-line-3 py-1 pl-4 text-[12.5px] text-text-3">
                    {e.s === id ? REL_LABEL[e.type].out : REL_LABEL[e.type].in}
                    {e.why ? <span className="text-text-4"> · {e.why}</span> : null}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
