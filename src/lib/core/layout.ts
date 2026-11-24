// The cosmos layout: one source of truth for the build (scripts/lib/compile.mjs precomputes positions with
// d3-force-3d) and the browser (which places nodes directly and never runs a simulation). No runtime imports.
//
// The thirteen Upanishads sit on a ring grouped by the Veda each one closes (the Veda-Sāra view): Ṛgveda,
// Śukla Yajurveda, Kṛṣṇa Yajurveda, Sāmaveda, Atharvaveda, with a gap between Vedas and each Veda's node just
// outside its arc. Mantras cluster around their Upanishad; the ideas form a mandala of rings inside.

export const RING_R = 640;
export const LAYOUT_TICKS = 300;
export const ALPHA_DECAY = 0.024;
export const VELOCITY_DECAY = 0.36;
export const CHARGE = { strength: -22, distanceMax: 380 };

/** Veda sectors in ring order; each Upanishad's position is set by its Veda and its order within it. */
/** The four Vedas, in their traditional order. The Yajurveda's two sections (Śukla, Kṛṣṇa) are one Veda. */
export const VEDA_ORDER = ["rig", "yajur", "sama", "atharva"];

const LINK_DIST: Record<string, number> = { PART_OF: 42, NEXT: 10, TEACHES: 420, DIAGNOSES: 420, IN_STORY: 360, CONTRASTS_WITH: 80, GROUNDS: 90, CROSS_REFERENCES: 260, ROOTED_IN: 260, READ_BY: 260, CITES: 300 };
const LINK_STR: Record<string, number> = { PART_OF: 0.85, NEXT: 0.45, TEACHES: 0.006, DIAGNOSES: 0.006, IN_STORY: 0.01, CONTRASTS_WITH: 0.25, GROUNDS: 0.2, CROSS_REFERENCES: 0.004, ROOTED_IN: 0.01, READ_BY: 0.008, CITES: 0.003 };
export const linkDistance = (type: string) => LINK_DIST[type] ?? 120;
export const linkStrength = (type: string) => LINK_STR[type] ?? 0.04;

/** Fixed rings of the teaching core, as fractions of RING_R, with a little height so the mandala reads in 3D. */
export const CORE_RINGS: Record<string, { r: number; y: number }> = {
  Axis: { r: 0.1, y: 60 },
  Concept: { r: 0.26, y: 34 },
  Dilemma: { r: 0.36, y: 12 },
  Story: { r: 0.46, y: -6 },
  Person: { r: 0.55, y: -22 },
  Stem: { r: 0.72, y: 120 },
};

/** Angle of hub `slot` among `slots` positions around the ring (slots include one gap between Vedas). */
export function slotAngle(slot: number, slots: number): number {
  return (slot / slots) * Math.PI * 2 - Math.PI / 2;
}
export function hubPosition(angle: number): [number, number, number] {
  return [RING_R * Math.cos(angle), 34 * Math.sin(angle * 3), RING_R * Math.sin(angle)];
}
export function vedaPosition(angle: number): [number, number, number] {
  return [RING_R * 1.42 * Math.cos(angle), 70, RING_R * 1.42 * Math.sin(angle)];
}

/** Where each kind of node settles: passages at the rim with their Upanishad, the teaching core in the middle. */
export function radialTarget(type: string): number {
  switch (type) {
    case "Verse": return RING_R * 1.02;
    case "Person": return RING_R * 0.5;
    case "External": return RING_R * 1.62;
    case "Story": return RING_R * 0.42;
    case "Axis": return RING_R * 0.12;
    default: return RING_R * 0.3;
  }
}
export const radialStrength = (type: string) => (type === "Verse" ? 0.05 : type === "External" ? 0.3 : type === "Person" ? 0.35 : 0.55);

type SimNode = { type: string; x?: number; y?: number; z?: number; vx?: number; vy?: number; vz?: number; fx?: number };

/** Passages stay near the rim; ideas, situations, stories and people stay inside the ring; all near the plane. */
export function containForce() {
  let nodes: SimNode[] = [];
  return Object.assign(
    (alpha: number) => {
      for (const n of nodes) {
        if (n.fx !== undefined || n.x === undefined || n.z === undefined) continue;
        const r = Math.hypot(n.x, n.z);
        const max = n.type === "Verse" ? RING_R * 1.3 : n.type === "External" ? RING_R * 1.75 : RING_R * 0.66;
        if (r > max) {
          const k = ((r - max) / r) * alpha * 0.4;
          n.vx = (n.vx ?? 0) - n.x * k;
          n.vz = (n.vz ?? 0) - n.z * k;
        }
        n.vy = (n.vy ?? 0) - (n.y ?? 0) * alpha * (n.type === "Verse" ? 0.05 : 0.025);
      }
    },
    { initialize: (ns: SimNode[]) => (nodes = ns) },
  );
}
