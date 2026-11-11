import { describe, expect, it } from "vitest";
import { detectClashes } from "./clash";
import { generateBuilding } from "./building";
import { clashReportCsv, severity } from "./report";

describe("clash report CSV", () => {
  const clashes = detectClashes(generateBuilding(), { clearance: 0.15 });

  it("has a header and one row per clash, with statuses applied", () => {
    const first = clashes[0]!;
    const csv = clashReportCsv(clashes, { [first.id]: "reviewed" });
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("id,kind,severity,status,element_a,element_b,floor,volume_l,gap_mm,x_m,y_m,z_m");
    expect(lines).toHaveLength(clashes.length + 1);
    expect(lines[1]).toContain(",reviewed,");
    expect(lines[2]).toContain(",open,");
  });

  it("quotes commas and neutralises formula injection in names", () => {
    const c = { ...clashes[0]!, a: { ...clashes[0]!.a, name: "=HYPERLINK(evil)" }, b: { ...clashes[0]!.b, name: "Duct, level 2" } };
    const row = clashReportCsv([c], {}).split("\n")[1]!;
    expect(row).toContain(",'=HYPERLINK(evil),");
    expect(row).toContain(',"Duct, level 2",');
  });

  it("grades severity with one rule shared by the list and the export", () => {
    for (const c of clashes) {
      const s = severity(c);
      expect(c.kind === "clearance" ? s === "clearance" : s === "severe" || s === "minor").toBe(true);
    }
  });
});
