import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBuilding, PLANTED_CLASH_ELEMENTS, FLOORS } from "./building.ts";
import { detectClashes } from "./clash.ts";

test("generateBuilding: deterministic — two runs produce identical models", () => {
  assert.deepEqual(generateBuilding(), generateBuilding());
});

test("generateBuilding: every box is well-formed (min < max on all axes)", () => {
  for (const el of generateBuilding()) {
    for (let i = 0; i < 3; i++) {
      assert.ok(
        el.box.min[i]! < el.box.max[i]!,
        `${el.id} axis ${i}: ${el.box.min[i]} < ${el.box.max[i]}`,
      );
    }
  }
});

test("generateBuilding: all disciplines and floors are populated", () => {
  const elements = generateBuilding();
  const disciplines = new Set(elements.map((e) => e.discipline));
  assert.deepEqual([...disciplines].sort(), ["architecture", "mep", "structural"]);
  for (let f = 0; f < FLOORS; f++) {
    assert.ok(elements.some((e) => e.floor === f), `floor ${f} has elements`);
  }
});

test("clash run: every planted coordination error is found", () => {
  const clashes = detectClashes(generateBuilding());
  const clashingIds = new Set(clashes.flatMap((c) => [c.a.id, c.b.id]));
  for (const planted of PLANTED_CLASH_ELEMENTS) {
    assert.ok(clashingIds.has(planted), `planted clash element ${planted} is detected`);
  }
});

test("clash run: cleanly routed services never clash with structure", () => {
  const clashes = detectClashes(generateBuilding());
  const clashingIds = new Set(clashes.flatMap((c) => [c.a.id, c.b.id]));
  for (let f = 0; f < FLOORS; f++) {
    for (const id of [`mep-duct-f${f}-main`, `mep-pipe-f${f}-riser-a`, `mep-pipe-f${f}-riser-b`]) {
      assert.ok(!clashingIds.has(id), `${id} must be clash-free`);
    }
  }
});

test("clash run: every clash involves exactly one MEP element", () => {
  for (const clash of detectClashes(generateBuilding())) {
    const meps = [clash.a, clash.b].filter((e) => e.discipline === "mep").length;
    assert.equal(meps, 1, `${clash.id} pairs MEP against another discipline`);
  }
});
