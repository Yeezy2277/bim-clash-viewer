import type { AABB, BimElement, Discipline } from "./types";

/**
 * Clash detection — pure geometry, no three.js. Finds hard clashes (actual
 * volume overlap) between elements of different disciplines, the way a BIM
 * coordination review does. AABB precision is fine here because the model's
 * elements are axis-aligned by construction; the engine is the piece the unit
 * tests pin down.
 */

/**
 * `hard`: the elements physically overlap. `clearance`: they don't touch, but
 * sit closer than the required clearance (a duct needs room for insulation and
 * maintenance access), which real coordination reviews report as a soft clash.
 */
export type ClashKind = "hard" | "clearance";

export type Clash = {
  id: string;
  kind: ClashKind;
  a: BimElement;
  b: BimElement;
  /** The overlapping region (hard), or the gap region between the two (clearance). */
  overlap: AABB;
  /** Overlap volume in m³ (hard only; 0 for clearance). */
  volume: number;
  /** Shortest distance between the boxes in m (0 for hard). */
  gap: number;
  /** Center of the overlap or gap, for camera fly-to. */
  center: [number, number, number];
};

/** Shortest distance between two boxes; 0 when they touch or overlap. */
export function aabbGap(a: AABB, b: AABB): number {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const d = Math.max(0, a.min[i]! - b.max[i]!, b.min[i]! - a.max[i]!);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** The region between two boxes (per axis: their overlap, or the gap span). */
function between(a: AABB, b: AABB): AABB {
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(a.min[i]!, b.min[i]!);
    const hi = Math.min(a.max[i]!, b.max[i]!);
    min[i] = Math.min(lo, hi);
    max[i] = Math.max(lo, hi);
  }
  return { min, max };
}

/** Float slack when comparing a gap to the required clearance (1 µm). */
const GAP_EPSILON = 1e-6;

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
  /** Required clearance in m. 0 (default) reports hard clashes only. */
  clearance?: number;
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
  const clearance = Math.max(0, options.clearance ?? 0);

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
        if (overlap) {
          clashes.push({ id: `${a.id}__${b.id}`, kind: "hard", a, b, overlap, volume: aabbVolume(overlap), gap: 0, center: centerOf(overlap) });
          continue;
        }
        if (clearance === 0) continue;
        const gap = aabbGap(a.box, b.box);
        // A gap exactly at the requirement passes. Coordinates are sums of floats,
        // so "exactly 100 mm" can come out as 99.999…; compare with a micrometre of slack.
        if (gap >= clearance - GAP_EPSILON) continue;
        const region = between(a.box, b.box);
        clashes.push({ id: `${a.id}__${b.id}`, kind: "clearance", a, b, overlap: region, volume: 0, gap, center: centerOf(region) });
      }
    }
  }

  // Hard clashes first, worst (largest volume) on top; then the tightest clearances.
  return clashes.sort((x, y) => {
    if (x.kind !== y.kind) return x.kind === "hard" ? -1 : 1;
    return x.kind === "hard" ? y.volume - x.volume : x.gap - y.gap;
  });
}

const centerOf = (box: AABB): [number, number, number] => [
  (box.min[0] + box.max[0]) / 2,
  (box.min[1] + box.max[1]) / 2,
  (box.min[2] + box.max[2]) / 2,
];
