import { axisDefinition } from './axes';
import type { AxisId, AxisPolicies, AxisPolicy, AxisValueKeys } from './types';

/**
 * Toggle one candidate in or out of a roll's subset. Selecting everything is
 * the same as no subset, and stored as one so a later candidate is included;
 * the last candidate cannot be removed, since rolling from nothing is not a roll.
 */
export function toggleSubset(
  all: readonly string[],
  from: readonly string[] | undefined,
  key: string,
): AxisPolicy {
  const current = new Set(from && from.length > 0 ? from : all);
  if (current.has(key)) {
    if (current.size === 1) return { mode: 'roll', from: [...current] };
    current.delete(key);
  } else {
    current.add(key);
  }
  const next = all.filter((k) => current.has(k));
  return next.length === all.length ? { mode: 'roll' } : { mode: 'roll', from: next };
}

/** The policy an axis runs under: the one set, or the axis's own default. */
export function policyFor(policies: AxisPolicies | undefined, id: AxisId): AxisPolicy {
  return policies?.[id] ?? axisDefinition(id).defaultPolicy ?? { mode: 'roll' };
}

/** Whether a value key is in a list, by the axis's notion of the same value. */
export function includesValue(
  id: AxisId,
  keys: readonly string[] | undefined,
  key: string,
): boolean {
  if (!keys || keys.length === 0) return false;
  const identity = axisDefinition(id).identity ?? ((k: string) => k);
  const target = identity(key);
  return keys.some((k) => identity(k) === target);
}

/** Whether an exercise allows a value on an axis. No list allows everything. */
export function isAllowed(
  id: AxisId,
  allowed: AxisValueKeys | undefined,
  key: string,
): boolean {
  const list = allowed?.[id];
  return !list || list.length === 0 || includesValue(id, list, key);
}
