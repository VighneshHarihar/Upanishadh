import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRun, runIds } from "@/lib/server/data";
import { runContext } from "@/lib/server/runctx";
import { ReplayPage } from "@/components/harness/ReplayPage";

export const dynamicParams = false;
export function generateStaticParams() {
  return runIds().map((id) => ({ id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getRun(id)?.title ?? "Run" };
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) notFound();
  return (
    <div className="gutter fab-clear pt-6">
      <div className="capture-hide mb-4 flex items-center justify-between gap-2 text-[13px]">
        <Link href="/harness" className="text-text-3 hover:text-text">← Harness</Link>
        <Link href={`/harness/compare/${id}`} className="btn btn-sm">Compare view</Link>
      </div>
      <h1 className="mb-4 text-[26px] font-semibold tracking-tight">{run.title}</h1>
      <ReplayPage run={run} ctx={runContext(run)} />
    </div>
  );
}
