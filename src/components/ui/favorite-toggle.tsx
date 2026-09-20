/**
 * A star that pins something to the top of its list. Accent when on — it is
 * small emphasis, which is what the accent is for.
 */
export function FavoriteToggle({
  on,
  label,
  onChange,
}: {
  on: boolean;
  /** What is being favorited, for screen readers: "Favorite Morning". */
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Favorite ${label}`}
      title={on ? 'Unpin from the top' : 'Pin to the top'}
      onClick={() => onChange(!on)}
      className={`w-6 shrink-0 text-lead leading-none ${on ? 'text-star' : 'text-ink-disabled hover:text-ink-faint'}`}
    >
      {on ? '★' : '☆'}
    </button>
  );
}
