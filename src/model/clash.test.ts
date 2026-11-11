import { test } from "vitest";
import assert from "node:assert/strict";
import { intersectAABB, aabbVolume, aabbGap, detectClashes, DEFAULT_TOLERANCE } from "./clash.ts";
import type { AABB, BimElement } from "./types.ts";

const el = (
  id: string,
  discipline: BimElement["discipline"],
  min: [number, number, number],
  max: [number, number, number],
  floor = 0,
): BimElement => ({
  id,
  name: id,
  discipline,
  type: discipline === "mep" ? "pipe" : "beam",
  floor,
  box: { min, max },
});

test("intersectAABB: overlapping boxes yield the shared region", () => {
  const a: AABB = { min: [0, 0, 0], max: [2, 2, 2] };
  const b: AABB = { min: [1, 1, 1], max: [3, 3, 3] };
  const overlap = intersectAABB(a, b);
  assert.deepEqual(overlap, { min: [1, 1, 1], max: [2, 2, 2] });
  assert.equal(aabbVolume(overlap!), 1);
});

test("intersectAABB: separated and merely-touching boxes do not clash", () => {
  const a: AABB = { min: [0, 0, 0], max: [1, 1, 1] };
  assert.equal(intersectAABB(a, { min: [2, 0, 0], max: [3, 1, 1] }), null);
  // Faces exactly touching — inside tolerance, not a hard clash.
  assert.equal(intersectAABB(a, { min: [1, 0, 0], max: [2, 1, 1] }), null);
  // Sliver thinner than the tolerance is ignored too.
  assert.equal(
    intersectAABB(a, { min: [1 - DEFAULT_TOLERANCE / 2, 0, 0], max: [2, 1, 1] }),
    null,
  );
});

test("intersectAABB: containment is a full clash", () => {
  const outer: AABB = { min: [0, 0, 0], max: [10, 10, 10] };
  const inner: AABB = { min: [4, 4, 4], max: [5, 5, 5] };
  const overlap = intersectAABB(outer, inner);
  assert.deepEqual(overlap, inner);
});

test("detectClashes: only configured discipline pairs are tested", () => {
  const elements = [
    el("beam", "structural", [0, 0, 0], [4, 1, 1]),
    el("pipe", "mep", [1, 0, 0], [2, 1, 1]),
    el("wall", "architecture", [0, 0, 0], [4, 1, 1]), // overlaps beam too
  ];
  const clashes = detectClashes(elements, { pairs: [["structural", "mep"]] });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0]!.a.id, "beam");
  assert.equal(clashes[0]!.b.id, "pipe");
});

test("detectClashes: results are sorted by overlap volume, largest first", () => {
  const elements = [
    el("beam", "structural", [0, 0, 0], [10, 1, 1]),
    el("small", "mep", [0, 0, 0], [0.5, 0.5, 0.5]),
    el("big", "mep", [2, 0, 0], [8, 1, 1]),
  ];
  const clashes = detectClashes(elements);
  assert.deepEqual(clashes.map((c) => c.b.id), ["big", "small"]);
});

test("detectClashes: far-apart floors are pre-filtered out", () => {
  // Same world-space overlap, but floors 0 and 3 — impossible in practice,
  // and the engine must not even test the pair.
  const elements = [
    el("beam", "structural", [0, 0, 0], [4, 1, 1], 0),
    el("pipe", "mep", [1, 0, 0], [2, 1, 1], 3),
  ];
  assert.equal(detectClashes(elements).length, 0);
});

test("aabbGap is 0 for touching or overlapping boxes and euclidean otherwise", () => {
  const unit: AABB = { min: [0, 0, 0], max: [1, 1, 1] };
  assert.equal(aabbGap(unit, { min: [0.5, 0.5, 0.5], max: [2, 2, 2] }), 0);
  assert.equal(aabbGap(unit, { min: [1, 0, 0], max: [2, 1, 1] }), 0);
  assert.equal(aabbGap(unit, { min: [1.3, 0, 0], max: [2, 1, 1] }).toFixed(3), "0.300");
  assert.equal(aabbGap(unit, { min: [1.3, 1.4, 0], max: [2, 2, 1] }).toFixed(3), "0.500");
});

test("clearance clashes: reported only under the required gap, after hard clashes, tightest first", () => {
  const el = (id: string, discipline: BimElement["discipline"], min: [number, number, number], max: [number, number, number]): BimElement => ({
    id,
    name: id,
    discipline,
    type: discipline === "mep" ? "pipe" : "beam",
    floor: 0,
    box: { min, max },
  });
  const elements = [
    el("beam", "structural", [0, 0, 0], [10, 1, 1]),
    el("pipe-hard", "mep", [2, 0.5, 0], [3, 1.5, 1]), // overlaps
    el("pipe-20mm", "mep", [4, 1.02, 0], [5, 2, 1]), // 20 mm above
    el("pipe-40mm", "mep", [6, 1.04, 0], [7, 2, 1]), // 40 mm above
    el("pipe-80mm", "mep", [8, 1.08, 0], [9, 2, 1]), // 80 mm above
  ];

  assert.deepEqual(detectClashes(elements).map((c) => c.b.id), ["pipe-hard"]);

  const at50 = detectClashes(elements, { clearance: 0.05 });
  assert.deepEqual(at50.map((c) => [c.kind, c.b.id]), [
    ["hard", "pipe-hard"],
    ["clearance", "pipe-20mm"],
    ["clearance", "pipe-40mm"],
  ]);
  const tight = at50[1]!;
  assert.equal(tight.volume, 0);
  assert.equal(tight.gap.toFixed(3), "0.020");
  assert.ok(tight.center[1] > 1 && tight.center[1] < 1.02);
});

test("a gap exactly at the required clearance passes despite float rounding", () => {
  // 0.1 + 0.2 style rounding: the boxes are exactly 100 mm apart on paper.
  const beam: BimElement = { id: "b", name: "b", discipline: "structural", type: "beam", floor: 0, box: { min: [0, 0, 0], max: [1, 0.7, 1] } };
  const duct: BimElement = { id: "d", name: "d", discipline: "mep", type: "duct", floor: 0, box: { min: [0, 0.1 + 0.7 - 0.000000000000001, 0], max: [1, 1.2, 1] } };
  assert.equal(detectClashes([beam, duct], { clearance: 0.1 }).length, 0);
  assert.equal(detectClashes([beam, duct], { clearance: 0.15 }).length, 1);
});
