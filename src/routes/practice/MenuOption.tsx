/** One row of a transport menu: a choice and a line saying what it does. */
export function MenuOption({
  selected,
  title,
  detail,
  onPick,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onPick: () => void;
  /** Not available here; `detail` says why. */
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onPick}
        disabled={disabled}
        data-toggle={selected ? 'on' : 'off'}
        className="w-full rounded-control px-2 py-1.5 text-left hover:bg-ink/5 disabled:cursor-not-allowed disabled:hover:bg-transparent [&:disabled>span:first-child]:text-ink-muted"
      >
        <span className="block text-body-sm font-semibold">{title}</span>
        {/* Not `cn`: it takes text-meta and text-ink-muted for one group and drops the size. */}
        <span className={`block text-meta ${selected ? 'opacity-80' : 'text-ink-muted'}`}>
          {detail}
        </span>
      </button>
    </li>
  );
}
