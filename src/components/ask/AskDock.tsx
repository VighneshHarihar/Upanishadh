"use client";
// The conversation, available on every page from the top bar's Ask button or Ctrl J (Explore has it built into its
// side panel instead). There is no floating button over the page.
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { askStore, useAsk, type AskMessage } from "@/lib/client/ask-store";
import { explore } from "@/lib/client/explore-store";
import { AskPanel } from "./AskPanel";
import { IconClose } from "@/components/ui/Icons";

export function AskDock() {
  const path = usePathname();
  const router = useRouter();
  const { open } = useAsk();
  const inExplore = path.startsWith("/map");
  useEffect(() => askStore.hydrate(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (inExplore) explore.setDock(explore.get().dock === "ask" ? null : "ask");
        else askStore.toggle();
      } else if (e.key === "Escape" && open && !inExplore) askStore.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inExplore]);

  if (inExplore) return null;
  const show = (m: AskMessage) => {
    askStore.showInGraph(m);
    askStore.close();
    explore.setDock("ask");
    router.push("/map");
  };
  return (
    <>
      {open && (
        <>
          <div className="scrim lg:hidden" onClick={askStore.close} />
          <aside className="ask-dock reveal" role="dialog" aria-label="Ask the Upanishads">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="eyebrow">Conversation</span>
              <button className="btn btn-ghost btn-sm" onClick={askStore.close} aria-label="Close">
                <IconClose />
              </button>
            </div>
            <AskPanel onShowInGraph={show} />
          </aside>
        </>
      )}
    </>
  );
}
