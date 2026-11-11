// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// jsdom has no WebGL: the 3D view fails exactly as it would on a machine without it.
const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(cleanup);

const report = () => within(screen.getByRole("complementary", { name: "Clash report" }));
const items = () => report().getAllByRole("listitem");

describe("Girder without WebGL", () => {
  it("keeps the clash report usable and explains the missing 3D view", () => {
    render(<App />);
    expect(screen.getByRole("alert").textContent).toMatch(/3D view couldn't start/);
    expect(items().length).toBeGreaterThan(0);
    quiet.mockClear();
  });
});

describe("clash report", () => {
  it("filters by kind and exposes which filter is on", async () => {
    const user = userEvent.setup();
    render(<App />);
    const all = items().length;

    await user.click(report().getByRole("button", { name: "clearance" }));
    expect(report().getByRole("button", { name: "clearance" }).getAttribute("aria-pressed")).toBe("true");
    const clearance = items().length;
    expect(clearance).toBeGreaterThan(0);
    expect(clearance).toBeLessThan(all);
    expect(items().every((li) => /mm gap/.test(li.textContent ?? ""))).toBe(true);
  });

  it("drops clearance clashes when only hard clashes are required", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText("Required clearance"), "0");
    expect(items().some((li) => /mm gap/.test(li.textContent ?? ""))).toBe(false);
  });

  it("steps through clashes with J and K", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard("j");
    const current = () => report().getAllByRole("button").find((b) => b.getAttribute("aria-current") === "true");
    const first = current()?.textContent;
    expect(first).toBeTruthy();
    await user.keyboard("j");
    expect(current()?.textContent).not.toBe(first);
    await user.keyboard("k");
    expect(current()?.textContent).toBe(first);
  });

  it("marks a clash reviewed and hides it under 'open only'", async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = items().length;
    const toggle = report().getAllByRole("button", { name: /^Reviewed:/ })[0]!;
    await user.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    await user.click(report().getByRole("button", { name: "open only" }));
    expect(items()).toHaveLength(before - 1);
  });
});
