import { test } from "node:test";
import assert from "node:assert/strict";
import { intersectAABB, aabbVolume, detectClashes, DEFAULT_TOLERANCE } from "./clash.ts";
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
