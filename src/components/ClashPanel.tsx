import type { Clash } from "../model/clash";
import type { ClashStatus } from "../App";

/** Coordination report: hard clashes, severity-sorted, click to inspect. */
export function ClashPanel({
  clashes,
  statuses,
  selected,
  onOpen,
  onToggleStatus,
}: {
  clashes: Clash[];
  statuses: Record<string, ClashStatus>;
  selected: string | null;
  onOpen: (clash: Clash) => void;
  onToggleStatus: (id: string) => void;
}) {
  return (
    <div className="clashes">
      <div className="panel__title">
        Clash report
        <span className="panel__badge">{clashes.length}</span>
      </div>

      {clashes.map((clash) => {
        const status = statuses[clash.id] ?? "open";
        const severe = clash.volume > 0.05;
        return (
          <div
            key={clash.id}
            className={
              selected === clash.id ? "clash clash--selected" : "clash"
            }
          >
            <button className="clash__body" onClick={() => onOpen(clash)}>
              <span
                className={severe ? "clash__dot clash__dot--severe" : "clash__dot"}
                title={severe ? "Severe" : "Minor"}
              />
              <span className="clash__names">
                <b>{clash.b.name}</b>
                <em>vs {clash.a.name}</em>
              </span>
              <span className="clash__vol">{(clash.volume * 1000).toFixed(0)} ℓ</span>
            </button>
            <button
              className={
                status === "reviewed" ? "clash__status clash__status--done" : "clash__status"
              }
              onClick={() => onToggleStatus(clash.id)}
              title={status === "reviewed" ? "Mark as open" : "Mark as reviewed"}
            >
              {status === "reviewed" ? "✓ reviewed" : "open"}
            </button>
          </div>
        );
      })}

      <p className="clashes__note">
        Hard clashes between disciplines (structure / architecture vs MEP),
        volume-sorted. Click one — the camera flies to it and the pair lights up.
      </p>
    </div>
  );
}
