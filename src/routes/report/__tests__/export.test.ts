import { describe, expect, it } from 'vitest';
import type { Rep } from '@/data';
import { reportCsv, reportHtml } from '../export';
import type { Report } from '../model';

const startedAt = new Date(2026, 8, 7, 19, 5).getTime();
const rep = (overrides: Partial<Rep> = {}): Rep => ({
  id: 'r1',
  createdAt: startedAt,
  updatedAt: startedAt,
  sessionId: 's1',
  exerciseId: 'e1',
  definitionId: 'modes-through-key',
  index: 0,
  startedAt,
  endedAt: startedAt + 90_000,
  tempo: 80,
  freeTime: false,
  axes: { key: 'D', mode: 'dorian', direction: 'ascending', rhythmPattern: 'eighths' },
  seed: 1,
  status: 'completed',
  ...overrides,
});

describe('reportCsv', () => {
  it('writes a row per pass with the key, mode and the other settings apart', () => {
    const csv = reportCsv([rep()], { exercise: () => 'Modes up the neck', routine: () => null });
    const [header, line] = csv.trim().split('\r\n');
    expect(header).toBe(
      'date,started,exercise,routine,status,tempo,free_time,seconds,key,mode,other_settings,correct,questions',
    );
    expect(line).toBe(
      '2026-09-07,19:05,Modes up the neck,,completed,80,false,90,D,dorian,direction=ascending; rhythmPattern=eighths,,',
    );
  });

  it('quotes anything a spreadsheet would split, and leaves free-time tempo blank', () => {
    const csv = reportCsv(
      [rep({ freeTime: true, axes: {}, score: { correct: 8, total: 10 } })],
      { exercise: () => 'Scales, "fast"', routine: () => 'Morning, long' },
    );
    expect(csv.trim().split('\r\n')[1]).toBe(
      '2026-09-07,19:05,"Scales, ""fast""","Morning, long",completed,,true,90,,,,8,10',
    );
  });
});

describe('reportHtml', () => {
  const report: Report = {
    from: '2026-09-01',
    to: '2026-09-07',
    summary: { sessions: 2, seconds: 3000, variations: 3, exercises: 1 },
    days: [
      { date: '2026-09-06', seconds: 0 },
      { date: '2026-09-07', seconds: 3000 },
    ],
    rows: [
      {
        exerciseId: 'e1',
        name: 'Modes <up> the neck',
        theory: false,
        played: 4,
        seconds: 3000,
        tempos: { low: 72, high: 80 },
        target: 76,
        score: null,
      },
    ],
  };
  const palette = { ink: '#201e1d', bg: '#f3f2f2', rule: '#d7d3d3', muted: '#7d7979', accent: '#ec3013' };

  it('is one self-contained file: inline styles, no scripts, nothing fetched', () => {
    const html = reportHtml(report, palette);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toMatch(/<script|<link|src=|url\(/i);
    expect(html).toContain('Sep 1 – Sep 7, 2026');
    expect(html).toContain('2 sessions · 50m · 3 variations · 1 exercise');
    expect(html).toContain('<td>72–80</td>');
    expect(html).toContain('Modes &lt;up&gt; the neck');
  });
});
