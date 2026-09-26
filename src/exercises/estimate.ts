import type { Instrument } from '@/domain/instrument';
import { pitchClass } from '@/domain/music';
import { phraseSeconds, ticksPerBar, ticksToSeconds } from '@/domain/phrase';
import type { AxisPolicies } from '@/domain/variation';
import { mulberry32, rollVariation, variationKeyMode } from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';
import { routineItemRun } from './params';
import type { AnyExerciseDefinition } from './types';

/** For an exercise with no pulse of its own: something to estimate against. */
const DEFAULT_TEMPO = 90;

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
  const run = routineItemRun(definition, item);
  const context = {
    variation,
    keyMode: variationKeyMode(variation) ?? {
      tonic: pitchClass('C'),
      scale: 'major',
      mode: 'ionian' as const,
    },
    instrument,
    params: run.params,
    rng: mulberry32(1),
    repIndex: 0,
  };
  const reps = run.passes;
  if (definition.kind === 'theory') {
    return definition.estimateRepSeconds(definition.generate(context)) * reps;
  }
  const tempo = item.tempo.targetTempo;
  const played = definition.generate(context);
  const countIn =
    tempo !== null ? ticksToSeconds(ticksPerBar(played.phrase.timeSignature), tempo) : 0;
  const pass =
    definition.estimateRepSeconds?.(played, tempo) ??
    phraseSeconds(played.phrase, tempo ?? definition.defaults.targetTempo ?? DEFAULT_TEMPO);
  return pass * reps + countIn;
}

/** "4 min", "45 sec" — a routine's running total. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  return `${Math.round(seconds / 60)} min`;
}
