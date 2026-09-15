import type { Instrument } from '@/domain/instrument';
import { pitchClass } from '@/domain/music';
import { ticksPerBar, ticksToSeconds } from '@/domain/phrase';
import type { AxisPolicies } from '@/domain/variation';
import { mulberry32, rollVariation, variationKeyMode } from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';
import { resolveParams } from './params';
import type { AnyExerciseDefinition } from './types';

/**
 * About how long a routine item takes: one sample roll of its material, times
 * its passes, plus the bar it is counted in with. Material varies in length
 * from roll to roll, so this is an estimate — which is all a routine's
 * running total needs to be.
 */
export function estimateItemSeconds(
  definition: AnyExerciseDefinition,
  item: { params: unknown; tempo: TempoConfig; axisPolicies: AxisPolicies; reps: number },
  instrument: Instrument,
): number {
  const variation = rollVariation({
    axes: definition.axes,
    seed: 1,
    instrument,
    policies: item.axisPolicies,
    ...(definition.allowedValues ? { allowed: definition.allowedValues } : {}),
  });
  const instance = definition.generate({
    variation,
    keyMode: variationKeyMode(variation) ?? { tonic: pitchClass('C'), mode: 'ionian' },
    instrument,
    params: resolveParams(definition, item.params),
    rng: mulberry32(1),
    repIndex: 0,
  });
  const tempo = item.tempo.targetTempo;
  const pass = definition.estimateRepSeconds(instance, tempo);
  const countIn =
    instance.kind === 'played' && tempo !== null
      ? ticksToSeconds(ticksPerBar(instance.phrase.timeSignature), tempo)
      : 0;
  return pass * Math.max(1, item.reps) + countIn;
}

/** "4 min", "45 sec" — a routine's running total. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}
