import type { Rep } from '@/data';
import { dayKey, formatPracticeTime, repSeconds } from '@/domain/progress';
import type { Report } from './model';
import { formatRange, formatTempos, summaryLine } from './model';

// -------------------------------------------------------------------- CSV

function csvField(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_COLUMNS = [
  'date',
  'started',
  'exercise',
  'routine',
  'status',
  'tempo',
  'free_time',
  'seconds',
  'key',
  'mode',
  'other_settings',
  'correct',
  'questions',
] as const;

/**
 * The raw log, a row per pass — the thing you might want in a spreadsheet.
 * Times are local, as the rest of the app shows them.
 */
export function reportCsv(
  reps: readonly Rep[],
  names: { exercise: (rep: Rep) => string; routine: (rep: Rep) => string | null },
): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const rep of [...reps].sort((a, b) => a.startedAt - b.startedAt)) {
    const started = new Date(rep.startedAt);
    const { key, mode, ...rest } = rep.axes;
    const other = Object.entries(rest)
      .map(([axis, value]) => `${axis}=${value}`)
      .join('; ');
    lines.push(
      [
        dayKey(rep.startedAt),
        `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
        names.exercise(rep),
        names.routine(rep),
        rep.status,
        rep.freeTime ? null : rep.tempo,
        rep.freeTime,
        Math.round(repSeconds(rep)),
        key,
        mode,
        other,
        rep.score?.correct,
        rep.score?.total,
      ]
        .map(csvField)
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

// ------------------------------------------------------------------- HTML

/** Colors for the file, read from the app's theme tokens by the caller. */
export interface Palette {
  ink: string;
  bg: string;
  rule: string;
  muted: string;
  accent: string;
}

const escape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The report as one self-contained file: styles inline, no scripts, nothing
 * fetched — it opens anywhere, offline, and prints.
 */
export function reportHtml(report: Report, palette: Palette): string {
  const range = formatRange(report.from, report.to);
  const max = Math.max(1, ...report.days.map((d) => d.seconds));
  const barWidth = Math.max(
    4,
    Math.min(24, Math.floor(680 / Math.max(1, report.days.length)) - 2),
  );
  const bars = report.days
    .map((day) => {
      const height = day.seconds > 0 ? Math.max(2, Math.round((day.seconds / max) * 90)) : 1;
      const color = day.seconds > 0 ? palette.ink : palette.rule;
      return `<div title="${escape(day.date)} · ${escape(formatPracticeTime(day.seconds))}" style="width:${barWidth}px;height:${height}px;background:${color}"></div>`;
    })
    .join('');
  const every = report.days.length > 16 ? 7 : 1;
  const labels = report.days
    .map(
      (day, i) =>
        `<span style="width:${barWidth}px">${i % every === 0 ? Number(day.date.slice(8)) : ''}</span>`,
    )
    .join('');
  const rows = report.rows
    .map(
      (row) =>
        `<tr><td>${escape(row.name)}</td><td>${row.played}</td><td>${escape(formatTempos(row))}</td><td>${row.target ?? '—'}</td><td>${escape(formatPracticeTime(row.seconds))}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Practice · ${escape(range)}</title>
<style>
  body { margin: 0; padding: 40px; background: ${palette.bg}; color: ${palette.ink};
    font: 15px/1.45 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { max-width: 820px; }
  .kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${palette.accent}; margin: 0; }
  h1 { font-size: 34px; margin: 4px 0 2px; }
  .summary { color: ${palette.muted}; margin: 0 0 28px; padding-bottom: 20px; border-bottom: 2px solid ${palette.rule}; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 90px; margin-top: 12px; }
  .days { display: flex; gap: 2px; margin: 4px 0 28px; padding-bottom: 20px;
    border-bottom: 2px solid ${palette.rule}; font-size: 10px; color: ${palette.muted}; text-align: center; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-weight: normal; font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: ${palette.muted}; padding: 6px 24px 6px 0; border-bottom: 2px solid ${palette.rule}; }
  td { text-align: left; padding: 10px 24px 10px 0; border-bottom: 1px solid ${palette.rule}; }
  .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${palette.muted}; margin: 0; }
</style>
</head>
<body>
<main>
<p class="kicker">Practice</p>
<h1>${escape(range)}</h1>
<p class="summary">${escape(summaryLine(report.summary))}</p>
<p class="label">Time by day</p>
<div class="bars">${bars}</div>
<div class="days">${labels}</div>
<table>
<thead><tr><th>Exercise</th><th>Played</th><th>Tempos used</th><th>Target</th><th>Total time</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</main>
</body>
</html>
`;
}
