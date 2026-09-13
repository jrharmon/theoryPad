import type { Chroma, KeyMode, ModeName } from '@/domain/music';
import { MODE_NAMES, chroma, modeTitle, preferredTonic } from '@/domain/music';
import { cn } from 'cn';

const SHADES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3'];

function shade(n: number, max: number): string {
  if (n === 0) return SHADES[0]!;
  const share = Math.sqrt(n) / Math.sqrt(max);
  return share < 0.34 ? SHADES[1]! : share < 0.67 ? SHADES[2]! : SHADES[3]!;
}

const title = modeTitle;

/**
 * Every key in every mode, shaded by finished passes. Picking a cell shows
 * that key and mode on the neck.
 */
export function KeyModeGrid({
  grid,
  selected,
  onSelect,
}: {
  grid: Record<ModeName, number[]>;
  selected: KeyMode;
  onSelect: (keyMode: KeyMode) => void;
}) {
  const max = Math.max(1, ...MODE_NAMES.flatMap((m) => grid[m]));
  const columns = Array.from({ length: 12 }, (_, i) => i as Chroma);

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-[3px] text-[11px]"
        style={{ gridTemplateColumns: `84px repeat(12, 22px)` }}
        data-testid="key-mode-grid"
      >
        <span />
        {columns.map((c) => (
          <span key={c} className="text-center text-ink/55">
            {preferredTonic(c, 'ionian')}
          </span>
        ))}
        {MODE_NAMES.map((mode) => (
          <div key={mode} className="contents">
            <span className="self-center text-ink/70">{title(mode)}</span>
            {columns.map((c) => {
              const n = grid[mode][c] ?? 0;
              const tonic = preferredTonic(c, mode);
              const isSelected = selected.mode === mode && chroma(selected.tonic) === c;
              return (
                <button
                  key={c}
                  type="button"
                  title={`${tonic} ${title(mode)} · ${n} ${n === 1 ? 'pass' : 'passes'}`}
                  aria-label={`${tonic} ${title(mode)}, ${n} passes`}
                  aria-pressed={isSelected}
                  onClick={() => onSelect({ tonic, mode })}
                  className={cn(
                    'h-[22px] hover:outline-1 hover:outline-ink',
                    shade(n, max),
                    isSelected && 'outline-2 outline-offset-1 outline-accent hover:outline-2 hover:outline-accent',
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
