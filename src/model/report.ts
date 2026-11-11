import type { Clash } from "./clash";

export type ClashStatus = "open" | "reviewed";

/** Severity used by the report: one rule, shared by the list and the export. */
export function severity(c: Clash): "severe" | "minor" | "clearance" {
  if (c.kind === "clearance") return "clearance";
  return c.volume > 0.05 ? "severe" : "minor";
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Quote anything that could break a row, and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * The coordination report as CSV, the format a site team pastes into their
 * issue tracker. Volumes in litres, gaps in millimetres, positions in metres.
 */
export function clashReportCsv(clashes: Clash[], statuses: Record<string, ClashStatus>): string {
  const header = ["id", "kind", "severity", "status", "element_a", "element_b", "floor", "volume_l", "gap_mm", "x_m", "y_m", "z_m"];
  const rows = clashes.map((c) => [
    c.id,
    c.kind,
    severity(c),
    statuses[c.id] ?? "open",
    c.a.name,
    c.b.name,
    Math.min(c.a.floor, c.b.floor),
    Math.round(c.volume * 1000),
    Math.round(c.gap * 1000),
    c.center[0].toFixed(2),
    c.center[1].toFixed(2),
    c.center[2].toFixed(2),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
