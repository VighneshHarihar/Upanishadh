import { Ready } from "@/components/ui/Ready";
import Link from "next/link";
import type { Metadata } from "next";
import { getPaths } from "@/lib/server/data";
import { Art } from "@/components/ui/Art";
import { IconArrow } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Guided paths" };

export default function PathsPage() {
  const paths = getPaths();
  return (
    <>
      <Ready />
      <Art name="ashram" alt="A teacher and students seated in a circle beneath a great banyan by a river" className="flex min-h-[clamp(400px,56vh,600px)] items-end" position="50% 62%">
        <div className="gutter on-art w-full pb-14 pt-24">
          <p className="eyebrow !text-[rgba(241,239,233,0.62)]">Guided paths</p>
          <h1 className="display mt-3 text-[clamp(40px,5vw,76px)] leading-[1.02]">Start with a story, not a graph.</h1>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[rgba(241,239,233,0.85)]">Short routes through the texts, mantra by mantra, each ending with a question in your own words. Your progress stays on this device.</p>
        </div>
      </Art>
      <div className="gutter grid gap-4 pb-24 pt-12 md:grid-cols-2 2xl:grid-cols-3">
        {paths.map((p, i) => (
          <Link key={p.id} href={`/paths/${p.id}`} className="tile group flex min-h-[300px] flex-col p-7">
            <span className="flex items-center justify-between text-[13px] text-text-4">
              <span className="num">0{i + 1}</span>
              <span>{p.steps.length} steps · about {p.minutes} min</span>
            </span>
            <span className="display mt-8 text-[34px] leading-tight">{p.title}</span>
            <span className="mt-1 text-[14.5px] text-accent">{p.subtitle}</span>
            <span className="mt-4 text-[15px] leading-relaxed text-text-2">{p.intro}</span>
            <span className="mt-auto flex items-center gap-2 pt-6 text-[14px] font-medium text-text-3 group-hover:text-text">
              Begin <IconArrow size={15} className="transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
