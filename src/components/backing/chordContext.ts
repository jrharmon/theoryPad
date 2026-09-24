import { MODE_NAMES, type KeyMode, type ModeName } from '@/domain/music';
import type { AxisPolicies } from '@/domain/variation';

/**
 * What a custom progression's chords are shown in: the rolled key, spelled —
 * or, where nothing has been rolled, a mode's roman numerals (Ionian's when
 * the mode rolls too).
 */
export type ChordContext = { keyMode: KeyMode } | { mode: ModeName | null };

/** The mode where a policy has settled it — fixed, or held at the last roll — else null. */
export function settledMode(
  policies: AxisPolicies,
  held: Record<string, string> = {},
): ModeName | null {
  const policy = policies.mode;
  const key =
    policy?.mode === 'fixed' ? policy.value : policy?.mode === 'hold' ? held.mode : undefined;
  return MODE_NAMES.find((m) => m === key) ?? null;
}
