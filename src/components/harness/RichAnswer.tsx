"use client";
// Model text → React elements (never raw HTML). Supports paragraphs, lists, headings, quotes, simple tables,
// **bold**, *italic*, clickable citations, and highlighted spans (flagged or verified).
import { Fragment, type ReactNode } from "react";
import { CiteChip } from "@/components/verse/Drawer";
import { Gloss } from "@/components/ui/Glossary";
import type { Citation } from "@/lib/core/citations";

export interface Highlight {
  text: string;
  kind: "flag" | "ok";
  title?: string;
}

export function RichAnswer({ text, cites = [], highlights = [], caret = false, className = "" }: { text: string; cites?: Citation[]; highlights?: Highlight[]; caret?: boolean; className?: string }) {
  const blocks = toBlocks(text);
  return (
    <div className={`answer ${className}`}>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1 && caret;
        const inl = (s: string) => inline(s, cites, highlights);
        if (b.kind === "h") return <h3 key={i}>{inl(b.text)}</h3>;
        if (b.kind === "quote") return <blockquote key={i}>{inl(b.text)}</blockquote>;
        if (b.kind === "ul") return <ul key={i} className={last ? "caret" : ""}>{b.items.map((t, j) => <li key={j}>{inl(t)}</li>)}</ul>;
        if (b.kind === "ol") return <ol key={i} className={last ? "caret" : ""}>{b.items.map((t, j) => <li key={j}>{inl(t)}</li>)}</ol>;
        if (b.kind === "table")
          return (
            <table key={i}>
              <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => (j === 0 ? <th key={k}>{inl(c)}</th> : <td key={k}>{inl(c)}</td>))}</tr>)}</tbody>
            </table>
          );
        return <p key={i} className={last ? "caret" : ""}>{inl("text" in b ? b.text : "")}</p>;
      })}
      {!blocks.length && caret && <p className="caret" />}
    </div>
  );
}

type Block = { kind: "p" | "h" | "quote"; text: string } | { kind: "ul" | "ol"; items: string[] } | { kind: "table"; rows: string[][] };
function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimEnd();
    if (!l.trim() || /^-{3,}$/.test(l.trim())) { flush(); continue; }
    const h = l.match(/^#{1,6}\s+(.*)/);
    if (h) { flush(); out.push({ kind: "h", text: h[1] }); continue; }
    if (/^\s*>/.test(l)) { flush(); out.push({ kind: "quote", text: l.replace(/^\s*>\s?/, "") }); continue; }
    if (/^\s*\|/.test(l)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        // a model's "<br>" inside a cell is a line break, never shown as markup
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim().replace(/\s*<br\s*\/?>\s*/gi, " · ")));
        i++;
      }
      i--;
      out.push({ kind: "table", rows });
      continue;
    }
    const ul = l.match(/^\s*[-*•]\s+(.*)/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      const prev = out[out.length - 1];
      const item = (ul || ol)![1];
      if (prev && prev.kind === kind) prev.items.push(item);
      else out.push({ kind, items: [item] });
      continue;
    }
    para.push(l.trim());
  }
  flush();
  return out;
}

function inline(raw: string, cites: Citation[], highlights: Highlight[]): ReactNode {
  // "**[KaU 1.1.27]**": emphasis wrapped round a citation would otherwise pair with the wrong asterisks.
  const s = raw.replace(/\*\*(\s*\[[^\]\n]{2,80}\]\s*)\*\*/g, "$1");
  const tokens = [
    ...cites.map((c) => ({ s: c.raw, kind: "cite" as const, c })),
    ...highlights.filter((h) => h.text.trim().length > 2).map((h) => ({ s: h.text, kind: "hl" as const, h })),
  ].sort((a, b) => b.s.length - a.s.length);
  const parts: ReactNode[] = [];
  let rest = s;
  let key = 0;
  while (rest) {
    let best: { i: number; t: (typeof tokens)[number] } | null = null;
    for (const t of tokens) {
      const i = rest.indexOf(t.s);
      if (i >= 0 && (!best || i < best.i)) best = { i, t };
    }
    if (!best) { parts.push(<Fragment key={key++}>{emph(rest)}</Fragment>); break; }
    if (best.i > 0) parts.push(<Fragment key={key++}>{emph(rest.slice(0, best.i))}</Fragment>);
    const t = best.t;
    if (t.kind === "cite") parts.push(t.c.id ? <CiteChip key={key++} id={t.c.id} label={t.c.raw.slice(1, -1).replace(/^(Concept|Story):\s*/, "")} /> : <span key={key++} className="muted">{t.s}</span>);
    else parts.push(<mark key={key++} className={t.h.kind} title={t.h.title}>{emph(t.s)}</mark>);
    rest = rest.slice(best.i + t.s.length);
  }
  return parts;
}

function emph(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g);
  return parts.map((p, i) =>
    /^\*\*.*\*\*$/.test(p) ? (
      <strong key={i}><Gloss max={1}>{p.slice(2, -2)}</Gloss></strong>
    ) : /^(\*|_).*(\*|_)$/.test(p) && p.length > 2 ? (
      <em key={i}><Gloss max={1}>{p.slice(1, -1)}</Gloss></em>
    ) : (
      <Fragment key={i}><Gloss max={2}>{p}</Gloss></Fragment>
    ),
  );
}
