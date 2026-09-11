import type { AxisPolicy } from './types';

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
