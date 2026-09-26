import type { KeyMode } from '@/domain/music';
import type { Instrument } from '@/domain/instrument';

export const AXIS_IDS = [
  // Session-scoped: rolled once and shared by every exercise in a routine.
  'scale',
  'mode',
  'key',
  // Exercise-scoped.
  'neckPosition',
  'stringSet',
  'targetScaleDegree',
  'rhythmPattern',
  'direction',
  'shapeSystem',
  'intervalPattern',
  'intervalPairing',
] as const;

export type AxisId = (typeof AXIS_IDS)[number];

export type AxisScope = 'session' | 'exercise';

/**
 * How an axis behaves when a variation is rolled.
 *
 * There is no global "wildness" dial: it means something different for a mode
 * exercise than for a picking drill and the player cannot predict either.
 * Every axis is controlled directly instead.
 */
export type AxisPolicy =
  /** Roll freely, or from a named subset. The default is a free roll. */
  | { mode: 'roll'; from?: readonly string[] }
  /** Pin it, by value key. */
  | { mode: 'fixed'; value: string }
  /** Keep whatever it was last time. */
  | { mode: 'hold' };

export type AxisPolicies = Partial<Record<AxisId, AxisPolicy>>;

/** Values resolved so far in this roll, by axis, as value keys. */
export type ResolvedKeys = Partial<Record<AxisId, string>>;

export interface AxisContext {
  instrument: Instrument;
  /** Axis values already resolved in this roll — session axes come first. */
  resolved: ResolvedKeys;
  /** The session key, scale and mode, once resolved. */
  keyMode?: KeyMode;
}

export interface AxisDefinition<T = unknown> {
  id: AxisId;
  scope: AxisScope;
  label: string;
  /** Everything this axis could roll, given what is already resolved. */
  candidates(context: AxisContext): T[];
  /**
   * Stable identity for a value. Used for equality, coverage counts, policy
   * subsets and the rep log — so it must not change once written.
   */
  key(value: T): string;
  /** How the value reads in the brief and the axis strip. */
  format(value: T): string;
  /** Rebuild a value from its key. Needed for `fixed` policies. */
  parse(key: string, context: AxisContext): T | null;
  /**
   * What two keys have to share to count as one value, when that is less than
   * the whole key: a key is its pitch, so blocking Db blocks C# too. Absent
   * means the key itself.
   */
  identity?: (key: string) => string;
  /** The policy when neither the exercise nor the player set one. Absent means roll. */
  defaultPolicy?: AxisPolicy;
}

/** Value keys per axis — an exercise's allowed values, or the player's blocked ones. */
export type AxisValueKeys = Partial<Record<AxisId, readonly string[]>>;

export interface ResolvedAxis {
  id: AxisId;
  /** The rolled value itself. */
  value: unknown;
  /** Its stable key. */
  key: string;
  /** How it reads. */
  display: string;
  /** Changed since the previous roll — drives the "fresh axis" highlighting. */
  fresh: boolean;
  /** How it was decided. */
  source: 'roll' | 'fixed' | 'hold';
}

export interface RolledVariation {
  seed: number;
  /** Only the axes the exercise declared. An exercise may declare none. */
  axes: Partial<Record<AxisId, ResolvedAxis>>;
}

/** Times each value key has been seen recently, per axis. Drives coverage bias. */
export type CoverageCounts = Partial<Record<AxisId, Record<string, number>>>;
