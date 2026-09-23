import { QUARTER, ticksPerBar, ticksPerBeat } from '../phrase';
import type { TimeSignature } from '../phrase';
import { BEATS } from './beats';
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
  bars: 1,
  gridTicks: simpleGrid,
  bar(ts) {
    const beat = ticksPerBeat(ts);
    const step = simpleGrid(ts);
    const hits: DrumHit[] = [];
    for (let tick = 0; tick < ticksPerBar(ts); tick += step) {
      const onBeat = tick % beat === 0;
      // The offbeats nearly as loud as the beats: at 0.5 they were lost in the
      // ride's own wash, and it sounded like quarters.
      hits.push(hit('ride', tick, tick === 0 ? 0.9 : onBeat ? 0.8 : 0.75));
      if (!onBeat) continue;
      const index = tick / beat;
      hits.push(hit('kick', tick, index === 0 ? 1 : 0.75));
      if (index % 2 === 1) hits.push(hit('snare', tick, 0.9));
    }
    return byTick(hits);
  },
};

/** Simple first: it fits every signature. The rest are tab, in beats.ts. */
const PATTERNS: readonly DrumPattern[] = [SIMPLE, ...BEATS];

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
