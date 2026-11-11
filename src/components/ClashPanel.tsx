import type { Clash, ClashKind } from "../model/clash";
import { severity, type ClashStatus } from "../model/report";

export type KindFilter = "all" | ClashKind;

const SEVERITY_LABEL = { severe: "Severe", minor: "Minor", clearance: "Clearance" } as const;

/** Coordination report: filterable, keyboard-steppable, exportable. */
export function ClashPanel({
  clashes,
  total,
  statuses,
  selected,
  kind,
  openOnly,
  onKind,
  onOpenOnly,
  onOpen,
  onToggleStatus,
  onExport,
}: {
  /** Clashes after filtering, in report order. */
  clashes: Clash[];
  total: number;
  statuses: Record<string, ClashStatus>;
  selected: string | null;
  kind: KindFilter;
  openOnly: boolean;
  onKind: (k: KindFilter) => void;
  onOpenOnly: (on: boolean) => void;
  onOpen: (clash: Clash) => void;
  onToggleStatus: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="clashes">
      <h2 className="panel__title" id="clash-h">
        Clash report
        <span className="panel__badge" aria-label={`${clashes.length} of ${total} shown`}>
          {clashes.length}/{total}
        </span>
      </h2>

      <div className="filters" role="group" aria-label="Filter clashes">
        {(["all", "hard", "clearance"] as const).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => onKind(k)}>
            {k}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={openOnly} onClick={() => onOpenOnly(!openOnly)}>
          open only
        </button>
      </div>

      {clashes.length === 0 ? (
        <p className="clashes__empty" role="status">
          {total === 0 ? "No clashes: the model is coordinated." : "No clashes match these filters."}
        </p>
      ) : (
        <ul className="clash-list" aria-labelledby="clash-h">
          {clashes.map((clash) => {
            const status = statuses[clash.id] ?? "open";
            const sev = severity(clash);
            return (
              <li key={clash.id} className={selected === clash.id ? "clash clash--selected" : "clash"}>
                <button
                  type="button"
                  className="clash__body"
                  onClick={() => onOpen(clash)}
                  aria-current={selected === clash.id ? "true" : undefined}
                >
                  <span className={`clash__dot clash__dot--${sev}`} aria-hidden="true" />
                  <span className="clash__names">
                    <b>{clash.b.name}</b>
                    <em>vs {clash.a.name}</em>
                  </span>
                  <span className="clash__vol">
                    <span className="sr-only">{SEVERITY_LABEL[sev]}, </span>
                    {clash.kind === "hard" ? `${(clash.volume * 1000).toFixed(0)} ℓ` : `${(clash.gap * 1000).toFixed(0)} mm gap`}
                  </span>
                </button>
                <button
                  type="button"
                  className="clash__status"
                  aria-pressed={status === "reviewed"}
                  aria-label={`Reviewed: ${clash.b.name} vs ${clash.a.name}`}
                  onClick={() => onToggleStatus(clash.id)}
                >
                  {status === "reviewed" ? "✓ reviewed" : "open"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="clashes__foot">
        <button type="button" className="btn" onClick={onExport} disabled={clashes.length === 0}>
          Export CSV
        </button>
        <span className="clashes__keys">
          <kbd>J</kbd> / <kbd>K</kbd> step through
        </span>
      </div>

      <p className="clashes__note">
        Hard clashes (overlap) and clearance clashes (closer than the required gap) between structure /
        architecture and MEP. Click one: the camera flies to it and the pair lights up.
      </p>
    </div>
  );
}
