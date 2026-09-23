import { PPQ, ticksPerBar } from '../phrase';
import type { TimeSignature } from '../phrase';
import type { DrumHit, DrumPattern, DrumSound } from './types';

/**
 * The metronome's grid: a twelfth of a beat, so sixteenths (every third
 * step) and eighth triplets (every fourth) both land on it. Every cell of a
 * drum tab must be a whole number of these.
 */
export const METRONOME_GRID_TICKS = PPQ / 12;

/** The line names a drum tab may use, and the sample each one plays. */
export const TAB_DRUMS: Readonly<Record<string, DrumSound>> = {
  CR: 'crash',
  RD: 'ride',
  HH: 'hat-closed',
  OH: 'hat-open',
  SN: 'snare',
  BD: 'kick',
  ST: 'stick',
};

/** What each cell means: a rest, or a hit at this velocity. */
const CELL_VELOCITY: Readonly<Record<string, number>> = {
  '-': 0,
  g: 0.35,
  x: 0.8,
  X: 1,
};

export interface DrumTabSpec {
  id: string;
  name: string;
  detail: string;
  /** "4/4", "3/4", "6/8"… the only signature the beat is offered in. */
  signature: `${number}/${number}`;
  /** A line per drum — `BD |x---x---|` — with a `|` between bars. */
  tab: string;
}

/**
 * A beat written as drum tab: a line per drum, a cell per step, `|` between
 * bars. The beat loops over as many bars as are written. A bar's cell count
 * sets its grid — 16 cells in 4/4 are sixteenths, 12 are eighth triplets — and
 * bars may differ, so a triplet fill can sit in a sixteenth beat.
 *
 * Anything wrong — an unknown drum, a stray character, bars that disagree —
 * throws with the beat and line named, so a typo fails the unit tests rather
 * than going quiet in the metronome.
 */
export function drumTab(spec: DrumTabSpec): DrumPattern {
  const [beats, unit] = spec.signature.split('/').map(Number) as [number, number];
  const timeSignature = { beats, unit } as TimeSignature;
  const bars = parseTab(spec.id, spec.tab, ticksPerBar(timeSignature));
  const grid = bars
    .flatMap((bar) => bar.map((h) => h.tick))
    .reduce(gcd, ticksPerBar(timeSignature));
  return {
    id: spec.id,
    name: spec.name,
    detail: spec.detail,
    timeSignature,
    bars: bars.length,
    gridTicks: () => grid,
    bar: (_ts, barIndex) => bars[mod(barIndex, bars.length)]!,
  };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function parseTab(id: string, tab: string, barTicks: number): DrumHit[][] {
  const lines = tab
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error(`Drum tab "${id}" has no lines`);

  let barCount: number | null = null;
  const cellCounts: number[] = [];
  const bars: DrumHit[][] = [];

  for (const line of lines) {
    const fail = (why: string): never => {
      throw new Error(`Drum tab "${id}", line "${line}": ${why}`);
    };
    const match = /^([A-Z]{2})\s*\|(.*)\|$/.exec(line);
    if (!match) fail('expected a drum name, then bars between | and |');
    const [, name, body] = match!;
    const sound = TAB_DRUMS[name!];
    if (!sound) fail(`unknown drum "${name}" — use ${Object.keys(TAB_DRUMS).join(', ')}`);

    const cells = body!.split('|');
    if (barCount === null) barCount = cells.length;
    else if (cells.length !== barCount)
      fail(`${cells.length} bars, where the first line has ${barCount}`);

    cells.forEach((bar, b) => {
      if (cellCounts[b] === undefined) cellCounts[b] = bar.length;
      else if (bar.length !== cellCounts[b]) {
        fail(`bar ${b + 1} has ${bar.length} cells, where the first line has ${cellCounts[b]}`);
      }
      const step = barTicks / bar.length;
      if (!Number.isInteger(step) || step % METRONOME_GRID_TICKS !== 0) {
        fail(
          `bar ${b + 1} has ${bar.length} cells, which don't divide the bar into the metronome's grid`,
        );
      }
      const hits = (bars[b] ??= []);
      [...bar].forEach((cell, i) => {
        const velocity = CELL_VELOCITY[cell];
        if (velocity === undefined) fail(`"${cell}" in bar ${b + 1} — use - g x X`);
        if (velocity! > 0) hits.push({ sound: sound!, tick: i * step, velocity: velocity! });
      });
    });
  }
  return bars.map((hits) => hits.sort((a, b) => a.tick - b.tick));
}
