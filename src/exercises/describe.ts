import { axisDefinition, modeChoices, policyFor } from '@/domain/variation';
import type { AxisId, AxisPolicies, ResolvedKeys } from '@/domain/variation';
import type { ScaleId } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import { repsAreQuestions } from './params';
import type { AnyExerciseDefinition } from './types';

/**
 * What distinguishes one configured exercise from another of the same
 * definition.
 *
 * Two instances share a name and a summary, so without this the library shows
 * two identical-looking rows for two genuinely different exercises.
 */
export function describePolicies(
  policies: AxisPolicies,
  axes: readonly AxisId[],
  instrument: Instrument,
): string[] {
  const out: string[] = [];

  // The mode reads against a pinned scale: nothing for a scale with one mode.
  const scalePolicy = policyFor(policies, 'scale');
  const scale: ScaleId | null = !axes.includes('scale')
    ? 'major'
    : scalePolicy.mode === 'fixed'
      ? (scalePolicy.value as ScaleId)
      : null;
  const resolved: ResolvedKeys = scale === null ? {} : { scale };

  for (const id of axes) {
    const policy = policyFor(policies, id);
    const definition = axisDefinition(id);
    const label = definition.label;
    // Major is the default, and every exercise's: saying so on each row is noise.
    if (id === 'scale' && scale === 'major') continue;
    if (id === 'mode' && scale !== null && modeChoices(scale).length === 0) continue;

    if (policy.mode === 'roll') {
      if (policy.from && policy.from.length > 0) {
        const candidates: unknown[] =
          id === 'mode' ? modeChoices(scale) : definition.candidates({ instrument, resolved });
        const labels = candidates
          .filter((c) => policy.from!.includes(definition.key(c)))
          .map((c) => definition.format(c));
        if (labels.length > 0) out.push(`${label}: ${labels.join(', ')}`);
      }
      continue;
    }

    if (policy.mode === 'hold') {
      out.push(`${label} held`);
      continue;
    }

    const value = definition.parse(policy.value, { instrument, resolved });
    // A mode pinned that the pinned scale doesn't have rolls; say nothing.
    if (value === null && id === 'mode') continue;
    out.push(`${label}: ${value === null ? policy.value : definition.format(value)}`);
  }

  return out;
}

/** A routine item's reps in words: "3 passes", or "8 questions" for a theory set. */
export function describeReps(
  definition: AnyExerciseDefinition | undefined,
  reps: number,
): string {
  const unit = definition && repsAreQuestions(definition) ? 'question' : 'pass';
  const plural = unit === 'pass' ? 'passes' : 'questions';
  return `${reps} ${reps === 1 ? unit : plural}`;
}
