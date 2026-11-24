import { Ready } from "@/components/ui/Ready";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-20 text-center">
      <Ready />
      <p className="deva text-[24px] text-text-3">नेति नेति</p>
      <h1 className="mt-2 text-[28px] font-semibold">Not this, not this</h1>
      <p className="mt-2 text-text-2">This page is not in the corpus.</p>
      <Link href="/" className="btn mt-6">Back to the arena</Link>
    </div>
  );
}
