import type { AABB, BimElement } from "./types";

/**
 * Procedural building generator — a four-storey concrete frame with an
 * architecture envelope and MEP routing, produced deterministically from the
 * constants below (same input → same model, which the unit tests rely on).
 *
 * The MEP layer is routed *almost* correctly on purpose: a handful of runs are
 * placed at beam elevation or through a column, so the clash engine has real
 * geometry conflicts to find — the classic structural-vs-services coordination
 * problem BIM reviews exist for.
 */

export const FLOORS = 4;
export const BAYS_X = 4; // bays along x
export const BAYS_Z = 3; // bays along z
export const BAY = 6; // bay size, m
export const STOREY = 3.4; // storey height, m

const COL = 0.4; // column square side
const BEAM_W = 0.3;
const BEAM_D = 0.5; // beam depth below slab
const SLAB_T = 0.25;
const WALL_T = 0.2;
const PIPE_R = 0.12; // pipe half-size (square section for AABB purposes)
const DUCT_H = 0.35; // duct half-height
const DUCT_W = 0.6; // duct half-width

export const SIZE_X = BAYS_X * BAY;
export const SIZE_Z = BAYS_Z * BAY;

const box = (
  cx: number,
  cy: number,
  cz: number,
  hx: number,
  hy: number,
  hz: number,
): AABB => ({
  min: [cx - hx, cy - hy, cz - hz],
  max: [cx + hx, cy + hy, cz + hz],
});

/** Ids of elements deliberately routed into structure — used by tests/UI copy. */
export const PLANTED_CLASH_ELEMENTS = [
  "mep-duct-f1-clashing",
  "mep-pipe-f2-through-column",
  "mep-pipe-f3-in-beam",
];

export function generateBuilding(): BimElement[] {
  const out: BimElement[] = [];

  for (let f = 0; f < FLOORS; f++) {
    const base = f * STOREY; // top of slab under this storey
    const slabTop = base; // slab of this storey sits below columns
    const ceiling = base + STOREY; // top of storey = underside of next slab

    // --- structural: slab over this storey -----------------------------------
    out.push({
      id: `str-slab-f${f}`,
      name: `Slab · level ${f + 1}`,
      discipline: "structural",
      type: "slab",
      floor: f,
      box: box(SIZE_X / 2, ceiling + SLAB_T / 2, SIZE_Z / 2, SIZE_X / 2, SLAB_T / 2, SIZE_Z / 2),
    });

    // --- structural: columns at every grid intersection -----------------------
    for (let i = 0; i <= BAYS_X; i++) {
      for (let j = 0; j <= BAYS_Z; j++) {
        out.push({
          id: `str-col-f${f}-${i}-${j}`,
          name: `Column ${String.fromCharCode(65 + i)}${j + 1} · L${f + 1}`,
          discipline: "structural",
          type: "column",
          floor: f,
          box: box(i * BAY, slabTop + STOREY / 2, j * BAY, COL / 2, STOREY / 2, COL / 2),
        });
      }
    }

    // --- structural: beams under the slab, both directions --------------------
    const beamY = ceiling - BEAM_D / 2;
    for (let j = 0; j <= BAYS_Z; j++) {
      out.push({
        id: `str-beam-x-f${f}-${j}`,
        name: `Beam X${j + 1} · L${f + 1}`,
        discipline: "structural",
        type: "beam",
        floor: f,
        box: box(SIZE_X / 2, beamY, j * BAY, SIZE_X / 2, BEAM_D / 2, BEAM_W / 2),
      });
    }
    for (let i = 0; i <= BAYS_X; i++) {
      out.push({
        id: `str-beam-z-f${f}-${i}`,
        name: `Beam ${String.fromCharCode(65 + i)} · L${f + 1}`,
        discipline: "structural",
        type: "beam",
        floor: f,
        box: box(i * BAY, beamY, SIZE_Z / 2, BEAM_W / 2, BEAM_D / 2, SIZE_Z / 2),
      });
    }

    // --- architecture: perimeter walls ----------------------------------------
    const wallY = slabTop + STOREY / 2;
    const wallH = STOREY / 2;
    out.push(
      {
        id: `arch-wall-n-f${f}`,
        name: `Wall north · L${f + 1}`,
        discipline: "architecture",
        type: "wall",
        floor: f,
        box: box(SIZE_X / 2, wallY, -WALL_T / 2, SIZE_X / 2, wallH, WALL_T / 2),
      },
      {
        id: `arch-wall-s-f${f}`,
        name: `Wall south · L${f + 1}`,
        discipline: "architecture",
        type: "wall",
        floor: f,
        box: box(SIZE_X / 2, wallY, SIZE_Z + WALL_T / 2, SIZE_X / 2, wallH, WALL_T / 2),
      },
      {
        id: `arch-wall-w-f${f}`,
        name: `Wall west · L${f + 1}`,
        discipline: "architecture",
        type: "wall",
        floor: f,
        box: box(-WALL_T / 2, wallY, SIZE_Z / 2, WALL_T / 2, wallH, SIZE_Z / 2),
      },
      {
        id: `arch-wall-e-f${f}`,
        name: `Wall east · L${f + 1}`,
        discipline: "architecture",
        type: "wall",
        floor: f,
        box: box(SIZE_X + WALL_T / 2, wallY, SIZE_Z / 2, WALL_T / 2, wallH, SIZE_Z / 2),
      },
    );

    // --- MEP: clean runs routed below the beams -------------------------------
    const serviceY = ceiling - BEAM_D - DUCT_H - 0.1; // safely under beam soffit
    out.push({
      id: `mep-duct-f${f}-main`,
      name: `Supply duct main · L${f + 1}`,
      discipline: "mep",
      type: "duct",
      floor: f,
      box: box(SIZE_X / 2, serviceY, BAY * 1.5, SIZE_X / 2 - 0.5, DUCT_H, DUCT_W),
    });
    out.push({
      id: `mep-pipe-f${f}-riser-a`,
      name: `Pipe run A · L${f + 1}`,
      discipline: "mep",
      type: "pipe",
      floor: f,
      box: box(BAY * 0.5, serviceY - 0.7, SIZE_Z / 2, PIPE_R, PIPE_R, SIZE_Z / 2 - 0.5),
    });
    out.push({
      id: `mep-pipe-f${f}-riser-b`,
      name: `Pipe run B · L${f + 1}`,
      discipline: "mep",
      type: "pipe",
      floor: f,
      box: box(BAY * 3.5, serviceY - 0.7, SIZE_Z / 2, PIPE_R, PIPE_R, SIZE_Z / 2 - 0.5),
    });
  }

  /* --- planted coordination errors ------------------------------------------ */

  // 1. A branch duct on level 2 drawn at beam elevation — it crosses every
  //    z-direction beam on its way (the classic "duct through the downstand").
  {
    const f = 1;
    const beamY = (f + 1) * STOREY - BEAM_D / 2;
    out.push({
      id: PLANTED_CLASH_ELEMENTS[0]!,
      name: `Return duct branch · L${f + 1}`,
      discipline: "mep",
      type: "duct",
      floor: f,
      box: box(SIZE_X / 2, beamY, BAY * 2.5, SIZE_X / 2 - 0.5, DUCT_H, DUCT_W),
    });
  }

  // 2. A pipe on level 3 routed along gridline 2 — straight through the
  //    three columns standing on it.
  {
    const f = 2;
    const y = f * STOREY + 1.6;
    out.push({
      id: PLANTED_CLASH_ELEMENTS[1]!,
      name: `Chilled water pipe · L${f + 1}`,
      discipline: "mep",
      type: "pipe",
      floor: f,
      box: box(BAY * 2, y, BAY, BAY * 1.2, PIPE_R, PIPE_R),
    });
  }

  // 3. A pipe on level 4 clipping the corner of a beam soffit.
  {
    const f = 3;
    const beamY = (f + 1) * STOREY - BEAM_D / 2;
    out.push({
      id: PLANTED_CLASH_ELEMENTS[2]!,
      name: `Condensate pipe · L${f + 1}`,
      discipline: "mep",
      type: "pipe",
      floor: f,
      box: box(SIZE_X / 2, beamY - BEAM_D / 2, BAY * 1, SIZE_X / 2 - 1, PIPE_R, PIPE_R),
    });
  }

  return out;
}
