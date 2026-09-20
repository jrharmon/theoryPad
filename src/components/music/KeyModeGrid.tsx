import type { Chroma, KeyMode, ModeName } from '@/domain/music';
import { MODE_NAMES, chroma, modeTitle, preferredTonic } from '@/domain/music';
import { cn } from 'cn';

const SHADES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3'];

const share = (n: number, max: number) => Math.sqrt(n) / Math.sqrt(max);

function shade(n: number, max: number): string {
  if (n === 0) return SHADES[0]!;
  const s = share(n, max);
  return s < 0.34 ? SHADES[1]! : s < 0.67 ? SHADES[2]! : SHADES[3]!;
}

const title = modeTitle;

/**
 * Every key in every mode, shaded by a count — finished passes on the
 * fretboard explorer, shared backing tracks in Settings.
 */
export function KeyModeGrid({
  grid,
  selected,
  onSelect,
  unit = ['pass', 'passes'],
  showCounts = false,
  testId = 'key-mode-grid',
}: {
  grid: Record<ModeName, number[]>;
  selected: KeyMode | null;
  onSelect: (keyMode: KeyMode) => void;
  unit?: [one: string, many: string];
  /** Write the number in each filled cell — for small counts, where the shade alone is coarse. */
  showCounts?: boolean;
  testId?: string;
}) {
  const max = Math.max(1, ...MODE_NAMES.flatMap((m) => grid[m]));
  const columns = Array.from({ length: 12 }, (_, i) => i as Chroma);

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-[3px] text-caption"
        style={{ gridTemplateColumns: `84px repeat(12, 22px)` }}
        data-testid={testId}
      >
        <span />
        {columns.map((c) => (
          <span key={c} className="text-center text-ink-muted">
            {preferredTonic(c, 'ionian')}
          </span>
        ))}
        {MODE_NAMES.map((mode) => (
          <div key={mode} className="contents">
            <span className="self-center text-ink-muted">{title(mode)}</span>
            {columns.map((c) => {
              const n = grid[mode][c] ?? 0;
              const tonic = preferredTonic(c, mode);
              const isSelected = selected?.mode === mode && chroma(selected.tonic) === c;
              const counted = `${n} ${n === 1 ? unit[0] : unit[1]}`;
              return (
                <button
                  key={c}
                  type="button"
                  title={`${tonic} ${title(mode)} · ${counted}`}
                  aria-label={`${tonic} ${title(mode)}, ${counted}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect({ tonic, mode })}
                  className={cn(
                    'h-[22px] text-caption tabular-nums hover:outline-1 hover:outline-ink',
                    shade(n, max),
                    share(n, max) >= 0.67 ? 'text-paper' : 'text-ink',
                    isSelected &&
                      'outline-2 outline-offset-1 outline-accent hover:outline-2 hover:outline-accent',
                  )}
                >
                  {showCounts && n > 0 ? n : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
