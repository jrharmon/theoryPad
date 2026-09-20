import type { AxisId, AxisValues, RolledVariation } from '@/domain/variation';

/**
 * A rolled axis value, or the fallback when the axis was not rolled.
 *
 * The cast is the one place an exercise trusts that an axis holds the type
 * its definition says it does — which the axis registry guarantees.
 */
export function axisValue<Id extends AxisId>(
  variation: RolledVariation,
  id: Id,
  fallback: AxisValues[Id],
): AxisValues[Id] {
  const resolved = variation.axes[id];
  return resolved === undefined ? fallback : (resolved.value as AxisValues[Id]);
}

/** A rolled axis value, or undefined — for axes like a target degree that may be absent. */
export function optionalAxis<Id extends AxisId>(
  variation: RolledVariation,
  id: Id,
): AxisValues[Id] | undefined {
  return variation.axes[id]?.value as AxisValues[Id] | undefined;
}
