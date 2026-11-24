"use client";
// Plain-English explanations for Sanskrit terms, anywhere on the site. <Term id> wraps a word explicitly; <Gloss>
// takes running text and marks the first mention of each known term. Hover (desktop) or tap (touch) to read.
import Link from "next/link";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GlossaryTerm } from "@/lib/core/types";

const Ctx = createContext<{ terms: GlossaryTerm[]; byId: Map<string, GlossaryTerm>; re: RegExp | null; lookup: (s: string) => GlossaryTerm | undefined }>({ terms: [], byId: new Map(), re: null, lookup: () => undefined });
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Fold diacritics character by character, keeping every index in place (so matches map back onto the original). */
const foldInPlace = (s: string) => Array.from(s.normalize("NFC"), (c) => (c.length === 1 ? (c.normalize("NFD")[0] ?? c).toLowerCase() : c)).join("");

export function GlossaryProvider({ terms, children }: { terms: GlossaryTerm[]; children: ReactNode }) {
  const value = useMemo(() => {
    const byId = new Map(terms.map((t) => [t.id, t]));
    const byForm = new Map<string, GlossaryTerm>();
    for (const t of terms) for (const f of [t.term, ...t.forms]) if (f && f.length > 2) byForm.set(fold(f), t);
    // Match on folded text, so "Atman" in a translation finds the glossary's "ātman".
    const forms = [...new Set(terms.flatMap((t) => [t.term, ...t.forms]).filter((f) => f && f.length > 2).map(fold))].sort((a, b) => b.length - a.length);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = forms.length ? new RegExp(`(?<![\\p{L}\\p{M}])(${forms.map(esc).join("|")})(?![\\p{L}\\p{M}])`, "giu") : null;
    return { terms, byId, re, lookup: (s: string) => byForm.get(fold(s)) };
  }, [terms]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useGlossary = () => useContext(Ctx);

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const { byId } = useGlossary();
  const t = byId.get(id);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 150 > window.innerHeight;
    setPos({ x: Math.min(Math.max(12, r.left), window.innerWidth - 352), y: up ? r.top - 8 : r.bottom + 8, up });
  }, []);
  useEffect(() => {
    if (!open) return;
    place();
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    // Scrolling (including the scroll that keyboard focus causes) moves the tooltip with its term.
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", place, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", place, { capture: true });
    };
  }, [open, place]);
  if (!t) return <>{children}</>;
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="gl-term"
        aria-expanded={open}
        aria-label={`${t.term}: ${t.short}`}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => {
          if (e.pointerType === "touch") return;
          hover.current = setTimeout(() => setOpen(true), 180);
        }}
        onPointerLeave={() => {
          if (hover.current) clearTimeout(hover.current);
          setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children ?? t.term}
      </button>
      {open && pos && (
        <span role="tooltip" className="gl-pop reveal" style={{ left: pos.x, top: pos.y, transform: pos.up ? "translateY(-100%)" : undefined }}>
          <b>{t.term}</b> {t.sa && <span className="deva text-[14px] text-text-3" style={{ lineHeight: 1.35 }}>{t.sa}</span>}
          <span className="mt-1 block">{t.short}</span>
          {t.concept && (
            <Link href={`/map?node=concept:${t.concept}`} className="mt-1.5 inline-block text-[12px] text-accent underline underline-offset-2" onMouseDown={(e) => e.preventDefault()}>
              See it in the map
            </Link>
          )}
        </span>
      )}
    </>
  );
}

/** Running text with the first mention of each glossary term explained. */
export function Gloss({ children, max = 6 }: { children: string; max?: number }) {
  const { re, lookup } = useGlossary();
  if (!re || !children) return <>{children}</>;
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  let last = 0;
  let n = 0;
  const text = children.normalize("NFC");
  const folded = foldInPlace(text);
  if (folded.length !== text.length) return <>{children}</>;
  for (const m of folded.matchAll(re)) {
    const t = lookup(m[0]);
    if (!t || seen.has(t.id) || n >= max) continue;
    seen.add(t.id);
    n++;
    const at = m.index ?? 0;
    out.push(<Fragment key={`t${at}`}>{text.slice(last, at)}</Fragment>);
    out.push(<Term key={`g${at}`} id={t.id}>{text.slice(at, at + m[0].length)}</Term>);
    last = at + m[0].length;
  }
  out.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
