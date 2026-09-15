import type { Bar, Phrase, TimeSignature } from './types';
import { PPQ, WHOLE } from './types';

/** Ticks in one beat of this signature: a 6/8 beat is an eighth note. */
export function ticksPerBeat(timeSignature: TimeSignature): number {
  return WHOLE / timeSignature.unit;
}

export function ticksPerBar(timeSignature: TimeSignature): number {
  return ticksPerBeat(timeSignature) * timeSignature.beats;
}

/**
 * How long a count-in lasts, in bars. Half a bar is for slow tempos, where a
 * whole bar is a long wait; it rounds up to whole beats, so 3/4 counts two.
 */
export type CountInBars = 0 | 0.5 | 1 | 2;

export const COUNT_IN_CHOICES: readonly CountInBars[] = [0, 0.5, 1, 2];

/** A count-in's length in ticks: always whole beats, so the click stays on the beat. */
export function countInTicks(timeSignature: TimeSignature, bars: number): number {
  return ticksPerBeat(timeSignature) * Math.ceil(timeSignature.beats * bars);
}

export interface BarBeat {
  /** 0-based bar index. */
  bar: number;
  /** 0-based beat within the bar. */
  beat: number;
  /** Ticks past the start of that beat. */
  offsetTicks: number;
}

/**
 * Where a tick falls, given the phrase's bars. Bars are walked rather than
 * divided, so a phrase with a changing time signature works.
 */
export function tickToBarBeat(phrase: Phrase, tick: number): BarBeat {
  if (phrase.bars.length === 0) {
    const perBeat = ticksPerBeat(phrase.timeSignature);
    return {
      bar: 0,
      beat: Math.floor(tick / perBeat),
      offsetTicks: tick % perBeat,
    };
  }

  let found = phrase.bars[0]!;
  for (const bar of phrase.bars) {
    if (bar.startTick <= tick) found = bar;
    else break;
  }

  const within = tick - found.startTick;
  const perBeat = ticksPerBeat(found.timeSignature);
  return {
    bar: found.index,
    beat: Math.floor(within / perBeat),
    offsetTicks: within % perBeat,
  };
}

/** The first tick of a bar/beat. */
export function barBeatToTick(phrase: Phrase, bar: number, beat = 0): number {
  const found = phrase.bars.find((b) => b.index === bar);
  if (!found) throw new Error(`No bar ${bar} in phrase`);
  return found.startTick + beat * ticksPerBeat(found.timeSignature);
}

/** Seconds a span of ticks lasts at a tempo, where bpm counts quarter notes. */
export function ticksToSeconds(ticks: number, bpm: number): number {
  if (bpm <= 0) throw new Error(`Tempo must be positive, got ${bpm}`);
  return (ticks / PPQ) * (60 / bpm);
}

export function secondsToTicks(seconds: number, bpm: number): number {
  if (bpm <= 0) throw new Error(`Tempo must be positive, got ${bpm}`);
  return Math.round((seconds * bpm * PPQ) / 60);
}

/** How long the phrase takes at a tempo, including its repeats. */
export function phraseSeconds(phrase: Phrase, bpm: number): number {
  return ticksToSeconds(phrase.totalTicks * (phrase.repeat ?? 1), bpm);
}

/** Lay out `count` bars of a signature, starting at tick 0. */
export function makeBars(count: number, timeSignature: TimeSignature): Bar[] {
  const perBar = ticksPerBar(timeSignature);
  return Array.from({ length: count }, (_, index) => ({
    index,
    startTick: index * perBar,
    timeSignature,
  }));
}

/**
 * The finest subdivision the phrase actually needs, as a divisor of a quarter
 * note: 4 for sixteenths, 3 for triplets, 12 where both appear. The tab
 * renderer uses it to choose a grid that can hold every note.
 */
export function requiredSubdivision(phrase: Phrase): number {
  const candidates = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
  for (const div of candidates) {
    const step = PPQ / div;
    if (!Number.isInteger(step)) continue;
    if (phrase.notes.every((n) => n.startTick % step === 0)) return div;
  }
  return 32;
}
