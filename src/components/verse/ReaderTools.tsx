"use client";
// Reader tools: which layers are shown (Devanagari, IAST, translation, secondary reading, bhāṣya), bookmarks and notes
// kept in this browser, reading progress, and continuous play of a chapter or a whole Upanishad.
import { useEffect, useState, useSyncExternalStore } from "react";
import { personal, usePersonal } from "@/lib/client/personal";
import { player, usePlayer, type Track } from "@/lib/client/player";
import { ShareButton } from "@/components/ui/Share";
import { loadIndex, useAsync } from "@/lib/client/data";
import { sectionOf } from "@/components/verse/Lineage";
import { IconBookmark, IconNote, IconPause, IconPlay } from "@/components/ui/Icons";
import { ScriptPicker } from "@/components/reader/ScriptPicker";
import { scriptInfo, useScript } from "@/lib/client/script";

export const LAYERS = [
  { id: "deva", label: "Devanagari" },
  { id: "iast", label: "IAST" },
  { id: "tr", label: "Translation" },
  { id: "alt", label: "Secondary reading" },
  { id: "bhashya", label: "Bhāṣya" },
] as const;
export type Layer = (typeof LAYERS)[number]["id"];
const KEY = "upasarathi:hide";
const listeners = new Set<() => void>();
const readHidden = (): string => (typeof document === "undefined" ? "" : document.documentElement.dataset.hide ?? "");

/** Layer switches. The choice is stored, applied to <html data-hide> before first paint, and hides by CSS. */
export function ViewToggles() {
  const hidden = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readHidden,
    () => "",
  );
  const set = hidden.split(" ").filter(Boolean);
  // The first layer is the Sanskrit in the chosen script; with IAST chosen it is the IAST, and there is no second.
  const script = useScript();
  const textLayers = script === "iast" ? ["deva", "tr"] : ["deva", "iast", "tr"];
  const toggle = (id: Layer) => {
    const next = set.includes(id) ? set.filter((x) => x !== id) : [...set, id];
    // Never hide everything that carries the text itself.
    if (textLayers.every((x) => next.includes(x))) return;
    document.documentElement.dataset.hide = next.join(" ");
    try {
      localStorage.setItem(KEY, next.join(" "));
    } catch {}
    listeners.forEach((l) => l());
  };
  return (
    <div className="view-toggles sk-controls">
      <div className="sk-layers" role="group" aria-label="Show or hide layers">
        {LAYERS.filter((l) => !(script === "iast" && l.id === "iast")).map((l) => (
          <button key={l.id} type="button" aria-pressed={!set.includes(l.id)} onClick={() => toggle(l.id)}>
            {l.id === "deva" ? scriptInfo(script).label : l.label}
          </button>
        ))}
      </div>
      <ScriptPicker />
    </div>
  );
}

export function VerseActions({ id, up, share }: { id: string; up: string; share: { title: string; subtitle: string; deva: string; iast: string; lines: string[]; url: string } }) {
  const p = usePersonal();
  const ix = useAsync(loadIndex, []);
  const text = ix?.texts.find((t) => t.id === up);
  const root = text?.lineage ? [`Rooted in the ${text.lineage.vedaLabel}`, sectionOf(text)].filter(Boolean).join(" · ") : undefined;
  const marked = p.bookmarks.includes(id);
  const note = p.notes[id]?.text ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  useEffect(() => personal.markRead(up, id), [up, id]);
  useEffect(() => setDraft(note), [note]);
  return (
    <>
      <button type="button" className={`btn btn-sm ${marked ? "btn-accent" : ""}`} aria-pressed={marked} onClick={() => personal.toggleBookmark(id)} title="Bookmarks stay in this browser">
        <IconBookmark size={14} filled={marked} /> {marked ? "Bookmarked" : "Bookmark"}
      </button>
      <button type="button" className="btn btn-sm" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
        <IconNote size={14} /> {note ? "Your note" : "Add a note"}
      </button>
      <ShareButton label="Share" {...share} emblem={up} root={root} translation={share.lines[0]} credit={share.lines[1]} />
      {(editing || note) && (
        <div className="w-full">
          {editing ? (
            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                personal.setNote(id, draft);
                setEditing(false);
              }}
            >
              <textarea className="input min-h-[90px] w-full p-3 text-[14.5px]" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What does this say to you? (kept only in this browser)" aria-label="Your note" autoFocus />
              <div className="flex gap-2">
                <button className="btn btn-sm btn-accent">Save note</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setDraft(note); setEditing(false); }}>Cancel</button>
              </div>
            </form>
          ) : (
            <p className="card-soft mt-2 whitespace-pre-line p-3 text-[14px] text-text-2">{note}</p>
          )}
        </div>
      )}
    </>
  );
}

/** Continuous play: every chanted mantra from here (or from the start), one after another. */
export function PlayQueue({ tracks, title, from = 0, label }: { tracks: Track[]; title: string; from?: number; label: string }) {
  const st = usePlayer();
  if (!tracks.length) return null;
  const active = st.title === title && st.playing;
  return (
    <button type="button" className={`btn btn-sm ${active ? "btn-accent" : ""}`} onClick={() => (active ? player.pause() : player.playQueue(tracks, title, from))}>
      {active ? <IconPause size={14} /> : <IconPlay size={14} />} {label}
    </button>
  );
}

/** "Continue reading" for a text, from local progress. */
export function ContinueReading({ up, refs }: { up: string; refs: Record<string, string> }) {
  const p = usePersonal();
  const pr = p.progress[up];
  if (!pr || !refs[pr.last]) return null;
  const total = Object.keys(refs).length;
  return (
    <a href={`/u/${up}/${refs[pr.last]}`} className="btn btn-sm">
      Continue at {refs[pr.last] === "0" ? "śānti" : refs[pr.last]} <span className="text-text-3">· {pr.read.length}/{total} read</span>
    </a>
  );
}
