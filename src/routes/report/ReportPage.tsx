import { useEffect, useMemo, useState } from 'react';
import type { DayKey, RangePreset } from '@/domain/progress';
import { formatPracticeTime, presetRange } from '@/domain/progress';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Kicker } from '@/components/ui/kicker';
import { DayBarChart } from '@/components/charts/DayBarChart';
import { useExercises } from '@/store/exercises';
import { useReport } from '@/store/report';
import { useRoutines } from '@/store/routines';
import { downloadFile } from '@/lib/download';
import { findExerciseDefinition } from '@/exercises/registry';
import type { Palette } from './export';
import { reportCsv, reportHtml } from './export';
import type { SortColumn } from './model';
import { buildReport, formatRange, formatTempos, sortRows } from './model';

type Choice = RangePreset | 'custom';

const PRESETS: { id: Choice; label: string }[] = [
  { id: 'last-7', label: 'Last 7 days' },
  { id: 'last-30', label: 'Last 30 days' },
  { id: 'this-month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

const COLUMNS: { id: SortColumn; label: string }[] = [
  { id: 'name', label: 'Exercise' },
  { id: 'played', label: 'Played' },
  { id: 'tempos', label: 'Tempos used' },
  { id: 'target', label: 'Target' },
  { id: 'time', label: 'Total time' },
];

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div>
      <Kicker>{label}</Kicker>
      <p className="tabular text-[28px] leading-tight" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

/**
 * The file's colors, from the same tokens the app is drawn with — always the
 * light ones, whatever is on screen: it is a document to print or share.
 * Stamping light, reading and restoring is synchronous, so nothing paints.
 */
function themePalette(): Palette {
  const root = document.documentElement;
  const shown = root.dataset.theme;
  root.dataset.theme = 'light';
  try {
    const style = getComputedStyle(root);
    const token = (name: string) => style.getPropertyValue(name).trim();
    return {
      ink: token('--color-ink'),
      bg: token('--color-bg'),
      rule: token('--color-neutral-300'),
      muted: token('--color-neutral-600'),
      accent: token('--color-accent'),
    };
  } finally {
    if (shown === undefined) delete root.dataset.theme;
    else root.dataset.theme = shown;
  }
}

/** What you practiced over a range: four numbers, time by day, and one table. */
export function ReportPage() {
  const { today, reps, days, sessions, from, to, load, touch } = useReport();
  const { routines, load: loadRoutines } = useRoutines();
  const { exercises, load: loadExercises } = useExercises();
  const [choice, setChoice] = useState<Choice>('last-7');
  const [custom, setCustom] = useState<{ from: DayKey; to: DayKey }>(() =>
    presetRange('last-7', today),
  );
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({
    column: 'time',
    descending: true,
  });

  useEffect(() => {
    touch();
    void loadExercises();
    void loadRoutines();
  }, [touch, loadExercises, loadRoutines]);

  const range = choice === 'custom' ? custom : presetRange(choice, today);
  useEffect(() => {
    if (range.from <= range.to) void load(range.from, range.to);
  }, [range.from, range.to, load]);

  const report = useMemo(
    () => (from && to ? buildReport({ from, to, reps, days, exercises }) : null),
    [from, to, reps, days, exercises],
  );
  const rows = useMemo(
    () => (report ? sortRows(report.rows, sort.column, sort.descending) : []),
    [report, sort],
  );

  const exportHtml = () => {
    if (!report) return;
    downloadFile(
      `theorypad-report-${report.from}-to-${report.to}.html`,
      reportHtml({ ...report, rows }, themePalette()),
      'text/html',
    );
  };

  const exportCsv = () => {
    if (!report) return;
    const routineBySession = new Map(sessions.map((s) => [s.id, s.routineId]));
    const routineName = new Map(routines.map((r) => [r.id, r.name]));
    const csv = reportCsv(reps, {
      exercise: (rep) => findExerciseDefinition(rep.definitionId)?.name ?? rep.definitionId,
      routine: (rep) => {
        const routineId = routineBySession.get(rep.sessionId);
        return routineId ? (routineName.get(routineId) ?? null) : null;
      },
    });
    downloadFile(`theorypad-log-${report.from}-to-${report.to}.csv`, csv, 'text/csv');
  };

  const sortBy = (column: SortColumn) =>
    setSort((s) =>
      s.column === column
        ? { column, descending: !s.descending }
        : { column, descending: column !== 'name' },
    );

  return (
    <section>
      <div className="px-8 py-7">
        <Kicker accent>Practice</Kicker>
        <h1>Report</h1>
        <p className="text-[15px] text-ink/70" data-testid="report-range">
          {formatRange(range.from, range.to)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-8 pb-5">
        <div className="flex gap-1" role="group" aria-label="Date range">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="secondary"
              aria-pressed={choice === preset.id}
              className={`rounded-toggle ${choice === preset.id ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : ''}`}
              onClick={() => {
                if (preset.id === 'custom' && choice !== 'custom') setCustom(range);
                setChoice(preset.id);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {choice === 'custom' && (
          <div className="flex items-center gap-2 text-[13px]">
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className="border border-rule bg-paper px-2 py-1"
            />
            <span className="text-ink/64">to</span>
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              min={custom.from}
              max={today}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className="border border-rule bg-paper px-2 py-1"
            />
          </div>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="secondary" disabled={!report} onClick={exportHtml}>
            Export report
          </Button>
          <Button size="sm" variant="secondary" disabled={!report} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {report && (
        <>
          <div className="sheet mx-8 mb-4 flex flex-wrap gap-12 px-5 py-4">
            <Stat label="Sessions" value={String(report.summary.sessions)} testId="stat-sessions" />
            <Stat label="Time" value={formatPracticeTime(report.summary.seconds)} testId="stat-time" />
            <Stat label="Variations" value={String(report.summary.variations)} testId="stat-variations" />
            <Stat label="Exercises" value={String(report.summary.exercises)} testId="stat-exercises" />
          </div>

          <div className="sheet mx-8 mb-4 px-5 py-4">
            <Kicker>Time by day</Kicker>
            <DayBarChart days={report.days} className="mt-3" />
          </div>

          <div className="px-8 pb-6">
            {rows.length === 0 ? (
              <EmptyState title="Nothing logged in this range">
                Passes are logged as they end — play something, or pick a longer range.
              </EmptyState>
            ) : (
              <div className="sheet overflow-x-auto px-5 pb-1">
                <table className="w-full border-collapse text-left text-[14px]" data-testid="report-table">
                  <thead>
                    <tr className="border-b-(length:--rule-section-w) border-divider">
                      {COLUMNS.map((column) => (
                        <th
                          key={column.id}
                          className="py-2 pr-6 font-normal"
                          aria-sort={
                            sort.column === column.id
                              ? sort.descending
                                ? 'descending'
                                : 'ascending'
                              : 'none'
                          }
                        >
                          <button
                            type="button"
                            className={
                              sort.column === column.id
                                ? 'kicker text-ink'
                                : 'kicker text-ink/64 hover:text-ink'
                            }
                            onClick={() => sortBy(column.id)}
                          >
                            {column.label}
                            {sort.column === column.id ? (sort.descending ? ' ↓' : ' ↑') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.exerciseId} className="border-b border-rule last:border-b-0" data-testid="report-row">
                        <td className="py-3 pr-6">{row.name}</td>
                        <td className="tabular py-3 pr-6">{row.played}</td>
                        <td className="tabular py-3 pr-6">{formatTempos(row)}</td>
                        <td className="tabular py-3 pr-6">{row.target ?? '—'}</td>
                        <td className="tabular py-3 pr-6">{formatPracticeTime(row.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
