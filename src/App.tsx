import { useEffect, useMemo, useRef, useState } from "react";
import { generateBuilding, FLOORS, STOREY } from "./model/building";
import { detectClashes, type Clash } from "./model/clash";
import { clashReportCsv, type ClashStatus } from "./model/report";
import { DISCIPLINE_LABEL, type Discipline } from "./model/types";
import { BimScene } from "./viewer/scene";
import { Viewer } from "./components/Viewer";
import { TreePanel } from "./components/TreePanel";
import { ClashPanel, type KindFilter } from "./components/ClashPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";

type Theme = "dark" | "light";

function initialTheme(): Theme {
  try {
    return localStorage.getItem("girder-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Required MEP clearance options, in mm. 0 = hard clashes only. */
const CLEARANCES = [0, 100, 150, 200];

export default function App() {
  const elements = useMemo(() => generateBuilding(), []);
  const [clearanceMm, setClearanceMm] = useState(150);
  const clashes = useMemo(() => detectClashes(elements, { clearance: clearanceMm / 1000 }), [elements, clearanceMm]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [openOnly, setOpenOnly] = useState(false);

  const sceneRef = useRef<BimScene | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [visible, setVisible] = useState<Record<Discipline, boolean>>({
    structural: true,
    architecture: true,
    mep: true,
  });
  const [selectedClash, setSelectedClash] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ClashStatus>>({});
  const [sectionOn, setSectionOn] = useState(false);
  const [sectionY, setSectionY] = useState(FLOORS * STOREY * 0.55);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("girder-theme", theme);
    } catch {
      /* private mode */
    }
    sceneRef.current?.setTheme(theme === "light");
  }, [theme]);

  useEffect(() => {
    sceneRef.current?.setSection(sectionOn ? sectionY : null);
  }, [sectionOn, sectionY]);

  const toggleDiscipline = (d: Discipline) => {
    setVisible((v) => {
      const next = { ...v, [d]: !v[d] };
      sceneRef.current?.setDisciplineVisible(elements, d, next[d]);
      return next;
    });
  };

  const openClash = (clash: Clash) => {
    setSelectedClash(clash.id);
    sceneRef.current?.focusClash(clash);
  };

  const resetView = () => {
    setSelectedClash(null);
    sceneRef.current?.resetView();
  };

  const openCount = clashes.filter((c) => (statuses[c.id] ?? "open") === "open").length;
  // Derived, not stored: the list the panel shows and J/K steps through.
  const shown = clashes.filter(
    (c) => (kind === "all" || c.kind === kind) && (!openOnly || (statuses[c.id] ?? "open") === "open"),
  );

  // J / K step through the visible clashes, like a review queue.
  const step = useRef<(dir: 1 | -1) => void>(() => {});
  step.current = (dir) => {
    if (shown.length === 0) return;
    const i = shown.findIndex((c) => c.id === selectedClash);
    const next = shown[(i + dir + shown.length) % shown.length] ?? shown[0]!;
    openClash(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, select, textarea")) return;
      if (e.key === "j" || e.key === "J") step.current(1);
      if (e.key === "k" || e.key === "K") step.current(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([clashReportCsv(shown, statuses)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "girder-clash-report.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr__brand">
          <span className="hdr__logo" aria-hidden="true">⌗</span>
          <div>
            <h1 className="hdr__title">Girder</h1>
            <div className="hdr__sub">BIM clash viewer</div>
          </div>
        </div>
        <div className="hdr__right">
          <span role="status" className={openCount > 0 ? "hdr__pill hdr__pill--warn" : "hdr__pill hdr__pill--ok"}>
            <i aria-hidden="true" />
            {openCount > 0 ? `${openCount} open clash${openCount === 1 ? "" : "es"}` : "Model coordinated"}
          </span>
          <button className="btn" onClick={resetView}>
            <span aria-hidden="true">⌂</span> Reset view
          </button>
          <button
            className="btn btn--icon"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel panel--tree" aria-label="Model and tools">
          <TreePanel elements={elements} visible={visible} onToggle={toggleDiscipline} />
          <div className="section">
            <label className="section__head" htmlFor="clearance">
              Required clearance
            </label>
            <select
              id="clearance"
              className="select"
              value={clearanceMm}
              onChange={(e) => setClearanceMm(Number(e.target.value))}
            >
              {CLEARANCES.map((mm) => (
                <option key={mm} value={mm}>
                  {mm === 0 ? "Hard clashes only" : `${mm} mm around MEP`}
                </option>
              ))}
            </select>
          </div>
          <div className="section">
            <label className="section__head">
              <input
                type="checkbox"
                checked={sectionOn}
                onChange={(e) => setSectionOn(e.target.checked)}
              />
              Section plane
            </label>
            <input
              className="section__slider"
              type="range"
              min={0.5}
              max={FLOORS * STOREY + 0.5}
              step={0.1}
              value={sectionY}
              disabled={!sectionOn}
              onChange={(e) => setSectionY(Number(e.target.value))}
              aria-label="Section height"
            />
            <div className="section__value">
              {sectionOn ? `cut at ${sectionY.toFixed(1)} m` : "off"}
            </div>
          </div>
        </aside>

        <main className="stage" id="main">
          <ErrorBoundary area="3D view">
            <Viewer sceneRef={sceneRef} elements={elements} theme={theme} />
          </ErrorBoundary>
          <div className="stage__hint">drag to orbit · scroll to zoom · right-drag to pan</div>
        </main>

        <aside className="panel panel--clashes" aria-label="Clash report">
          <ClashPanel
            clashes={shown}
            total={clashes.length}
            statuses={statuses}
            selected={selectedClash}
            kind={kind}
            openOnly={openOnly}
            onKind={setKind}
            onOpenOnly={setOpenOnly}
            onExport={exportCsv}
            onOpen={openClash}
            onToggleStatus={(id) =>
              setStatuses((s) => ({
                ...s,
                [id]: (s[id] ?? "open") === "open" ? "reviewed" : "open",
              }))
            }
          />
        </aside>
      </div>

      <footer className="ftr">
        <span>
          {elements.length} elements · {Object.values(DISCIPLINE_LABEL).join(" / ")} ·{" "}
          {clashes.filter((c) => c.kind === "hard").length} hard ·{" "}
          {clashes.filter((c) => c.kind === "clearance").length} clearance clashes
        </span>
        <span className="ftr__dim">
          procedural model · pure clash engine (unit-tested) · three.js · no backend
        </span>
      </footer>
    </div>
  );
}
