/** Shared BIM domain types — pure data, no three.js here. */

export type Discipline = "structural" | "architecture" | "mep";

export type ElementType = "column" | "beam" | "slab" | "wall" | "pipe" | "duct";

/** Axis-aligned bounding box in meters, world coordinates (y = up). */
export type AABB = {
  min: [number, number, number];
  max: [number, number, number];
};

export type BimElement = {
  id: string;
  name: string;
  discipline: Discipline;
  type: ElementType;
  /** 0-based storey the element belongs to. */
  floor: number;
  box: AABB;
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  structural: "Structural",
  architecture: "Architecture",
  mep: "MEP",
};
