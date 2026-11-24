import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getKb, getRun, runIds } from "@/lib/server/data";
import { runContext } from "@/lib/server/runctx";
import { CompareView } from "@/components/harness/CompareView";

export const dynamicParams = false;
export function generateStaticParams() {
  return runIds().map((c) => ({ case: c }));
}
export async function generateMetadata({ params }: { params: Promise<{ case: string }> }): Promise<Metadata> {
  const p = await params;
  return { title: `Compare · ${getRun(p.case)?.title ?? ""}` };
}

export default async function ComparePage({ params }: { params: Promise<{ case: string }> }) {
  const p = await params;
  const run = getRun(p.case);
  if (!run) notFound();
  // The counter-verse is the request's own remedy: the first verse the top dilemma lists as remedying it.
  const top = getKb().dilemmas.find((d) => d.id === run.diagnosis.dilemmas[0]?.id);
  const remedy = top?.verses.find((v) => v.role === "remedies")?.verse ?? run.diagnosis.verses[0]?.id ?? null;
  const ctx = runContext(run, remedy ? [remedy] : []);
  return <CompareView run={run} ctx={ctx} counterVerse={remedy} />;
}
