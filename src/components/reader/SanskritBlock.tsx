// The Sanskrit of a passage: the chosen script in the Devanagari block's place (ScriptText), then the IAST line.
// The four mahāvākyas and the śānti mantras are set in a sanctum: a double hairline frame after the palm-leaf
// (tālapatra) page, with daṇḍa marks at its corners and a caption let into the top rule. Layer toggles keep working:
// .v-deva / .v-iast are the classes they hide.
import { ScriptText } from "./ScriptText";
import { bindDandas, centred, markLine, sanctumFor, splitMark, unbroken, type Mark } from "./sanctum";
import "./reader.css";

function IastLines({ lines, mark, className }: { lines: string[]; mark?: string; className: string }) {
  const at = markLine(lines, mark);
  return (
    <div className={`v-iast iast sk-iast ${className}`} lang="sa-Latn">
      {lines.map((l, k) => {
        const p = k === at ? splitMark(l, mark) : null;
        return <div key={k}>{p ? <>{bindDandas(p[0])}<b className="sk-mark">{unbroken(p[1])}</b>{bindDandas(p[2])}</> : bindDandas(l)}</div>;
      })}
    </div>
  );
}

export function SanskritBlock({ v }: { v: { id: string; shanti?: boolean; section: string; sa: string[]; iast: string[] } }) {
  const s = sanctumFor(v);
  if (!s) {
    return (
      <>
        <ScriptText sa={v.sa} iast={v.iast} className="mt-6" />
        <IastLines lines={v.iast} className="mt-4" />
      </>
    );
  }
  const mark: Mark | undefined = s.mark;
  return (
    <section className="sk-frame" data-kind={s.kind} data-align={s.kind === "shanti" || centred(v.sa) ? "center" : "start"} aria-label={`${s.label}${s.name ? `: ${s.name}` : ""}`}>
      {/* The rules stop short of the corners for the daṇḍas, and part at the top for the caption: nothing is painted over them. */}
      <div className="sk-edge" data-e="t">
        <i aria-hidden />
        <p className="sk-cap">
          <span className="sk-cap-k">{s.label}</span>
          {s.name && (
            <>
              <span className="sk-cap-sep" aria-hidden>·</span>
              <span className="sk-cap-n" lang="sa-Latn">{s.name}</span>
            </>
          )}
        </p>
        <i aria-hidden />
      </div>
      {(["b", "l", "r"] as const).map((e) => <i key={e} className="sk-edge" data-e={e} aria-hidden />)}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span key={c} className="sk-corner" data-c={c} aria-hidden>॥</span>
      ))}
      <ScriptText sa={v.sa} iast={v.iast} mark={mark} />
      <IastLines lines={v.iast} mark={mark?.iast} className="mt-5" />
    </section>
  );
}
