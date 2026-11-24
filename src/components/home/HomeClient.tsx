"use client";
// The interactive pieces of the home page: a live preview of the cosmos (loaded only when it scrolls into view),
// the ask box, and buttons that open the conversation.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GEdge, GNode } from "@/lib/core/types";
import { MiniGraph } from "@/components/graph/MiniGraph";
import { useEffect, useRef, useState } from "react";
import { askStore, useAsk } from "@/lib/client/ask-store";
import { useReady } from "@/lib/client/capture";
import { IconChat, IconSend } from "@/components/ui/Icons";

const Cosmos3D = dynamic(() => import("@/components/explore/Cosmos3D"), { ssr: false });

export function CosmosPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      {show ? (
        <Cosmos3D preview onPick={(id) => router.push(`/map?node=${encodeURIComponent(id)}`)} />
      ) : (
        <div className="grid h-full place-items-center">
          <p className="thinking text-[14px] text-text-3">Gathering the cosmos</p>
        </div>
      )}
    </div>
  );
}

/** The compact Veda → Upanishad map: five roots, thirteen texts. Click to open either in the Map. */
export function VedaMiniMap({ nodes, edges, height = 460 }: { nodes: GNode[]; edges: GEdge[]; height?: number }) {
  const router = useRouter();
  return <MiniGraph nodes={nodes} edges={edges} direction="LR" height={height} emblems onPick={(id) => router.push(`/map?node=${encodeURIComponent(id)}&roots=1`)} />;
}

export function AskOpen({ children, className = "btn btn-outline btn-lg", question }: { children: React.ReactNode; className?: string; question?: string }) {
  return (
    <button className={className} onClick={() => (question ? askStore.ask(question) : askStore.open())}>
      {children}
    </button>
  );
}

export function HomeAsk({ suggestions }: { suggestions: string[] }) {
  const { draft, busy } = useAsk();
  const [q, setQ] = useState("");
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    askStore.ask(text.trim());
    setQ("");
  };
  return (
    <div>
      <form
        className="ask-hero"
        onSubmit={(e) => {
          e.preventDefault();
          send(q || draft);
        }}
      >
        <IconChat size={20} className="ml-2 shrink-0 text-accent" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about an idea, a passage, or something you are facing…" aria-label="Ask the Upanishads" />
        <button className="btn btn-accent btn-lg shrink-0 !rounded-full" disabled={!q.trim() || busy}>
          Ask <IconSend size={16} />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button key={s} className="chip-q !max-w-[420px] border border-line-2 bg-[var(--surface)]" onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Static pages report ready for capture once fonts are in. */
export function HomeReady() {
  useReady(true);
  return null;
}
