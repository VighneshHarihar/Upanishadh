"use client";
// Chat with the graph. Every question is first answered by the graph itself (retrieval over mantras, concepts,
// situations and stories); with a model connected, the model writes the answer from that evidence and every citation
// is checked against the corpus before it is shown. Without a key the graph composes the answer on its own.
import { useEffect, useRef } from "react";
import { askStore, useAsk, type AskMessage } from "@/lib/client/ask-store";
import { hasKey, useSettings } from "@/lib/client/settings";
import { PROVIDERS } from "@/lib/core/llm";
import { ui } from "@/lib/client/ui-store";
import { RichAnswer } from "@/components/harness/RichAnswer";
import { IconKey, IconOrbit, IconSend, IconTrash, Mark } from "@/components/ui/Icons";
import { SUGGESTIONS } from "./suggestions";



export function AskPanel({ onShowInGraph, inExplore = false }: { onShowInGraph: (m: AskMessage) => void; inExplore?: boolean }) {
  const { messages, busy, draft } = useAsk();
  const s = useSettings();
  const connected = hasKey(s);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.text]);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [draft]);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const send = () => {
    if (draft.trim() && !busy) askStore.ask(draft);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!messages.length ? (
          <div className="reveal">
            <div className="flex items-center gap-3">
              <Mark size={34} />
              <div>
                <p className="display text-[22px]">Ask the Upanishads</p>
                <p className="text-[13px] text-text-3">Answers drawn from the 13 Principal Upanishads, with every citation checked.</p>
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-text-2">
              Ask about an idea, a passage, or something you are facing. Sārathi finds the mantras, concepts and stories that bear on it{inExplore ? ", lights them up in the cosmos," : ""} and answers from them.
            </p>
            <div className="mt-4 grid gap-2">
              {SUGGESTIONS.slice(0, 6).map((q) => (
                <button key={q} className="ask-suggestion" onClick={() => askStore.ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m) => (m.role === "user" ? <UserTurn key={m.id} m={m} /> : <AssistantTurn key={m.id} m={m} onShowInGraph={onShowInGraph} inExplore={inExplore} />))}
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 pb-4 pt-3">
        <div className="ask-input">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            placeholder={messages.length ? "Ask a follow-up…" : "Ask anything about the Upanishads…"}
            onChange={(e) => askStore.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Your question"
          />
          <button className="btn btn-accent btn-icon shrink-0 !h-9 !w-9 !rounded-full" onClick={send} disabled={!draft.trim() || busy} aria-label="Ask">
            <IconSend size={17} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-text-3">
          <button className="inline-flex min-w-0 items-center gap-1.5 hover:text-text" onClick={ui.openSettings}>
            <span className="dot" style={{ background: connected ? "var(--accent)" : "var(--text-4)" }} />
            <span className="truncate">{connected ? `${PROVIDERS[s.provider].name} · ${s.model}` : "Graph only · connect a model for written answers"}</span>
            {!connected && <IconKey size={12} />}
          </button>
          {messages.length > 0 && (
            <button className="inline-flex items-center gap-1 hover:text-text" onClick={askStore.clear} disabled={busy}>
              <IconTrash size={12} /> New conversation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UserTurn({ m }: { m: AskMessage }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[88%] rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[14.5px] leading-relaxed">{m.text}</p>
    </div>
  );
}

function AssistantTurn({ m, onShowInGraph, inExplore }: { m: AskMessage; onShowInGraph: (m: AskMessage) => void; inExplore: boolean }) {
  const sources = new Set(m.citations.filter((c) => c.id).map((c) => c.id)).size;
  return (
    <div className="reveal">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] text-text-3">
        <Mark size={16} />
        <span className="font-semibold text-text-2">Sārathi</span>
        {m.offline && !m.pending && <span className="chip !py-0 !text-[11px]">from the graph</span>}
        {m.model && <span className="truncate">{m.model}</span>}
      </div>
      {m.pending && !m.text ? (
        <p className="thinking text-[14px] text-text-3">Reading the mantras</p>
      ) : (
        <RichAnswer text={m.text} cites={m.citations} caret={m.pending} className="!text-[15px]" />
      )}
      {m.error && <p className="mt-2 rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-[12.5px] text-text-3">{m.error}. Showing what the graph can say on its own.</p>}
      {!m.pending && m.subgraph && m.subgraph.nodes.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button className="btn btn-sm" onClick={() => onShowInGraph(m)}>
            <IconOrbit size={14} /> {inExplore ? "Light up in the cosmos" : "See it in the cosmos"}
          </button>
          <span className="text-[12px] text-text-3">
            {sources ? `${sources} source${sources === 1 ? "" : "s"} cited · ` : ""}
            {m.subgraph.nodes.length} nodes behind this answer
          </span>
        </div>
      )}
    </div>
  );
}
