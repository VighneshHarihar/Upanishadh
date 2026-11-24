import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCorpus, getKb, getPaths } from "@/lib/server/data";
import { PathView, type StepData } from "@/components/paths/PathView";
import { PathPlate, pathPlateStep } from "@/components/art/plates/LivingPlate";
import { IconArrow } from "@/components/ui/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getPaths().map((p) => ({ id: p.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = getPaths().find((x) => x.id === id);
  return { title: p?.title ?? "Path", description: p?.intro };
}

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paths = getPaths();
  const path = paths.find((p) => p.id === id);
  if (!path) notFound();
  const kb = getKb();
  const steps: StepData[] = path.steps.map((s) => {
    const lite = kb.verses.find((v) => v.id === s.node);
    if (lite) {
      const v = getCorpus(lite.up).find((x) => x.id === s.node)!;
      const t = kb.texts.find((x) => x.id === lite.up)!;
      return { ...s, verse: { id: v.id, label: `${t.abbrev} ${v.ref}`, up: v.up, ref: v.ref, sa: v.sa, iast: v.iast, tr: v.tr?.text ?? "", trBy: v.tr?.by ?? "", audio: v.audio?.mp3 ?? null, hasBhashya: v.hasBhashya } };
    }
    const c = kb.concepts.find((x) => `concept:${x.id}` === s.node);
    return { ...s, concept: c ? { id: s.node, iast: c.iast, sa: c.sa, en: c.en, desc: c.desc } : undefined };
  });
  const next = paths[paths.indexOf(path) + 1];
  const plateAt = pathPlateStep(path.id, path.steps.map((s) => s.node));
  return (
    <div className="gutter pb-24 pt-8">
      <PathView
        pathId={path.id}
        steps={steps}
        plate={plateAt >= 0 ? <PathPlate pathId={path.id} focus={path.steps[plateAt]?.node} /> : null}
        plateAt={plateAt}
        header={
          <div>
            <Link href="/paths" className="text-[13px] text-text-3 hover:text-text">← All paths</Link>
            <p className="eyebrow mt-6 !text-accent">{path.subtitle}</p>
            <h1 className="display mt-2 text-[clamp(34px,3vw,46px)] leading-[1.05]">{path.title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-text-2">{path.intro}</p>
          </div>
        }
        footer={
          next && (
            <Link href={`/paths/${next.id}`} className="tile mt-12 flex items-center justify-between p-6">
              <span>
                <span className="eyebrow">Next path</span>
                <span className="display mt-1 block text-[26px]">{next.title}</span>
              </span>
              <IconArrow size={20} />
            </Link>
          )
        }
      />
    </div>
  );
}
