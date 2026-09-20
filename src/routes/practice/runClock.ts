import type { Phrase } from '@/domain/phrase';
import { phraseSeconds, ticksToSeconds } from '@/domain/phrase';
import type { RunnerSnapshot } from '@/exercises/runner';

/**
 * The transport's clock: how long this press of Play lasts, and how far into
 * it you are.
 *
 * Both halves are measured in ticks and converted at the tempo being played,
 * so nudging the tempo rescales the elapsed time and the length together and
 * the fraction between them stays honest. A pause simply stops the clock, so
 * the elapsed time holds where it was without anything else to remember.
 */
export interface RunClock {
  elapsedSeconds: number;
  totalSeconds: number;
}

/**
 * The clock for a metered exercise, or null where there is nothing to time —
 * a theory set, free time, or an improvisation with no written phrase.
 *
 * The length is one pass of the material times the passes one press of Play
 * runs: 1 standalone, and a routine item's rep count.
 *
 * Looping has no end to count toward, so it is timed as the loop instead: the
 * length is one time through, and the elapsed time starts again with it. What
 * you want to know going round is how far through this one you are.
 */
export function runClock(snapshot: RunnerSnapshot, phrase: Phrase | null): RunClock | null {
  const { currentTempo, loop } = snapshot;
  if (currentTempo === null || !phrase || phrase.totalTicks <= 0) return null;
  const pass = phraseSeconds(phrase, currentTempo);
  return {
    elapsedSeconds: ticksToSeconds(
      loop ? snapshot.phraseTick : snapshot.runTicks,
      currentTempo,
    ),
    totalSeconds: loop ? pass : pass * Math.max(1, snapshot.passes),
  };
}

/** `0:07`, `1:04`, `12:30` — a clock read while playing, so seconds always show. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
