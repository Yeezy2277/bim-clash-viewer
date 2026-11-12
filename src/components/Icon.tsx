/**
 * Small line icons drawn inline (no icon font, no emoji glyphs, no dependency).
 * Decorative by default: the control that holds an icon carries the label.
 */
const PATHS = {
  arrowUpRight: "M7 17 17 7M8.5 7H17v8.5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  close: "M6 6l12 12M18 6 6 18",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20 14.6A8 8 0 0 1 9.4 4 8 8 0 1 0 20 14.6Z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z",
  download: "M12 4v11M7 10.5l5 5 5-5M5 20h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  pause: "M8.5 5v14M15.5 5v14",
  play: "M8 5.5v13l10.5-6.5Z",
  reset: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5",
  quote: "M6.5 7h4v4c0 3-1.4 4.8-4 5.8M13.5 7h4v4c0 3-1.4 4.8-4 5.8",
  ibeam: "M5 5h14M5 19h14M12 5v14",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
