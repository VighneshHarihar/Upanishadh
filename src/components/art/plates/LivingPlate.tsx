// The Living Plates, mounted from server pages. Each plate's text is read from the corpus by plate-data.ts and handed
// to the client plate as props.
//   <LivingPlate verseId="KaU_1.3.5" />   on a mantra page: the right plate for that verse, or nothing
//   <PathPlate pathId="chariot" />        in a guided path; pathPlateStep() says at which step it belongs
//   <GoldenLidOrnament />                 the compact lid in the /harness header
import { ChariotPlate } from "./ChariotPlate";
import { GoldenLidPlate } from "./GoldenLidPlate";
import { SheathsPlate } from "./SheathsPlate";
import { StatesPlate } from "./StatesPlate";
import { PATHS, chariot, lid, plateKind, sheaths, states, type Kind } from "./plate-data";

// ── mounts ────────────────────────────────────────────────────────────────────────────────────────────────────
function Plate({ kind, focus, level }: { kind: Kind; focus?: string; level: 2 | 3 }) {
  if (kind === "chariot") {
    const d = chariot();
    return d ? <ChariotPlate data={d} focus={focus} level={level} /> : null;
  }
  if (kind === "lid") {
    const d = lid();
    return d ? <GoldenLidPlate data={d} focus={focus} level={level} /> : null;
  }
  if (kind === "sheaths") {
    const d = sheaths();
    return d ? <SheathsPlate data={d} focus={focus} level={level} /> : null;
  }
  const d = states();
  return d ? <StatesPlate data={d} focus={focus} level={level} /> : null;
}

/** The plate for a landmark mantra (KaU 1.3.3–9, IU 15, TU 2.1–5, MaU 3–7), or nothing. */
export function LivingPlate({ verseId }: { verseId: string }) {
  const kind = plateKind(verseId);
  return kind ? <Plate kind={kind} focus={verseId} level={2} /> : null;
}

/** The step of a guided path at which its plate belongs (the first step on one of the plate's passages), or -1. */
export function pathPlateStep(pathId: string, nodes: string[]): number {
  const kind = PATHS[pathId];
  if (!kind) return -1;
  const i = nodes.findIndex((n) => plateKind(n) === kind);
  return i >= 0 ? i : 0;
}

/** The plate for a guided path, or nothing. `focus` is the passage of the step it sits in. */
export function PathPlate({ pathId, focus }: { pathId: string; focus?: string }) {
  const kind = PATHS[pathId];
  return kind ? <Plate kind={kind} focus={focus} level={3} /> : null;
}

/** The compact golden lid for the /harness header (drawn in the dark palette, over the painting). */
export function GoldenLidOrnament() {
  const d = lid();
  return d ? <GoldenLidPlate data={d} compact tone="art" /> : null;
}
