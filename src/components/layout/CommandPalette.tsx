"use client";
// Ctrl/⌘ K: find any mantra (by reference or by what it says), concept, human situation, story, person or text,
// or ask the question directly.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadEngine } from "@/lib/client/data";
import { askStore } from "@/lib/client/ask-store";
import { explore } from "@/lib/client/explore-store";
import { ui, useUi } from "@/lib/client/ui-store";
import { searchIndex } from "@/lib/core/search";
import type { Engine } from "@/lib/core/engine";
import { IconArrow, IconBook, IconChat, IconOrbit, IconSearch } from "@/components/ui/Icons";

interface Hit {
  id: string;
  kind: string;
  title: string;
  sub?: string;
  go: () => void;
}
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CommandPalette() {
  const { palette } = useUi();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [E, setE] = useState<Engine | null>(null);
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!palette) return;
    setQ("");
    setCur(0);
    loadEngine().then(({ E }) => setE(E));
    setTimeout(() => input.current?.focus(), 10);
  }, [palette]);

  const hits = useMemo((): Hit[] => {
    if (!E) return [];
    const kb = E.kb;
    const node = (id: string) => () => {
      explore.select(id);
      router.push(`/map?node=${encodeURIComponent(id)}`);
    };
    const verse = (id: string) => {
      const v = E.verse.get(id)!;
      const t = kb.texts.find((x) => x.id === v.up)!;
      return { id, kind: "Mantra", title: `${t.abbrev} ${v.ref}`, sub: v.tr.slice(0, 120), go: () => router.push(`/u/${v.up}/${v.ref}`) };
    };
    const query = q.trim();
    if (!query) {
      return [
        ...kb.texts.map((t) => ({ id: t.id, kind: "Upanishad", title: `${t.iast} Upaniṣad`, sub: t.tagline, go: () => router.push(`/u/${t.id}`) })),
        ...kb.concepts.slice(0, 6).map((c) => ({ id: `concept:${c.id}`, kind: "Concept", title: c.iast, sub: c.en, go: node(`concept:${c.id}`) })),
      ];
    }
    const f = fold(query);
    const out: Hit[] = [];
    // a reference such as "KaU 1.2.2", "katha 1.2.2" or "1.2.2"
    const ref = query.match(/^([a-z]+)?\.?\s*(\d+(?:\.\d+){0,3})$/i);
    if (ref) {
      const ab = ref[1] ? fold(ref[1]) : null;
      for (const v of kb.verses) {
        const t = kb.texts.find((x) => x.id === v.up)!;
        if (!v.ref.startsWith(ref[2])) continue;
        if (ab && !fold(t.abbrev).startsWith(ab) && !fold(t.iast).startsWith(ab) && !t.id.startsWith(ab)) continue;
        out.push(verse(v.id));
        if (out.length >= 8) break;
      }
    }
    const match = (s: string) => fold(s).includes(f);
    for (const t of kb.texts) if (match(t.iast) || match(t.en) || t.aliases.some(match)) out.push({ id: t.id, kind: "Upanishad", title: `${t.iast} Upaniṣad`, sub: t.tagline, go: () => router.push(`/u/${t.id}`) });
    for (const c of kb.concepts) if (match(c.iast) || match(c.en) || match(c.sa)) out.push({ id: `concept:${c.id}`, kind: "Concept", title: c.iast, sub: c.en, go: node(`concept:${c.id}`) });
    for (const d of kb.dilemmas) if (match(d.en) || match(d.desc)) out.push({ id: `dilemma:${d.id}`, kind: "Human situation", title: d.en, sub: d.desc, go: node(`dilemma:${d.id}`) });
    for (const s of kb.stories) if (match(s.title)) out.push({ id: `story:${s.id}`, kind: "Story", title: s.title, sub: s.summary.slice(0, 120), go: node(`story:${s.id}`) });
    for (const p of kb.persons) if (match(p.iast) || match(p.role)) out.push({ id: `person:${p.id}`, kind: "Person", title: p.iast, sub: p.role, go: node(`person:${p.id}`) });
    for (const n of E.graph.nodes) if ((n.type === "Veda" || n.type === "Stem") && (match(n.label) || match(n.sub ?? ""))) out.push({ id: n.id, kind: n.type === "Veda" ? "Veda" : "Word", title: n.label, sub: n.sub, go: node(n.id) });
    if (query.length > 2) {
      for (const r of searchIndex(E.search, query, 10)) {
        if (out.some((h) => h.id === r.id)) continue;
        if (E.verse.has(r.id)) out.push(verse(r.id));
        else if (r.id.startsWith("story:")) {
          const s = kb.stories.find((x) => `story:${x.id}` === r.id);
          if (s) out.push({ id: r.id, kind: "Story", title: s.title, sub: s.summary.slice(0, 120), go: node(r.id) });
        } else if (r.id.startsWith("concept:")) {
          const c = kb.concepts.find((x) => `concept:${x.id}` === r.id);
          if (c) out.push({ id: r.id, kind: "Concept", title: c.iast, sub: c.en, go: node(r.id) });
        }
      }
    }
    return out.slice(0, 14);
  }, [E, q, router]);

  const actions: Hit[] = q.trim().length > 3 ? [{ id: "ask", kind: "Ask", title: `Ask: “${q.trim()}”`, sub: "Answered from the mantras, with citations", go: () => askStore.ask(q.trim()) }] : [];
  // A question asks first; a name or a reference finds first.
  const asky = /\?\s*$/.test(q.trim()) || q.trim().split(/\s+/).length >= 4;
  const all = asky || !hits.length ? [...actions, ...hits] : [...hits, ...actions];
  const pick = (h: Hit) => {
    ui.closePalette();
    h.go();
  };

  if (!palette) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 p-4 pt-[12vh] backdrop-blur-[2px]" onClick={ui.closePalette}>
      <div className="glass reveal w-full max-w-[680px] overflow-hidden !rounded-2xl !bg-[var(--surface)]" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <IconSearch size={18} className="text-text-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCur(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") ui.closePalette();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCur((c) => Math.min(all.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCur((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && all[cur]) pick(all[cur]);
            }}
            placeholder="Search “KaU 1.2.2”, “two birds”, “fear of death”, “Yājñavalkya”…"
            className="!border-0 !bg-transparent !px-0 !py-4 text-[16px]"
            aria-label="Search"
          />
          <span className="kbd">Esc</span>
        </div>
        <ul className="scroll-thin max-h-[56vh] overflow-y-auto p-2" role="listbox">
          {!E && <li className="px-3 py-4 text-text-3">Loading…</li>}
          {E && !all.length && <li className="px-3 py-4 text-text-3">Nothing found. Try a reference like “ChU 6.8.7”, or ask it as a question.</li>}
          {all.map((h, i) => (
            <li key={`${h.kind}:${h.id}`} role="option" aria-selected={i === cur}>
              <button className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${i === cur ? "bg-surface-3" : "hover:bg-surface-2"}`} onMouseEnter={() => setCur(i)} onClick={() => pick(h)}>
                <span className="mt-0.5 text-text-3">{h.kind === "Ask" ? <IconChat size={16} /> : h.kind === "Mantra" || h.kind === "Upanishad" ? <IconBook size={16} /> : <IconOrbit size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{h.title}</span>
                  {h.sub && <span className="block truncate text-[12.5px] text-text-3">{h.sub}</span>}
                </span>
                <span className="mt-0.5 shrink-0 text-[11px] uppercase tracking-wider text-text-4">{h.kind}</span>
                {i === cur && <IconArrow size={14} className="mt-1 text-text-3" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
