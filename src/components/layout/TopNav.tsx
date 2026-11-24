"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBook, IconHome, IconKey, IconMap, IconMoon, IconRoute, IconScale, IconSearch, IconSun, Mark } from "@/components/ui/Icons";
import { hasKey, useSettings } from "@/lib/client/settings";
import { PROVIDERS } from "@/lib/core/llm";
import { toggleTheme } from "@/lib/client/theme";
import { ui } from "@/lib/client/ui-store";
import { askStore } from "@/lib/client/ask-store";
import { explore } from "@/lib/client/explore-store";

// Five destinations: the arena (home), the 13 texts, guided paths, the Veda → Upanishad map, and the AI test.
const LINKS = [
  { href: "/", label: "Home", icon: IconHome, title: "Home: the arena" },
  { href: "/u", label: "Read", icon: IconBook, title: "Read the 13 Principal Upanishads" },
  { href: "/paths", label: "Paths", icon: IconRoute, title: "Guided reading paths" },
  { href: "/map", label: "Map", icon: IconMap, title: "Map: Veda → Upanishad → mantra" },
  { href: "/harness", label: "Test an AI", icon: IconScale, title: "Test an AI against the Upanishads" },
];
const isOn = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function TopNav() {
  const path = usePathname();
  const settings = useSettings();
  const connected = hasKey(settings);
  // On the home page the bar floats transparently over the painting until the page scrolls.
  const [overArt, setOverArt] = useState(path === "/");
  useEffect(() => {
    if (path !== "/") return setOverArt(false);
    const on = () => setOverArt(window.scrollY < 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topnav" data-over-art={overArt ? "1" : undefined}>
      <div className="gutter flex h-[60px] items-center gap-3 lg:gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="UpaSārathi, home">
          <Mark size={28} />
          <span className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold tracking-tight">UpaSārathi</span>
            <span className="deva hidden text-[15px] opacity-60 xl:inline" style={{ lineHeight: 1.35 }}>उपसारथि</span>
          </span>
        </Link>
        <nav className="seg ml-1 hidden md:inline-flex" aria-label="Main">
          {LINKS.map((l) => {
            const on = isOn(path, l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} title={l.title}>
                <l.icon size={15} />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        {/* Ask lives in the bar, not in a floating button over the page (Ctrl J anywhere) */}
        <button className="btn btn-sm capture-hide !h-9" onClick={() => (path.startsWith("/map") ? explore.setDock("ask") : askStore.open())} aria-label="Ask the Upanishads" title="Ask the Upanishads (Ctrl J)">
          <Mark size={16} />
          <span className="hidden md:inline">Ask</span>
        </button>
        <button className="navsearch capture-hide" onClick={ui.openPalette} aria-label="Search">
          <IconSearch size={15} />
          <span className="hidden lg:inline">Search mantras, ideas, stories</span>
          <span className="kbd hidden lg:inline">Ctrl K</span>
        </button>
        <button className="btn btn-ghost btn-icon capture-hide" onClick={toggleTheme} aria-label="Switch theme" title="Switch theme">
          <IconSun size={17} className="hidden [[data-theme=dark]_&]:block" />
          <IconMoon size={17} className="hidden [[data-theme=light]_&]:block" />
        </button>
        <button className="btn btn-sm capture-hide !h-9" onClick={ui.openSettings} aria-label="Model settings" title={connected ? `${PROVIDERS[settings.provider].name} · ${settings.model}` : "Connect a model with your own key"}>
          <span className="dot" style={{ background: connected ? "var(--accent)" : "var(--text-4)" }} />
          <span className="hidden sm:inline">{connected ? PROVIDERS[settings.provider].name : "Connect a model"}</span>
          {!connected && <IconKey size={13} className="sm:hidden" />}
        </button>
      </div>
      <nav className="topnav-mobile gutter flex h-[44px] items-center gap-1 overflow-x-auto border-t border-line md:hidden" aria-label="Main (mobile)">
        {LINKS.map((l) => {
          const on = isOn(path, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] ${on ? "bg-surface-3 text-text" : "text-text-3"}`}>
              <l.icon size={14} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
