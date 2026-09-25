/** Minimal line icons (inline SVG, currentColor). Functional only — no decorative / "AI" iconography. */
type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const HomeIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const HistoryIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 18h16" />
    <circle cx="7" cy="12" r="1.8" />
    <circle cx="12" cy="9" r="1.8" />
    <circle cx="17" cy="6" r="1.8" />
    <path d="M7 14v4M12 11v7M17 8v10" />
  </svg>
);

export const SummaryIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" />
    <path d="M14 3.5V8h4M9.5 12h6M9.5 15h6M9.5 18h3.5" />
  </svg>
);

export const DocIcon = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={1.8}>
    <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" />
    <path d="M14 3.5V8h4" />
  </svg>
);

export const ChevronIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const PlusIcon = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
