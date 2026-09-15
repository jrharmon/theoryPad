import { axisDefinition, policyFor } from '@/domain/variation';
import type { AxisId, AxisPolicies } from '@/domain/variation';
import type { Instrument } from '@/domain/instrument';

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

  for (const id of axes) {
    const policy = policyFor(policies, id);
    if (policy.mode === 'roll') {
      if (policy.from && policy.from.length > 0) {
        const definition = axisDefinition(id);
        const labels = definition
          .candidates({ instrument, resolved: {} })
          .filter((c) => policy.from!.includes(definition.key(c)))
          .map((c) => definition.format(c));
        if (labels.length > 0) out.push(`${definition.label}: ${labels.join(', ')}`);
      }
      continue;
    }

    const definition = axisDefinition(id);

    if (policy.mode === 'hold') {
      out.push(`${definition.label} held`);
      continue;
    }

    const value = definition.parse(policy.value, { instrument, resolved: {} });
    out.push(`${definition.label}: ${value === null ? policy.value : definition.format(value)}`);
  }

  return out;
}
