import type { Metadata } from "next";
import { ExploreApp } from "@/components/explore/ExploreApp";

export const metadata: Metadata = {
  title: "Map · Veda → Upanishad",
  description:
    "The four Vedas, the thirteen Principal Upanishads that distil them, and every mantra, idea, story and key word between them. Focus on one idea at a time, find the path between two, or ask a question and watch the evidence light up.",
};

export default function MapPage() {
  return <ExploreApp />;
}
