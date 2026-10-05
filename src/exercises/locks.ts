import type { Instrument } from '@/domain/instrument';
import type { ScaleId } from '@/domain/music';
import { modeChoices } from '@/domain/variation';
import type { AxisId, AxisPolicies, AxisPolicy } from '@/domain/variation';
import { describedAxes } from './describe';
import { paramFields, resolveParams } from './params';
import type { AnyExerciseDefinition } from './types';

/**
 * Locks: what an exercise fixes for good. A locked setting is hidden wherever
 * the exercise is used — the practice dialog, a routine's item editor — and a
 * routine item reads it through from the exercise rather than keeping a copy.
 * Every consumer goes through these functions.
 *
 * The types are the shapes these need, not the data layer's rows, which they
 * match.
 */
export interface Locks {
  params: readonly string[];
  axes: readonly AxisId[];
}

/** Settings as an exercise or a routine item holds them. */
export interface Configured {
  params: unknown;
  axisPolicies: AxisPolicies;
  heldAxisValues: Record<string, string>;
}

/**
 * The item with every locked setting replaced by the exercise's: each locked
 * params key, each locked axis's policy and held value. Without the exercise
 * (gone altogether) the item stands as it is.
 */
export function effectiveItem<T extends Configured>(
  item: T,
  exercise: (Configured & { locked: Locks }) | undefined,
): T {
  if (!exercise) return item;
  const { locked } = exercise;
  if (locked.params.length === 0 && locked.axes.length === 0) return item;

  const own = asRecord(exercise.params);
  const params = { ...asRecord(item.params) };
  for (const key of locked.params) {
    if (key in own) params[key] = own[key];
    else delete params[key];
  }

  const axisPolicies = { ...item.axisPolicies };
  const heldAxisValues = { ...item.heldAxisValues };
  for (const axis of locked.axes) {
    const policy = exercise.axisPolicies[axis];
    if (policy) axisPolicies[axis] = policy;
    else delete axisPolicies[axis];
    const held = exercise.heldAxisValues[axis];
    if (held !== undefined) heldAxisValues[axis] = held;
    else delete heldAxisValues[axis];
  }

  return {
    ...item,
    ...(item.params === undefined && exercise.params === undefined ? {} : { params }),
    axisPolicies,
    heldAxisValues,
  };
}

/**
 * What an item editor saves: its changes, with every locked setting put back
 * to the item's own. A locked setting is the exercise's, read through; the
 * item keeps its own underneath, for when the lock comes off.
 */
export function withoutLocked<C extends Partial<Pick<Configured, 'params' | 'axisPolicies'>>>(
  changed: C,
  item: Configured,
  locks: Locks,
): C {
  const out = { ...changed };
  if (changed.params !== undefined && locks.params.length > 0) {
    const own = asRecord(item.params);
    const params = { ...asRecord(changed.params) };
    for (const key of locks.params) {
      if (key in own) params[key] = own[key];
      else delete params[key];
    }
    out.params = params;
  }
  if (changed.axisPolicies && locks.axes.length > 0) {
    const policies = { ...changed.axisPolicies };
    for (const axis of locks.axes) {
      const mine = item.axisPolicies[axis];
      if (mine) policies[axis] = mine;
      else delete policies[axis];
    }
    out.axisPolicies = policies;
  }
  return out;
}

/** The params keys a settings form shows: every field the definition has, less the locked. */
export function visibleParams(definition: AnyExerciseDefinition, locks: Locks): string[] {
  return paramFields(definition.params)
    .map((field) => field.key)
    .filter((key) => !locks.params.includes(key));
}

/** The axes a settings form shows: all of them, less the locked. */
export function visibleAxes(axes: readonly AxisId[], locks: Locks): AxisId[] {
  return axes.filter((axis) => !locks.axes.includes(axis));
}

const SESSION_AXES: readonly AxisId[] = ['scale', 'mode', 'key'];

/**
 * Whether a routine item plays its own key, scale or mode rather than the
 * routine's: only where the item's policy — locks already applied, see
 * `effectiveItem` — is Fixed. A roll, even from a subset, or a hold takes the
 * routine's. Absent is the routine's too, whatever the axis's own default
 * (Scale's is Fixed Major). Scale and mode go as a pair: a mode only means
 * something inside its scale, so overriding either takes both.
 */
export function overridesSession(axis: AxisId, policies: AxisPolicies): boolean {
  if (!SESSION_AXES.includes(axis)) return false;
  const fixed = (id: AxisId) => policies[id]?.mode === 'fixed';
  return axis === 'key' ? fixed('key') : fixed('scale') || fixed('mode');
}

/**
 * What an exercise locks, in a few words for the second line of its row:
 * "Triplets · Dorian". Values alone where they speak for themselves; toggles
 * and numbers keep their label. Axes first, in the definition's order, then
 * params. Empty when nothing is locked.
 */
export function describeLocks(
  exercise: Configured & { locked: Locks },
  definition: AnyExerciseDefinition,
  instrument: Instrument,
): string[] {
  const { locked } = exercise;
  const axes = definition.axes.filter((axis) => locked.axes.includes(axis));
  const out = describedAxes(exercise.axisPolicies, axes, instrument).map(
    ({ label, policy, values }) => {
      if (policy.mode === 'hold') return `${label} held`;
      if (values.length > 0) return values.join(' or ');
      return `Any ${label.toLowerCase()}`;
    },
  );

  const params = asRecord(resolveParams(definition, exercise.params));
  for (const field of paramFields(definition.params)) {
    if (!locked.params.includes(field.key)) continue;
    const value = params[field.key];
    if (field.kind === 'choice') {
      const label = field.options.find((o) => o.value === value)?.label ?? String(value);
      // A number picked from a list is still a number: "Min fret: 3", not "3".
      out.push(typeof value === 'number' ? `${field.label}: ${label}` : label);
    } else if (field.kind === 'multi') {
      const chosen = Array.isArray(value) ? (value as unknown[]) : [];
      out.push(
        field.options
          .filter((o) => chosen.includes(o.value))
          .map((o) => o.label)
          .join(', '),
      );
    } else if (field.kind === 'toggle') {
      out.push(`${field.label}: ${value === true ? 'on' : 'off'}`);
    } else {
      out.push(`${field.label}: ${String(value)}`);
    }
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * The second line of an exercise's row, in the library and the side panel:
 * what it locks, or the blueprint's summary when it locks nothing.
 */
export function secondLine(
  exercise: Configured & { locked: Locks },
  definition: AnyExerciseDefinition,
  instrument: Instrument,
): string {
  return describeLocks(exercise, definition, instrument).join(' · ') || definition.summary;
}

/**
 * A routine item editor's choice for key, scale or mode: the routine's (null)
 * or Fixed. Scale and mode go together, as they override together — fixing
 * one fixes the other too (Major, its first mode), and giving one back to the
 * routine gives back both.
 */
export function withSessionChoice(
  policies: AxisPolicies,
  axis: 'key' | 'scale' | 'mode',
  policy: AxisPolicy | null,
): AxisPolicies {
  const next = { ...policies };
  const pair = axis === 'key' ? (['key'] as const) : (['scale', 'mode'] as const);
  if (policy === null) {
    for (const id of pair) delete next[id];
    return next;
  }
  next[axis] = policy;
  if (axis === 'mode' && next.scale?.mode !== 'fixed') {
    next.scale = { mode: 'fixed', value: 'major' };
  }
  if (axis === 'scale' && next.mode?.mode !== 'fixed' && policy.mode === 'fixed') {
    const first = modeChoices(policy.value as ScaleId)[0];
    if (first) next.mode = { mode: 'fixed', value: first };
    else delete next.mode;
  }
  return next;
}
