import type { HeatmapCell, Intensity } from '@/domain/progress';
import { dayStart, formatPracticeTime } from '@/domain/progress';
import { cn } from 'cn';

const SHADE: Record<Intensity, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function label(cell: HeatmapCell): string {
  const date = new Date(dayStart(cell.date)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return cell.future ? date : `${date} · ${formatPracticeTime(cell.seconds)}`;
}

/**
 * Practice intensity as a calendar: a row per week, Monday first, the
 * current week last. Today is outlined; days still to come are left blank
 * rather than drawn as missed.
 */
export function HeatmapGrid({
  cells,
  today,
  cellSize = 14,
  className,
}: {
  cells: HeatmapCell[];
  today: string;
  cellSize?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('inline-grid gap-[3px]', className)}
      style={{ gridTemplateColumns: `repeat(7, ${cellSize}px)` }}
      role="img"
      aria-label="Practice over the last four weeks"
      data-testid="heatmap"
    >
      {WEEKDAYS.map((day, i) => (
        <span key={i} className="text-center text-caption leading-none text-ink-faint">
          {day}
        </span>
      ))}
      {cells.map((cell) => (
        <span
          key={cell.date}
          title={label(cell)}
          data-intensity={cell.future ? undefined : cell.intensity}
          className={cn(
            cell.future ? 'border border-heat-future' : SHADE[cell.intensity],
            cell.date === today && 'outline-2 outline-offset-1 outline-heat-today',
          )}
          style={{ width: cellSize, height: cellSize }}
        />
      ))}
    </div>
  );
}
