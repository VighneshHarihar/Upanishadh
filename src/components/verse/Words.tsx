"use client";
// The word layer: every analysed Sanskrit word is a button; open it to see its meaning and every passage in the
// thirteen Upanishads where the same word (lemma) occurs.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadIndex, loadLemmas } from "@/lib/client/data";
import type { KbIndex, Word } from "@/lib/core/types";
import { IconClose } from "@/components/ui/Icons";

export function WordStrip({ words, onOpen }: { words: Word[]; onOpen?: (id: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!words.length) return null;
  const w = open === null ? null : words[open];
  return (
    <div>
      <p className="eyebrow mb-2">Word by word <span className="normal-case tracking-normal text-text-4">· tap a word to find it everywhere</span></p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((x, i) => (
          <button key={i} type="button" className="word" aria-pressed={open === i} onClick={() => setOpen(open === i ? null : i)} title={x[2] || x[3]}>
            <span className="deva text-[16px]" style={{ lineHeight: 1.1 }}>{x[0]}</span>
            <span className="iast text-[12px] text-text-3">{x[1]}</span>
          </button>
        ))}
      </div>
      {w && <Occurrences word={w} onClose={() => setOpen(null)} onOpen={onOpen} />}
    </div>
  );
}

function Occurrences({ word, onClose, onOpen }: { word: Word; onClose: () => void; onOpen?: (id: string) => void }) {
  const [lemmas, setLemmas] = useState<Record<string, [string, string[]]> | null>(null);
  const [ix, setIx] = useState<KbIndex | null>(null);
  useEffect(() => {
    loadLemmas().then(setLemmas);
    loadIndex().then(setIx);
  }, []);
  const entry = lemmas?.[word[3]];
  const groups = useMemo(() => {
    if (!entry || !ix) return [];
    const where = new Map(ix.verseIds.map((v) => [v[0], v]));
    const by = new Map<string, { id: string; ref: string }[]>();
    for (const id of entry[1]) {
      const v = where.get(id);
      if (!v) continue;
      (by.get(v[1]) ?? by.set(v[1], []).get(v[1])!).push({ id, ref: v[2] });
    }
    return ix.texts.filter((t) => by.has(t.id)).map((t) => ({ t, list: by.get(t.id)! }));
  }, [entry, ix]);
  return (
    <div className="card-soft reveal mt-3 p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px]">
            <span className="deva text-[18px]">{word[0]}</span> <span className="iast">{word[1]}</span>
            {word[3] && word[3] !== word[1] && <span className="text-text-3"> · from <span className="iast">{word[3]}</span></span>}
          </p>
          {(word[2] || entry?.[0]) && <p className="mt-0.5 text-[13.5px] text-text-2">{word[2] || entry?.[0]}</p>}
        </div>
        <button className="btn btn-ghost btn-sm !h-7 !px-1.5" onClick={onClose} aria-label="Close word"><IconClose size={13} /></button>
      </div>
      {!lemmas ? (
        <p className="mt-2 text-[12.5px] text-text-3">Finding every occurrence…</p>
      ) : !entry ? (
        <p className="mt-2 text-[12.5px] text-text-3">Only here among the analysed passages.</p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[12.5px] text-text-3">{entry[1].length} analysed passage{entry[1].length === 1 ? "" : "s"} in {groups.length} Upanishad{groups.length === 1 ? "" : "s"}</p>
          {groups.map(({ t, list }) => (
            <div key={t.id} className="text-[13px]">
              <span className="mr-1.5 font-semibold">{t.iast}</span>
              {list.slice(0, 24).map((v) =>
                onOpen ? (
                  <button key={v.id} className="cite mr-1 mb-1" onClick={() => onOpen(v.id)}>{v.ref === "0" ? "śānti" : v.ref}</button>
                ) : (
                  <Link key={v.id} className="cite mr-1 mb-1" href={`/u/${t.id}/${v.ref}`}>{v.ref === "0" ? "śānti" : v.ref}</Link>
                ),
              )}
              {list.length > 24 && <span className="text-text-4">+{list.length - 24} more</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
