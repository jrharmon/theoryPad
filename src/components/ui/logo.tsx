/**
 * The notepad mark: a page with a blue binding and a line of tab. Drawn in the
 * tokens, so it follows the theme; `public/favicon.svg` is the same drawing with
 * the values copied in, because a favicon can't read them.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect
        x="4"
        y="3"
        width="24"
        height="27"
        rx="4"
        strokeWidth="1.6"
        className="fill-paper stroke-ink"
      />
      <path d="M4 7a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v3H4z" className="fill-accent" />
      <g className="fill-paper">
        <circle cx="10" cy="6.5" r="1.3" />
        <circle cx="16" cy="6.5" r="1.3" />
        <circle cx="22" cy="6.5" r="1.3" />
      </g>
      <path d="M8 15h16M8 20h16M8 25h16" strokeWidth="1.2" className="stroke-ink opacity-50" />
      <circle cx="13" cy="20" r="2.6" className="fill-accent" />
      <circle cx="19" cy="15" r="2.6" className="fill-ink" />
    </svg>
  );
}
