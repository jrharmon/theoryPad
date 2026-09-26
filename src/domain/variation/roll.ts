import type { KeyMode, ModeId, PitchClass, ScaleId } from '@/domain/music';
import { SCALE_IDS, modesOf } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { Rng, Weighted } from './rng';
import { mulberry32 } from './rng';
import type {
  AxisContext,
  AxisId,
  AxisPolicies,
  AxisPolicy,
  AxisValueKeys,
  CoverageCounts,
  ResolvedAxis,
  ResolvedKeys,
  RolledVariation,
} from './types';
import { SESSION_AXIS_ORDER, axisDefinition, axisPreferenceWeight } from './axes';
import { includesValue, policyFor } from './policies';

export interface RollOptions {
  /** The axes the exercise declares. An empty list is a static exercise. */
  axes: readonly AxisId[];
  seed: number;
  instrument: Instrument;
  /** Per-axis control. Anything omitted rolls freely. */
  policies?: AxisPolicies;
  /** Values from the previous roll — used by `hold`, and to judge freshness. */
  held?: ResolvedKeys;
  /** How often each value has been seen recently, to bias toward the unexplored. */
  coverage?: CoverageCounts;
  /** Session key and mode, when they were rolled elsewhere (a routine). */
  sessionKeyMode?: KeyMode;
  /**
   * The exercise's own limits: values outside these never come up, not even
   * pinned. A triad drill offers three-string sets and nothing else.
   */
  allowed?: AxisValueKeys;
  /**
   * The player's app-wide "never roll these". Only a roll avoids them — a key
   * pinned or held on purpose still plays — and when a roll's subset holds
   * nothing else, the subset wins: the more specific choice does.
   */
  blocked?: AxisValueKeys;
}

/**
 * How strongly the roller avoids what you have already played.
 *
 * A candidate seen `n` times recently is weighted `1 / (1 + n)`, so the neck
 * positions and keys you never reach come up more often. Without it "roll" is
 * merely random, and the fretboard explorer's "never rolled yet" list would be
 * an observation rather than something the app does anything about.
 */
function coverageWeight(seen: number): number {
  return 1 / (1 + Math.max(0, seen));
}

function orderAxes(axes: readonly AxisId[]): AxisId[] {
  const session = SESSION_AXIS_ORDER.filter((id) => axes.includes(id));
  const rest = axes.filter((id) => !SESSION_AXIS_ORDER.includes(id));
  return [...session, ...rest];
}

function resolveOne(
  id: AxisId,
  policy: AxisPolicy,
  context: AxisContext,
  rng: Rng,
  heldKey: string | undefined,
  coverage: Record<string, number>,
  limits: { allowed?: readonly string[] | undefined; blocked?: readonly string[] | undefined },
): ResolvedAxis {
  const definition = axisDefinition(id);
  const allowedKey = (key: string) =>
    !limits.allowed || limits.allowed.length === 0 || includesValue(id, limits.allowed, key);

  const make = (value: unknown, source: ResolvedAxis['source']): ResolvedAxis => {
    const key = definition.key(value);
    return {
      id,
      value,
      key,
      display: definition.format(value),
      // Nothing is "fresh" on a first roll: there is no previous value to have
      // changed from, and highlighting every axis would say nothing.
      fresh: source === 'roll' && heldKey !== undefined && heldKey !== key,
      source,
    };
  };

  if (policy.mode === 'fixed') {
    const value = definition.parse(policy.value, context);
    // Pinned to something this roll can't use — a mode the rolled scale doesn't
    // have — or the exercise doesn't offer, a policy from before it said so:
    // roll within what it does.
    if (value !== null && allowedKey(definition.key(value))) return make(value, 'fixed');
  }

  if (policy.mode === 'hold' && heldKey !== undefined) {
    const value = definition.parse(heldKey, context);
    if (value !== null && allowedKey(definition.key(value))) return make(value, 'hold');
    // The held value is no longer valid — a tuning change can do that — so
    // fall through and roll rather than failing.
  }

  let candidates = definition.candidates(context);
  if (limits.allowed && limits.allowed.length > 0) {
    const narrowed = candidates.filter((c) => allowedKey(definition.key(c)));
    if (narrowed.length > 0) candidates = narrowed;
  }
  if (policy.mode === 'roll' && policy.from && policy.from.length > 0) {
    // By identity: the editor offers keys spelled as majors, and Db is written
    // C# in phrygian.
    const narrowed = candidates.filter((c) =>
      includesValue(id, policy.from, definition.key(c)),
    );
    // An empty subset means the restriction no longer matches anything; rolling
    // from everything beats throwing in the middle of a practice session.
    if (narrowed.length > 0) candidates = narrowed;
  }
  if (limits.blocked && limits.blocked.length > 0) {
    const open = candidates.filter(
      (c) => !includesValue(id, limits.blocked, definition.key(c)),
    );
    if (open.length > 0) candidates = open;
  }

  if (candidates.length === 0) {
    throw new Error(`Axis ${id} has no candidates to roll from`);
  }

  const weighted: Weighted<unknown>[] = candidates.map((value) => {
    const key = definition.key(value);
    return {
      value,
      weight: coverageWeight(coverage[key] ?? 0) * axisPreferenceWeight(id, key, context),
    };
  });

  return make(rng.weighted(weighted), 'roll');
}

/**
 * Roll a variation.
 *
 * Deterministic in its seed, so the same rep always produces the same
 * variation and a stored seed is enough to replay one exactly.
 */
export function rollVariation(options: RollOptions): RolledVariation {
  const { axes, seed, instrument, policies = {}, held = {}, coverage = {} } = options;
  const rng = mulberry32(seed);

  const resolved: ResolvedKeys = {};
  const out: Partial<Record<AxisId, ResolvedAxis>> = {};
  const blocked = withEmptyScalesBlocked(options);

  // Session axes first: the key's spelling depends on the mode.
  for (const id of orderAxes(axes)) {
    const context: AxisContext = {
      instrument,
      resolved,
      ...(keyModeFrom(resolved, options.sessionKeyMode)
        ? { keyMode: keyModeFrom(resolved, options.sessionKeyMode)! }
        : {}),
    };

    const axis = resolveOne(
      id,
      policyFor(policies, id),
      context,
      rng,
      held[id],
      coverage[id] ?? {},
      { allowed: options.allowed?.[id], blocked: blocked?.[id] },
    );

    out[id] = axis;
    resolved[id] = axis.key;
  }

  return { seed, axes: out };
}

/**
 * The player's struck-out values, plus any scale whose every mode is struck out
 * — striking out all five shapes leaves the pentatonics nothing to roll, so
 * they are skipped rather than rolled with a struck-out shape. Only when the
 * mode rolls too: a pinned mode is played whatever Settings say.
 */
function withEmptyScalesBlocked(options: RollOptions): AxisValueKeys | undefined {
  const { blocked, axes, policies = {} } = options;
  const blockedModes = blocked?.mode ?? [];
  if (!blocked || blockedModes.length === 0 || !axes.includes('mode')) return blocked;
  if (policyFor(policies, 'mode').mode !== 'roll') return blocked;
  const empty = SCALE_IDS.filter((scale) =>
    modesOf(scale).every((mode) => blockedModes.includes(mode)),
  );
  return empty.length === 0
    ? blocked
    : { ...blocked, scale: [...(blocked.scale ?? []), ...empty] };
}

/** The session key, scale and mode, from this roll or from the session it belongs to. */
function keyModeFrom(resolved: ResolvedKeys, fallback?: KeyMode): KeyMode | null {
  if (resolved.key && resolved.mode) {
    return {
      tonic: resolved.key as PitchClass,
      scale: (resolved.scale as ScaleId | undefined) ?? 'major',
      mode: resolved.mode as ModeId,
    };
  }
  return fallback ?? null;
}

/**
 * Convenience: the resolved key, scale and mode of a variation, if it has a
 * key and mode. No scale is Major.
 */
export function variationKeyMode(
  variation: RolledVariation,
  fallback?: KeyMode,
): KeyMode | null {
  const tonic = variation.axes.key?.value as PitchClass | undefined;
  const mode = variation.axes.mode?.value as ModeId | undefined;
  const scale = (variation.axes.scale?.value as ScaleId | undefined) ?? 'major';
  if (tonic && mode) return { tonic, scale, mode };
  return fallback ?? null;
}

/** The value keys of a variation, for storing on a rep and for the next roll's `held`. */
export function variationKeys(variation: RolledVariation): Record<string, string> {
  const out: Record<string, string> = {};
  for (const axis of Object.values(variation.axes)) out[axis.id] = axis.key;
  return out;
}

/** Which axes changed this roll — what the brief highlights. */
export function freshAxes(variation: RolledVariation): AxisId[] {
  return Object.values(variation.axes)
    .filter((axis) => axis.fresh)
    .map((axis) => axis.id);
}
