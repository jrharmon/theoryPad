import { dayStart, formatPracticeTime, weekday } from '@/domain/progress';
import { cn } from 'cn';

/**
 * Time by day as plain bars — one per day, tallest day full height. A day
 * with nothing gets a hairline so the gap reads as a day, not a missing bar.
 * Day-of-month beneath; Mondays in full ink so weeks are easy to find.
 */
export function DayBarChart({
  days,
  height = 120,
  className,
}: {
  days: { date: string; seconds: number }[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.seconds));
  const showEvery = days.length > 45 ? 7 : days.length > 16 ? 2 : 1;

  return (
    <div className={cn('overflow-x-auto', className)} data-testid="day-bar-chart">
      <div className="flex min-w-fit items-end gap-[3px]" style={{ height }}>
        {days.map((day) => (
          <div
            key={day.date}
            className="flex h-full min-w-[8px] max-w-[32px] flex-1 flex-col justify-end"
            title={`${new Date(dayStart(day.date)).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })} · ${formatPracticeTime(day.seconds)}`}
          >
            <div
              className={day.seconds > 0 ? 'bg-heat-3' : 'bg-heat-0'}
              style={{
                height: day.seconds > 0 ? Math.max(2, (day.seconds / max) * height) : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex min-w-fit gap-[3px]">
        {days.map((day, i) => (
          <span
            key={day.date}
            className={cn(
              'tabular min-w-[8px] max-w-[32px] flex-1 text-center text-[10px] leading-none',
              weekday(day.date) === 0 ? 'text-ink' : 'text-ink/45',
            )}
          >
            {i % showEvery === 0 || weekday(day.date) === 0 ? Number(day.date.slice(8)) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
