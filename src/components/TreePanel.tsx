import { useMemo } from "react";
import { DISCIPLINE_LABEL, type BimElement, type Discipline } from "../model/types";

const DISCIPLINES: Discipline[] = ["structural", "architecture", "mep"];

const SWATCH: Record<Discipline, string> = {
  structural: "#9aa5b1",
  architecture: "#d7dde6",
  mep: "#2f9e77",
};

/** Model browser: disciplines with visibility toggles and per-type counts. */
export function TreePanel({
  elements,
  visible,
  onToggle,
}: {
  elements: BimElement[];
  visible: Record<Discipline, boolean>;
  onToggle: (d: Discipline) => void;
}) {
  const groups = useMemo(() => {
    const byDiscipline = new Map<Discipline, Map<string, number>>();
    for (const el of elements) {
      const types = byDiscipline.get(el.discipline) ?? new Map<string, number>();
      types.set(el.type, (types.get(el.type) ?? 0) + 1);
      byDiscipline.set(el.discipline, types);
    }
    return byDiscipline;
  }, [elements]);

  return (
    <div className="tree">
      <div className="panel__title">Model</div>
      {DISCIPLINES.map((d) => {
        const types = groups.get(d) ?? new Map();
        const total = [...types.values()].reduce((n, c) => n + c, 0);
        return (
          <div key={d} className="tree__group">
            <label className="tree__head">
              <input type="checkbox" checked={visible[d]} onChange={() => onToggle(d)} />
              <i className="tree__swatch" style={{ background: SWATCH[d] }} />
              <span className="tree__name">{DISCIPLINE_LABEL[d]}</span>
              <span className="tree__count">{total}</span>
            </label>
            <ul className="tree__types">
              {[...types.entries()].map(([type, count]) => (
                <li key={type}>
                  <span>{type}s</span>
                  <span className="tree__count">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
