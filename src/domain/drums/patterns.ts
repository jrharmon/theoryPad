import { EIGHTH, FOUR_FOUR, QUARTER, ticksPerBar, ticksPerBeat } from '../phrase';
import type { TimeSignature } from '../phrase';
import type { DrumHit, DrumPattern, DrumSound } from './types';

const hit = (sound: DrumSound, tick: number, velocity: number): DrumHit => ({
  sound,
  tick,
  velocity,
});

const byTick = (hits: DrumHit[]): DrumHit[] => hits.sort((a, b) => a.tick - b.tick);

/**
 * The player's own spec — a steady ride on the eighths, a steady kick on the
 * quarters, the snare every other beat from the second — generalised so it
 * holds in any signature:
 *
 * - kick on every beat;
 * - snare on every second beat, 1-indexed from 2: 4/4 gives 2 and 4, 3/4
 *   gives 2, 6/8 gives 2, 4 and 6;
 * - ride on every half-beat when the beat is a quarter or longer, and on the
 *   beat when it is already an eighth or shorter — otherwise 6/8 would ride on
 *   sixteenths, which is a blur.
 *
 * The downbeat's ride and kick are louder: that is what makes bar 1 findable
 * without an accent click. Nothing carries across the bar line.
 */
function simpleGrid(ts: TimeSignature): number {
  const beat = ticksPerBeat(ts);
  return beat >= QUARTER ? beat / 2 : beat;
}

const SIMPLE: DrumPattern = {
  id: 'simple',
  name: 'Simple',
  detail: 'Ride, kick on every beat, snare on every other.',
  timeSignature: null,
  gridTicks: simpleGrid,
  bar(ts) {
    const beat = ticksPerBeat(ts);
    const step = simpleGrid(ts);
    const hits: DrumHit[] = [];
    for (let tick = 0; tick < ticksPerBar(ts); tick += step) {
      const onBeat = tick % beat === 0;
      hits.push(hit('ride', tick, tick === 0 ? 0.9 : onBeat ? 0.7 : 0.5));
      if (!onBeat) continue;
      const index = tick / beat;
      hits.push(hit('kick', tick, index === 0 ? 1 : 0.75));
      if (index % 2 === 1) hits.push(hit('snare', tick, 0.9));
    }
    return byTick(hits);
  },
};

/** Beat `n` (1-based) and its "and", in 4/4 ticks. */
const beat = (n: number) => (n - 1) * QUARTER;
const and = (n: number) => beat(n) + EIGHTH;

/** Closed hats on the eighths of a 4/4 bar, leaving out any tick in `except`. */
function eighthHats(velocity: number, except: number[] = []): DrumHit[] {
  const hits: DrumHit[] = [];
  for (let tick = 0; tick < 4 * QUARTER; tick += EIGHTH) {
    if (!except.includes(tick))
      hits.push(hit('hat-closed', tick, tick % QUARTER ? velocity * 0.75 : velocity));
  }
  return hits;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Starting points, to be tuned by ear at the gate. */
const UPBEAT: DrumPattern = {
  id: 'upbeat',
  name: 'Upbeat',
  detail: 'Hats on the eighths, an open hat and an extra kick that push.',
  timeSignature: FOUR_FOUR,
  gridTicks: () => EIGHTH,
  bar: () =>
    byTick([
      ...eighthHats(0.7, [and(4)]),
      hit('hat-open', and(4), 0.7),
      hit('kick', beat(1), 1),
      hit('kick', beat(3), 0.8),
      hit('kick', and(3), 0.7),
      hit('snare', beat(2), 0.9),
      hit('snare', beat(4), 0.9),
    ]),
};

const SOFT: DrumPattern = {
  id: 'soft',
  name: 'Soft',
  detail: 'Quiet hat and snare, for slow work.',
  timeSignature: FOUR_FOUR,
  gridTicks: () => QUARTER,
  bar: () =>
    byTick([
      ...[1, 2, 3, 4].map((n) => hit('hat-closed', beat(n), n === 1 ? 0.55 : 0.45)),
      hit('kick', beat(1), 0.55),
      hit('kick', beat(3), 0.45),
      hit('snare', beat(2), 0.35),
      hit('snare', beat(4), 0.35),
    ]),
};

const HEAVY: DrumPattern = {
  id: 'heavy',
  name: 'Heavy',
  detail: 'Full snare, a busy kick, and a crash every four bars.',
  timeSignature: FOUR_FOUR,
  gridTicks: () => EIGHTH,
  bar(_ts, barIndex) {
    const crash = mod(barIndex, 4) === 0;
    return byTick([
      // The crash takes the downbeat's hat, as a drummer's right hand would.
      ...eighthHats(0.8, crash ? [beat(1)] : []),
      ...(crash ? [hit('crash', beat(1), 0.9)] : []),
      hit('kick', beat(1), 1),
      hit('kick', and(2), 0.85),
      hit('kick', beat(3), 0.9),
      hit('snare', beat(2), 1),
      hit('snare', beat(4), 1),
    ]);
  },
};

const PATTERNS: readonly DrumPattern[] = [SIMPLE, UPBEAT, SOFT, HEAVY];

export function drumPatterns(): readonly DrumPattern[] {
  return PATTERNS;
}

export function patternById(id: string): DrumPattern | undefined {
  return PATTERNS.find((p) => p.id === id);
}

const sameSignature = (a: TimeSignature, b: TimeSignature) =>
  a.beats === b.beats && a.unit === b.unit;

/** The patterns that fit: the signature-agnostic ones, and those written for this signature. */
export function patternsFor(timeSignature: TimeSignature): DrumPattern[] {
  return PATTERNS.filter(
    (p) => p.timeSignature === null || sameSignature(p.timeSignature, timeSignature),
  );
}
