import type { KeyMode } from '@/domain/music';
import type { AxisId, RolledVariation } from '@/domain/variation';
import type { Brief } from '../types';

/**
 * Briefs are assembled here so every exercise phrases itself the same way.
 * The headline states the whole rolled variation in one sentence; the
 * instruction says what to do with it.
 */

export interface BriefParts {
  keyMode: KeyMode;
  variation: RolledVariation;
  reps: number;
  tempo: number | null;
  highlightAxes?: AxisId[];
}

export function keyModeLabel(keyMode: KeyMode): string {
  return `${keyMode.tonic} ${keyMode.mode.charAt(0).toUpperCase()}${keyMode.mode.slice(1)}`;
}

/**
 * "Two passes at 76 bpm" / "Two passes, free time".
 *
 * Rendered by the runner rather than baked into a brief: the player can move
 * the tempo mid-rep, and a brief generated once would go stale.
 */
export function repsAndTempo(reps: number, tempo: number | null): string {
  const passes = reps === 1 ? 'One pass' : reps === 2 ? 'Two passes' : `${reps} passes`;
  return tempo === null ? `${passes}, in free time` : `${passes} at ${tempo} bpm`;
}

/** The value of an axis as it should read, or a fallback. */
export function axisDisplay(
  variation: RolledVariation,
  id: AxisId,
  fallback = '',
): string {
  return variation.axes[id]?.display ?? fallback;
}

/** "1st", "2nd", "3rd", "6th" — for reading a degree aloud. */
export function ordinal(n: number): string {
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? 'st'
      : n % 10 === 2 && n % 100 !== 12
        ? 'nd'
        : n % 10 === 3 && n % 100 !== 13
          ? 'rd'
          : 'th';
  return `${n}${suffix}`;
}

export function makeBrief(
  headline: string,
  instruction: string,
  highlightAxes: AxisId[] = [],
): Brief {
  return { headline, instruction, highlightAxes };
}

/**
 * The axes worth showing in the strip: the ones the exercise nominated, with
 * anything freshly rolled brought to the front so a change is noticed.
 */
export function orderedHighlights(
  variation: RolledVariation,
  preferred: AxisId[],
): AxisId[] {
  const present = preferred.filter((id) => variation.axes[id] !== undefined);
  const fresh = present.filter((id) => variation.axes[id]!.fresh);
  const rest = present.filter((id) => !variation.axes[id]!.fresh);
  return [...fresh, ...rest];
}
