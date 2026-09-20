import { describe, expect, it } from 'vitest';
import type { Phrase } from '@/domain/phrase';
import { FOUR_FOUR } from '@/domain/phrase';
import { mulberry32 } from '@/domain/variation';
import {
  addDays,
  answerWeights,
  applyRepToDay,
  dayEnd,
  dayKey,
  dayStart,
  daysBetween,
  emptyDay,
  exerciseLog,
  formatPracticeTime,
  fretRuns,
  heatLevels,
  neckSummary,
  fretTally,
  intensity,
  keyModeCounts,
  keyModeGrid,
  lastKeyMode,
  monthStart,
  neckCounts,
  practiceHeatmap,
  presetRange,
  reportSummary,
  rollupDays,
  secondsBetween,
  streak,
  tempoHistory,
  timeByDay,
  weekStart,
  weekday,
} from '..';
import type { LoggedRep, PracticeDay } from '..';

/** Local time, so the fixtures mean the same day in any timezone. */
const at = (day: string, hour = 19, minute = 0) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d, hour, minute).getTime();
};

function rep(
  overrides: Partial<LoggedRep> & { day?: string; minutes?: number } = {},
): LoggedRep {
  const { day = '2026-09-07', minutes = 5, ...rest } = overrides;
  const startedAt = at(day);
  return {
    sessionId: 's1',
    exerciseId: 'ex-modes',
    definitionId: 'modes-through-key',
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    tempo: 80,
    freeTime: false,
    axes: { key: 'D', mode: 'dorian' },
    seed: 1,
    status: 'completed',
    ...rest,
  };
}

describe('days', () => {
  it('keys a timestamp by its local calendar day', () => {
    expect(dayKey(at('2026-09-07', 0, 0))).toBe('2026-09-07');
    expect(dayKey(at('2026-09-07', 23, 59))).toBe('2026-09-07');
    expect(dayKey(dayEnd('2026-09-07'))).toBe('2026-09-07');
    expect(dayKey(dayEnd('2026-09-07') + 1)).toBe('2026-09-08');
    expect(dayKey(dayStart('2026-09-07'))).toBe('2026-09-07');
  });

  it('steps across month, year and daylight-saving boundaries by calendar day', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    // US and EU clock changes: a day is still one day.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(daysBetween('2026-03-28', '2026-03-31')).toHaveLength(4);
    expect(daysBetween('2026-09-02', '2026-09-01')).toEqual([]);
  });

  it('starts weeks on Monday', () => {
    expect(weekday('2026-09-07')).toBe(0); // a Monday
    expect(weekday('2026-09-13')).toBe(6);
    expect(weekStart('2026-09-12')).toBe('2026-09-07');
    expect(weekStart('2026-09-07')).toBe('2026-09-07');
    expect(monthStart('2026-09-12')).toBe('2026-09-01');
  });

  it('names report ranges that end today', () => {
    expect(presetRange('last-7', '2026-09-12')).toEqual({
      from: '2026-09-06',
      to: '2026-09-12',
    });
    expect(presetRange('last-30', '2026-09-12')).toEqual({
      from: '2026-08-14',
      to: '2026-09-12',
    });
    expect(presetRange('this-month', '2026-09-12')).toEqual({
      from: '2026-09-01',
      to: '2026-09-12',
    });
  });
});

describe('fretTally', () => {
  const phrase = (notes: Phrase['notes'], repeat?: number): Phrase => ({
    ppq: 480,
    timeSignature: FOUR_FOUR,
    bars: [],
    notes,
    totalTicks: 1920,
    ...(repeat ? { repeat } : {}),
  });
  const note = (string: number, fret: number, tied = false) => ({
    string,
    fret,
    startTick: 0,
    durationTicks: 240,
    ...(tied ? { tied } : {}),
  });

  it('counts every note by string and fret', () => {
    const tally = fretTally(phrase([note(0, 5), note(0, 7), note(0, 5), note(1, 5)]), 6);
    expect(tally).toEqual({ strings: 6, counts: { '0:5': 2, '0:7': 1, '1:5': 1 } });
  });

  it('counts a repeated phrase each time it plays, and a tie once', () => {
    const tally = fretTally(phrase([note(2, 7), note(2, 7, true)], 3), 7);
    expect(tally).toEqual({ strings: 7, counts: { '2:7': 3 } });
  });
});

describe('neck heat', () => {
  it('scales each spot against the busiest, gently', () => {
    expect(heatLevels({ '0:5': 100, '1:7': 25, '2:9': 1 })).toEqual({
      '0:5': 1,
      '1:7': 0.5,
      '2:9': 0.1,
    });
    expect(heatLevels({})).toEqual({});
  });

  it('counts the spots touched and names the frets never played', () => {
    const summary = neckSummary({ '0:0': 3, '5:0': 1, '2:3': 1, '2:4': 0 }, 6, 5);
    expect(summary).toEqual({ touched: 3, total: 36, untouchedFrets: [1, 2, 4, 5] });
    expect(fretRuns(summary.untouchedFrets)).toBe('1–2, 4–5');
    expect(fretRuns([0, 15, 16, 17, 22])).toBe('0, 15–17, 22');
    expect(fretRuns([])).toBe('');
  });
});

describe('rollup', () => {
  const frets = { strings: 6, counts: { '0:5': 3, '1:7': 1 } };

  it('counts time for every pass but coverage only for finished ones', () => {
    let day = emptyDay('2026-09-07');
    day = applyRepToDay(day, rep({ frets, minutes: 4 }));
    day = applyRepToDay(day, rep({ frets, minutes: 2, status: 'abandoned' }));
    expect(day).toEqual({
      date: '2026-09-07',
      seconds: 360,
      passes: 1,
      keyModes: { 'D dorian': 1 },
      frets: { 6: { '0:5': 3, '1:7': 1 } },
    });
  });

  it('keeps a 7-string’s counts apart from a 6-string’s', () => {
    const day = rollupDays([
      rep({ frets }),
      rep({ frets: { strings: 7, counts: { '0:5': 1 } } }),
      rep({ frets }),
    ])[0]!;
    expect(day.frets).toEqual({ 6: { '0:5': 6, '1:7': 2 }, 7: { '0:5': 1 } });
    expect(neckCounts([day], 6)).toEqual({ '0:5': 6, '1:7': 2 });
    expect(neckCounts([day], 4)).toEqual({});
  });

  it('files each rep under the local day it started, sorted by date', () => {
    const days = rollupDays([
      rep({ day: '2026-09-09' }),
      rep({ day: '2026-09-07' }),
      { ...rep({ day: '2026-09-07' }), startedAt: at('2026-09-07', 23, 58) },
    ]);
    expect(days.map((d) => [d.date, d.passes])).toEqual([
      ['2026-09-07', 2],
      ['2026-09-09', 1],
    ]);
  });

  it('gives the same days folded one rep at a time as rebuilt from the log', () => {
    const rng = mulberry32(42);
    const statuses = ['completed', 'completed', 'skipped', 'abandoned'] as const;
    const reps = Array.from({ length: 200 }, () =>
      rep({
        day: addDays('2026-08-01', rng.int(40)),
        minutes: rng.int(20),
        status: rng.pick(statuses),
        axes: { key: rng.pick(['C', 'D', 'Bb']), mode: rng.pick(['dorian', 'lydian']) },
        frets: {
          strings: rng.pick([6, 7]),
          counts: { [`${rng.int(6)}:${rng.int(15)}`]: 1 + rng.int(4) },
        },
      }),
    );

    const incremental = new Map<string, PracticeDay>();
    for (const r of reps) {
      const date = dayKey(r.startedAt);
      incremental.set(date, applyRepToDay(incremental.get(date) ?? emptyDay(date), r));
    }
    expect([...incremental.values()].sort((a, b) => (a.date < b.date ? -1 : 1))).toEqual(
      rollupDays(reps),
    );
  });
});

describe('calendar', () => {
  const day = (date: string, minutes: number, passes = 1): PracticeDay => ({
    ...emptyDay(date),
    seconds: minutes * 60,
    passes,
  });

  it('shades none, under 15 minutes, 15–29, and 30 or more', () => {
    expect([0, 1, 899, 900, 1799, 1800, 7200].map(intensity)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('lays out whole weeks, Monday first, ending with this one', () => {
    const cells = practiceHeatmap([day('2026-09-10', 20), day('2026-08-17', 40)], '2026-09-12');
    expect(cells).toHaveLength(28);
    expect(cells[0]!.date).toBe('2026-08-17');
    expect(cells[0]!.intensity).toBe(3);
    expect(cells.at(-1)!.date).toBe('2026-09-13');
    expect(cells.find((c) => c.date === '2026-09-10')!.intensity).toBe(2);
    expect(cells.filter((c) => c.future).map((c) => c.date)).toEqual(['2026-09-13']);
  });

  it('gives time by day with the empty days filled in', () => {
    const days = [day('2026-09-08', 10), day('2026-09-10', 5)];
    expect(timeByDay(days, '2026-09-07', '2026-09-10').map((d) => d.seconds)).toEqual([
      0, 600, 0, 300,
    ]);
    expect(secondsBetween(days, '2026-09-09', '2026-09-12')).toBe(300);
  });

  it('keeps a streak alive through today until today is over', () => {
    const days = [day('2026-09-09', 5), day('2026-09-10', 5), day('2026-09-11', 5)];
    expect(streak(days, '2026-09-12')).toEqual({ current: 3, longest: 3 });
    expect(streak([...days, day('2026-09-12', 5)], '2026-09-12').current).toBe(4);
    expect(streak(days, '2026-09-13').current).toBe(0);
  });

  it('counts only days with something finished, and remembers the longest run', () => {
    const days = [
      day('2026-08-01', 5),
      day('2026-08-02', 5),
      day('2026-08-03', 5),
      day('2026-08-04', 5),
      day('2026-09-11', 5),
      day('2026-09-12', 30, 0), // time spent, nothing finished
    ];
    expect(streak(days, '2026-09-12')).toEqual({ current: 1, longest: 4 });
  });
});

describe('log', () => {
  const reps = [
    rep({ tempo: 72, minutes: 10 }),
    rep({ tempo: 80, minutes: 10, sessionId: 's2' }),
    rep({ tempo: 96, minutes: 3, status: 'abandoned' }),
    rep({ tempo: 60, minutes: 4, freeTime: true, seed: 2 }),
    rep({
      exerciseId: 'ex-circle',
      definitionId: 'circle-of-fifths',
      tempo: null,
      freeTime: true,
      axes: {},
      minutes: 2,
      score: { correct: 8, total: 10 },
      sessionId: 's3',
    }),
    rep({
      exerciseId: 'ex-circle',
      definitionId: 'circle-of-fifths',
      tempo: null,
      freeTime: true,
      axes: {},
      minutes: 2,
      score: { correct: 6, total: 10 },
      sessionId: 's3',
    }),
  ];

  it('gives a line per exercise: passes finished, tempos actually played, time, score', () => {
    const [modes, circle] = exerciseLog(reps);
    expect(modes).toMatchObject({
      exerciseId: 'ex-modes',
      played: 3,
      seconds: 27 * 60,
      tempos: { low: 72, high: 80 },
      score: null,
    });
    expect(circle).toMatchObject({
      exerciseId: 'ex-circle',
      played: 2,
      tempos: null,
      score: { correct: 14, total: 20 },
    });
  });

  it('writes practice time compactly', () => {
    expect([0, 20, 90, 34 * 60, 60 * 60, 161 * 60].map(formatPracticeTime)).toEqual([
      '0m',
      '<1m',
      '2m',
      '34m',
      '1h 00m',
      '2h 41m',
    ]);
  });

  it('counts sessions, time, distinct rolls and exercises', () => {
    expect(reportSummary(reps)).toEqual({
      sessions: 3,
      seconds: 31 * 60,
      variations: 3,
      exercises: 2,
    });
  });

  it('lists an exercise’s finished metered tempos, oldest first', () => {
    const history = tempoHistory([rep({ day: '2026-09-09', tempo: 84 }), ...reps], 'ex-modes');
    expect(history.map((h) => h.tempo)).toEqual([72, 80, 84]);
  });
});

describe('coverage', () => {
  it('gathers key and mode counts into a grid by pitch, whatever the spelling', () => {
    const days: PracticeDay[] = [
      { ...emptyDay('2026-09-07'), keyModes: { 'Bb dorian': 2, 'C lydian': 1 } },
      { ...emptyDay('2026-09-08'), keyModes: { 'A# dorian': 1 } },
    ];
    const counts = keyModeCounts(days);
    expect(counts).toEqual({ 'Bb dorian': 2, 'C lydian': 1, 'A# dorian': 1 });
    const grid = keyModeGrid(counts);
    expect(grid.dorian[10]).toBe(3);
    expect(grid.lydian[0]).toBe(1);
    expect(grid.ionian.every((n) => n === 0)).toBe(true);
  });

  it('finds the key and mode last practiced', () => {
    expect(
      lastKeyMode([
        rep({ day: '2026-09-08', axes: { key: 'E', mode: 'phrygian' } }),
        rep({ day: '2026-09-10', axes: {} }),
        rep({ day: '2026-09-07' }),
      ]),
    ).toEqual({ tonic: 'E', mode: 'phrygian' });
    expect(lastKeyMode([])).toBeNull();
  });

  it('leans toward subjects missed, away from ones answered right', () => {
    const answers = (list: [string, boolean][]) =>
      rep({ answers: list.map(([subject, correct]) => ({ subject, correct })) });
    const weights = answerWeights([
      answers([
        ['key:Eb', false],
        ['key:G', true],
        ['mode:D dorian', false],
      ]),
      answers([
        ['key:Eb', true],
        ['key:G', true],
      ]),
    ]);
    expect(weights).toEqual({ 'key:Eb': 1, 'key:G': 1 / 3, 'mode:D dorian': 3 / 2 });
  });
});
