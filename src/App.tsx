import { useEffect, useMemo, useRef, useState } from "react";
import { generateBuilding, FLOORS, STOREY } from "./model/building";
import { detectClashes, type Clash } from "./model/clash";
import { DISCIPLINE_LABEL, type Discipline } from "./model/types";
import { BimScene } from "./viewer/scene";
import { Viewer } from "./components/Viewer";
import { TreePanel } from "./components/TreePanel";
import { ClashPanel } from "./components/ClashPanel";

type Theme = "dark" | "light";

function initialTheme(): Theme {
  try {
    return localStorage.getItem("girder-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export type ClashStatus = "open" | "reviewed";

export default function App() {
  const elements = useMemo(() => generateBuilding(), []);
  const clashes = useMemo(() => detectClashes(elements), [elements]);

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

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr__brand">
          <span className="hdr__logo">⌗</span>
          <div>
            <div className="hdr__title">Girder</div>
            <div className="hdr__sub">BIM clash viewer</div>
          </div>
        </div>
        <div className="hdr__right">
          <span className={openCount > 0 ? "hdr__pill hdr__pill--warn" : "hdr__pill hdr__pill--ok"}>
            <i />
            {openCount > 0 ? `${openCount} open clash${openCount === 1 ? "" : "es"}` : "Model coordinated"}
          </span>
          <button className="btn" onClick={resetView}>⌂ Reset view</button>
          <button
            className="btn btn--icon"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel panel--tree">
          <TreePanel elements={elements} visible={visible} onToggle={toggleDiscipline} />
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

        <main className="stage">
          <Viewer sceneRef={sceneRef} elements={elements} theme={theme} />
          <div className="stage__hint">drag to orbit · scroll to zoom · right-drag to pan</div>
        </main>

        <aside className="panel panel--clashes">
          <ClashPanel
            clashes={clashes}
            statuses={statuses}
            selected={selectedClash}
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
          {clashes.length} hard clashes found
        </span>
        <span className="ftr__dim">
          procedural model · pure clash engine (unit-tested) · three.js · no backend
        </span>
      </footer>
    </div>
  );
}
