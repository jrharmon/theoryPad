import { phraseSeconds } from '@/domain/phrase';
import type { AxisId, RolledVariation } from '@/domain/variation';
import type { PlayedInstance } from '../types';

/**
 * A rolled axis value, or the fallback when the axis was not rolled.
 *
 * The cast is the one place an exercise trusts that an axis holds the type
 * its definition says it does — which the axis registry guarantees.
 */
export function axisValue<T>(variation: RolledVariation, id: AxisId, fallback: T): T {
  const resolved = variation.axes[id];
  return resolved === undefined ? fallback : (resolved.value as T);
}

/** A rolled axis value, or undefined — for axes like a target degree that may be absent. */
export function optionalAxis<T>(variation: RolledVariation, id: AxisId): T | undefined {
  return variation.axes[id]?.value as T | undefined;
}

/** The usual `estimateRepSeconds`: how long the phrase lasts at the given tempo. */
export function phraseEstimate(defaultTempo: number) {
  return (instance: PlayedInstance, tempo: number | null): number =>
    phraseSeconds(instance.phrase, tempo ?? defaultTempo);
}
