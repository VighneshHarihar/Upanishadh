"use client";
// The Sanskrit in the reader's chosen script, in the place of the Devanagari block. Devanagari and IAST come from the
// corpus as they are; the seven regional scripts are made from the Devanagari by a fixed table, fetched on first use
// (a few kilobytes) and then applied synchronously on every passage. Until the chosen script is ready (before
// hydration, or while the table loads) the block holds its space and stays blank rather than flashing Devanagari;
// CSS shows the Devanagari after a moment anyway if scripts never run.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { SCRIPT_BOOT, isRegional, scriptInfo, useHydrated, useScript, type RegionalScript } from "@/lib/client/script";
import { bindDandas, markLine, splitMark, unbroken, type Mark } from "./sanctum";
import "./reader.css";

type Translit = typeof import("./translit");
let mod: Translit | null = null;
let loading: Promise<Translit> | null = null;
const load = () =>
  (loading ??= import("./translit").then(
    (m) => (mod = m),
    (e) => {
      loading = null; // offline for a moment: the next choice tries again (meanwhile CSS shows the Devanagari)
      throw e;
    },
  ));

/** Tamil superscripts and modifier marks set as Latin, so ² ³ ⁴ match in size whatever Tamil font is in use. */
function tamilType(s: string, t: Translit): ReactNode {
  const parts = s.split(t.TAMIL_MARKS);
  return parts.map((p, i) => (i % 2 ? <span key={i} className="sk-mod">{p}</span> : <Fragment key={i}>{p}</Fragment>));
}

export function ScriptText({ sa, iast, mark, className = "" }: { sa: string[]; iast: string[]; mark?: Mark; className?: string }) {
  const script = useScript();
  const hydrated = useHydrated();
  const [, setReady] = useState(0);
  const regional = isRegional(script);

  useEffect(() => {
    document.documentElement.dataset.script = script;
    if (regional && !mod) load().then(() => setReady((n) => n + 1), () => {});
  }, [script, regional]);

  const t = regional ? mod : null;
  const shown = script === "iast" ? "iast" : t ? script : "deva";
  const lines = shown === "iast" ? iast : sa;
  const target = shown === "iast" ? mark?.iast : mark?.deva;
  const at = markLine(lines, target);
  const render = (raw: string, keep = false): ReactNode => {
    const s = keep ? unbroken(raw) : bindDandas(raw);
    if (!t) return s;
    const out = t.transliterate(s, shown as RegionalScript);
    return shown === "taml" ? tamilType(out, t) : out;
  };

  return (
    <>
      {/* Server HTML and hydration only: React never creates (or warns about) it on the client. */}
      {!hydrated && <script dangerouslySetInnerHTML={{ __html: SCRIPT_BOOT }} />}
      <div
        className={`v-deva sk-primary ${className}`}
        data-script={shown}
        data-pending={!hydrated || (regional && !t) ? "" : undefined}
        lang={scriptInfo(shown).lang}
      >
        {lines.map((l, k) => {
          const parts = k === at ? splitMark(l, target) : null;
          return (
            <div key={k}>
              {parts ? (
                <>
                  {render(parts[0])}
                  <b className="sk-mark">{render(parts[1], true)}</b>
                  {render(parts[2])}
                </>
              ) : (
                render(l)
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
