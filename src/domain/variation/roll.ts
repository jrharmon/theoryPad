import type { KeyMode, ModeName, PitchClass } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';
import type { Rng, Weighted } from './rng';
import { mulberry32 } from './rng';
import type {
  AxisContext,
  AxisId,
  AxisPolicies,
  AxisPolicy,
  CoverageCounts,
  ResolvedAxis,
  ResolvedKeys,
  RolledVariation,
} from './types';
import { SESSION_AXIS_ORDER, axisDefinition, axisPreferenceWeight } from './axes';

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
): ResolvedAxis {
  const definition = axisDefinition(id);

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
    if (value === null) {
      throw new Error(`Axis ${id} cannot be fixed to unknown value "${policy.value}"`);
    }
    return make(value, 'fixed');
  }

  if (policy.mode === 'hold' && heldKey !== undefined) {
    const value = definition.parse(heldKey, context);
    if (value !== null) return make(value, 'hold');
    // The held value is no longer valid — a tuning change can do that — so
    // fall through and roll rather than failing.
  }

  let candidates = definition.candidates(context);
  if (policy.mode === 'roll' && policy.from && policy.from.length > 0) {
    const allowed = new Set(policy.from);
    const narrowed = candidates.filter((c) => allowed.has(definition.key(c)));
    // An empty subset means the restriction no longer matches anything; rolling
    // from everything beats throwing in the middle of a practice session.
    if (narrowed.length > 0) candidates = narrowed;
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
      policies[id] ?? { mode: 'roll' },
      context,
      rng,
      held[id],
      coverage[id] ?? {},
    );

    out[id] = axis;
    resolved[id] = axis.key;
  }

  return { seed, axes: out };
}

/** The session key and mode, from this roll or from the session it belongs to. */
function keyModeFrom(resolved: ResolvedKeys, fallback?: KeyMode): KeyMode | null {
  if (resolved.key && resolved.mode) {
    return { tonic: resolved.key as PitchClass, mode: resolved.mode as ModeName };
  }
  return fallback ?? null;
}

/** Convenience: the resolved key and mode of a variation, if it has both. */
export function variationKeyMode(
  variation: RolledVariation,
  fallback?: KeyMode,
): KeyMode | null {
  const tonic = variation.axes.key?.value as PitchClass | undefined;
  const mode = variation.axes.mode?.value as ModeName | undefined;
  if (tonic && mode) return { tonic, mode };
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
