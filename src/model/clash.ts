import type { AABB, BimElement, Discipline } from "./types";

/**
 * Clash detection — pure geometry, no three.js. Finds hard clashes (actual
 * volume overlap) between elements of different disciplines, the way a BIM
 * coordination review does. AABB precision is fine here because the model's
 * elements are axis-aligned by construction; the engine is the piece the unit
 * tests pin down.
 */

export type Clash = {
  id: string;
  a: BimElement;
  b: BimElement;
  /** The overlapping region. */
  overlap: AABB;
  /** Overlap volume in m³ — used as a severity proxy. */
  volume: number;
  /** Center of the overlap, for camera fly-to. */
  center: [number, number, number];
};

/** Tolerance below which touching surfaces are not reported (m). */
export const DEFAULT_TOLERANCE = 0.01;

export function intersectAABB(a: AABB, b: AABB, tolerance = DEFAULT_TOLERANCE): AABB | null {
  const min: [number, number, number] = [
    Math.max(a.min[0], b.min[0]),
    Math.max(a.min[1], b.min[1]),
    Math.max(a.min[2], b.min[2]),
  ];
  const max: [number, number, number] = [
    Math.min(a.max[0], b.max[0]),
    Math.min(a.max[1], b.max[1]),
    Math.min(a.max[2], b.max[2]),
  ];
  for (let i = 0; i < 3; i++) {
    if (max[i]! - min[i]! <= tolerance) return null;
  }
  return { min, max };
}

export function aabbVolume(box: AABB): number {
  return (
    (box.max[0] - box.min[0]) *
    (box.max[1] - box.min[1]) *
    (box.max[2] - box.min[2])
  );
}

export type ClashOptions = {
  /** Which discipline pairs to test. Order-insensitive. */
  pairs?: [Discipline, Discipline][];
  tolerance?: number;
};

const DEFAULT_PAIRS: [Discipline, Discipline][] = [
  ["structural", "mep"],
  ["architecture", "mep"],
];

/**
 * Run the clash test across discipline pairs. O(n·m) per pair with an early
 * floor filter — plenty for a model of this size, and the shape a reviewer
 * expects to read in one sitting.
 */
export function detectClashes(elements: BimElement[], options: ClashOptions = {}): Clash[] {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const pairs = options.pairs ?? DEFAULT_PAIRS;

  const byDiscipline = new Map<Discipline, BimElement[]>();
  for (const el of elements) {
    const list = byDiscipline.get(el.discipline) ?? [];
    list.push(el);
    byDiscipline.set(el.discipline, list);
  }

  const clashes: Clash[] = [];
  for (const [da, db] of pairs) {
    const listA = byDiscipline.get(da) ?? [];
    const listB = byDiscipline.get(db) ?? [];
    for (const a of listA) {
      for (const b of listB) {
        // Elements more than a storey apart can't overlap — cheap pre-filter.
        if (Math.abs(a.floor - b.floor) > 1) continue;
        const overlap = intersectAABB(a.box, b.box, tolerance);
        if (!overlap) continue;
        clashes.push({
          id: `${a.id}__${b.id}`,
          a,
          b,
          overlap,
          volume: aabbVolume(overlap),
          center: [
            (overlap.min[0] + overlap.max[0]) / 2,
            (overlap.min[1] + overlap.max[1]) / 2,
            (overlap.min[2] + overlap.max[2]) / 2,
          ],
        });
      }
    }
  }

  // Most severe first — volume is the closest cheap proxy for "worst".
  return clashes.sort((x, y) => y.volume - x.volume);
}
