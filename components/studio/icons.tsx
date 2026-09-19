/**
 * The studio's icon set.
 *
 * Drawn here rather than exported from Figma, for a reason worth recording:
 * the design file's icons are only reachable through short-lived Figma asset
 * URLs, and a URL that expires in a week has no business in a repository. So
 * these are hand-drawn to the same silhouettes — one stroke weight, one grid,
 * currentColor throughout, so a parent's text colour drives them and hover
 * states need no icon-specific rule.
 *
 * If you later export the real set from Figma, replace the bodies and keep
 * the names: every call site passes only className.
 */

type IconProps = { className?: string };

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function PanelLeftIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9.5 4v16" />
    </svg>
  );
}

export function PanelRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M14.5 4v16" />
    </svg>
  );
}

export function NewChatIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M20 12.5V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18V7a2.5 2.5 0 0 1 2.5-2.5H12" />
      <path d="M17.6 3.6a1.9 1.9 0 0 1 2.7 2.7L14 12.6l-3.4.7.7-3.4Z" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M8.5 13.5h7M8.5 17h4.5" />
    </svg>
  );
}

export function ToolsIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4.5 12 20 4.5 12.5 20l-2-6.5Z" />
    </svg>
  );
}
