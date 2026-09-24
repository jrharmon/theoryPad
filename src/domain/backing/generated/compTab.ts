import type { TimeSignature } from '../../phrase';
import { ticksPerBar } from '../../phrase';

/** A bass note as a chord tone: the root, 3rd, 5th, 7th, or the root an octave up. */
export type CompTone = 1 | 3 | 5 | 7 | 'octave';

export interface CompHit {
  /** Ticks from the start of the pattern. */
  tick: number;
  durationTicks: number;
  /** 0–1. */
  velocity: number;
}

export interface BassHit extends CompHit {
  tone: CompTone;
}

/**
 * How the piano and bass play whatever chord is sounding. One bar or more; it
 * loops from the pass's bar 1, whatever the chords are doing.
 */
export interface CompPattern {
  id: string;
  name: string;
  /** A one-line description for the settings. */
  detail: string;
  timeSignature: TimeSignature;
  bars: number;
  lengthTicks: number;
  /** The whole chord, struck. In tick order. */
  piano: CompHit[];
  /** In tick order. */
  bass: BassHit[];
}

export interface CompTabSpec {
  id: string;
  name: string;
  detail: string;
  /** "4/4", "3/4", "6/8"… the only signature the pattern is offered in. */
  signature: `${number}/${number}`;
  /** A line per instrument — `PN |x---x---|`, `BS |1===5===|` — with a `|` between bars. */
  tab: string;
}

const PIANO_VELOCITY: Readonly<Record<string, number>> = { x: 0.8, X: 1 };
const BASS_TONE: Readonly<Record<string, CompTone>> = {
  '1': 1,
  '3': 3,
  '5': 5,
  '7': 7,
  o: 'octave',
};
const BASS_VELOCITY = 0.8;

/**
 * A comping pattern written as tab, like the drum beats: a line each for
 * piano (`PN`) and bass (`BS`), a cell per step, `|` between bars. A bar's
 * cell count sets its grid, and bars may differ. `=` keeps the note before it
 * ringing, across a bar line too; `-` is silence.
 *
 * Anything wrong throws with the pattern and line named, so a typo fails the
 * unit tests rather than going quiet in the backing.
 */
export function compTab(spec: CompTabSpec): CompPattern {
  const [beats, unit] = spec.signature.split('/').map(Number) as [number, number];
  const timeSignature = { beats, unit } as TimeSignature;
  const barTicks = ticksPerBar(timeSignature);

  const lines = spec.tab
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error(`Comp tab "${spec.id}" has no lines`);

  let piano: CompHit[] = [];
  let bass: BassHit[] = [];
  const seen = new Set<string>();
  let barCount: number | null = null;
  const cellCounts: number[] = [];

  for (const line of lines) {
    const fail = (why: string): never => {
      throw new Error(`Comp tab "${spec.id}", line "${line}": ${why}`);
    };
    const match = /^([A-Z]{2})\s*\|(.*)\|$/.exec(line);
    if (!match) fail('expected PN or BS, then bars between | and |');
    const [, name, body] = match!;
    if (name !== 'PN' && name !== 'BS') fail(`unknown line "${name}" — use PN or BS`);
    if (seen.has(name!)) fail(`a second ${name} line`);
    seen.add(name!);

    const bars = body!.split('|');
    if (barCount === null) barCount = bars.length;
    else if (bars.length !== barCount)
      fail(`${bars.length} bars, where the first line has ${barCount}`);

    // Every cell with its tick and length, bar lines dissolved.
    const cells: { cell: string; tick: number; ticks: number; bar: number }[] = [];
    bars.forEach((bar, b) => {
      if (cellCounts[b] === undefined) cellCounts[b] = bar.length;
      else if (bar.length !== cellCounts[b]) {
        fail(`bar ${b + 1} has ${bar.length} cells, where the first line has ${cellCounts[b]}`);
      }
      const step = barTicks / bar.length;
      if (!Number.isInteger(step))
        fail(`bar ${b + 1} has ${bar.length} cells, too fine a grid`);
      [...bar].forEach((cell, i) =>
        cells.push({ cell, tick: b * barTicks + i * step, ticks: step, bar: b }),
      );
    });

    const hits: (CompHit & { tone?: CompTone })[] = [];
    let ringing: (CompHit & { tone?: CompTone }) | null = null;
    for (const { cell, tick, ticks, bar } of cells) {
      if (cell === '=') {
        if (!ringing) fail(`"=" in bar ${bar + 1} with nothing before it to keep ringing`);
        ringing!.durationTicks += ticks;
      } else if (cell === '-') {
        ringing = null;
      } else if (name === 'PN' && PIANO_VELOCITY[cell] !== undefined) {
        ringing = { tick, durationTicks: ticks, velocity: PIANO_VELOCITY[cell] };
        hits.push(ringing);
      } else if (name === 'BS' && BASS_TONE[cell] !== undefined) {
        ringing = {
          tick,
          durationTicks: ticks,
          velocity: BASS_VELOCITY,
          tone: BASS_TONE[cell],
        };
        hits.push(ringing);
      } else {
        fail(`"${cell}" in bar ${bar + 1} — use ${name === 'PN' ? 'x X' : '1 3 5 7 o'} = -`);
      }
    }
    if (name === 'PN') piano = hits;
    else bass = hits as BassHit[];
  }

  return {
    id: spec.id,
    name: spec.name,
    detail: spec.detail,
    timeSignature,
    bars: barCount!,
    lengthTicks: barCount! * barTicks,
    piano,
    bass,
  };
}
