import { describe, expect, it } from 'vitest';
import type { ReportRow } from '../model';
import { formatRange, formatTempos, sortRows, summaryLine } from '../model';

const row = (overrides: Partial<ReportRow>): ReportRow => ({
  exerciseId: overrides.name ?? 'x',
  name: 'x',
  theory: false,
  played: 1,
  seconds: 60,
  tempos: null,
  target: null,
  score: null,
  ...overrides,
});

describe('report model', () => {
  const rows = [
    row({ name: 'Modes up the neck', tempos: { low: 72, high: 80 }, target: 76, seconds: 900 }),
    row({
      name: 'Circle of fifths',
      theory: true,
      score: { correct: 14, total: 20 },
      seconds: 300,
    }),
    row({ name: 'Legato', tempos: { low: 96, high: 108 }, target: 100, seconds: 1200 }),
  ];

  it('sorts by any column, theory rows below every tempo', () => {
    expect(sortRows(rows, 'tempos', true).map((r) => r.name)).toEqual([
      'Legato',
      'Modes up the neck',
      'Circle of fifths',
    ]);
    expect(sortRows(rows, 'time', false).map((r) => r.name)[0]).toBe('Circle of fifths');
    expect(sortRows(rows, 'name', false).map((r) => r.name)[0]).toBe('Circle of fifths');
  });

  it('shows a tempo range, a single tempo, or a theory score', () => {
    expect(rows.map(formatTempos)).toEqual(['72–80', '14/20 · 70%', '96–108']);
    expect(formatTempos(row({ tempos: { low: 80, high: 80 } }))).toBe('80');
    expect(formatTempos(row({}))).toBe('—');
  });

  it('writes the range and the summary line', () => {
    expect(formatRange('2026-08-31', '2026-09-06')).toBe('Aug 31 – Sep 6, 2026');
    expect(formatRange('2025-12-29', '2026-01-04')).toBe('Dec 29, 2025 – Jan 4, 2026');
    expect(summaryLine({ sessions: 5, seconds: 161 * 60, variations: 28, exercises: 1 })).toBe(
      '5 sessions · 2h 41m · 28 variations · 1 exercise',
    );
  });
});
