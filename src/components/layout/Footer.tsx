"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/ui/Icons";

export function Footer() {
  const path = usePathname();
  if (path.startsWith("/map")) return null;
  return (
    <footer className="border-t border-line bg-[var(--bg-2)]">
      <div className="gutter grid gap-10 py-14 text-[13.5px] text-text-3 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 text-text">
            <Mark size={26} />
            <span className="text-[16px] font-semibold">UpaSārathi</span>
            <span className="deva text-[15px] text-text-3" style={{ lineHeight: 1.35 }}>उपसारथि</span>
          </div>
          <p className="mt-3 max-w-[42ch] leading-relaxed">
            <i>Upa</i>, near; <i>sārathi</i>, the charioteer. A reflective and research tool built on the Principal Upanishads, not a source of religious authority or personal advice. Editorial links are labelled as editorial.
          </p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-3 space-y-1.5">
            <li><Link className="hover:text-text" href="/u">Read the 13 Upanishads</Link></li>
            <li><Link className="hover:text-text" href="/paths">Guided paths</Link></li>
            <li><Link className="hover:text-text" href="/map">Map · Veda → Upanishad</Link></li>
            <li><Link className="hover:text-text" href="/harness">Test an AI</Link></li>
            <li><Link className="hover:text-text" href="/about">About, sources and method</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Sources</p>
          <ul className="mt-3 space-y-1.5">
            <li>Devanagari, IAST, chant: <a className="underline decoration-line-3 underline-offset-2 hover:text-text" href="https://upanishads.org.in/" target="_blank" rel="noreferrer">upanishads.org.in</a></li>
            <li>Translations: Panoli, Gambhīrānanda, Swahananda, Mādhavānanda, Tyāgīśānanda, Krishna Warrier</li>
            <li>Kauṣītaki and Maitrī Sanskrit: <a className="underline decoration-line-3 underline-offset-2 hover:text-text" href="https://sa.wikisource.org/" target="_blank" rel="noreferrer">Wikisource</a></li>
            <li>Śaṅkara&apos;s commentary via <a className="underline decoration-line-3 underline-offset-2 hover:text-text" href="https://www.wisdomlib.org/" target="_blank" rel="noreferrer">Wisdom Library</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">The series</p>
          <ul className="mt-3 space-y-1.5">
            <li><a className="hover:text-text" href="https://gitaviswa.vercel.app" target="_blank" rel="noreferrer">GitaViśva</a> · the Bhagavad Gītā</li>
            <li>VedAnvaya · the Vedas</li>
            <li>UpaSārathi · the Upanishads</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
