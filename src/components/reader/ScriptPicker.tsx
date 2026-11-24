"use client";
// "Script": which script the Sanskrit is read in. A native select, so it is keyboard- and screen-reader-ready.
import { SCRIPTS, setScript, useScript, type ScriptId } from "@/lib/client/script";
import "./reader.css";

export function ScriptPicker() {
  const script = useScript();
  return (
    <label className="sk-pick" title="Read the Sanskrit in another script (a fixed transliteration table, not AI)">
      <span className="sk-pick-k">Script</span>
      <select value={script} onChange={(e) => setScript(e.target.value as ScriptId)} aria-label="Script for the Sanskrit text">
        {SCRIPTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}{s.native && s.id !== "deva" ? ` · ${s.native}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
