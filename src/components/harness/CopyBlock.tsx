"use client";
import { useState } from "react";
import { IconCheck, IconCopy } from "@/components/ui/Icons";

/** A shell command with a copy button. Lines starting with "#" render as comments. */
export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"));
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="term relative !pr-14">
      {label && <div className="c mb-1">{label}</div>}
      {code.split("\n").map((l, i) => (
        <div key={i} className={l.trim().startsWith("#") ? "c" : ""}>
          {l.trim().startsWith("#") ? l : (<><span className="p">$ </span>{l}</>)}
        </div>
      ))}
      <button onClick={copy} className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg border border-[rgba(255,255,255,0.12)] text-[#b4bcb5] hover:text-white" aria-label="Copy">
        {done ? <IconCheck size={15} /> : <IconCopy size={15} />}
      </button>
    </div>
  );
}
