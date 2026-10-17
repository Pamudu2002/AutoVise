/** The AutoVise mark: a compass ring with an upward trend. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="28" height="28" rx="8" style={{ fill: "var(--primary)" }} />
      <circle cx="14" cy="14" r="8.5" fill="none" style={{ stroke: "var(--on-primary)" }} strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M8.5 17.5 12.5 13.5 15 16 19.5 10.5" fill="none" style={{ stroke: "var(--on-primary)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10.5h3.5V14" fill="none" style={{ stroke: "var(--on-primary)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.025em" }}>AutoVise</span>;
}
