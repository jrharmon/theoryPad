import { useMemo } from 'react';
import type { Instrument } from '@/domain/instrument';
import { axisDefinition, includesValue, isAllowed, policyFor, toggleSubset } from '@/domain/variation';
import type { AxisDefinition, AxisId, AxisPolicy, AxisValueKeys } from '@/domain/variation';
import type { ModeName, PitchClass } from '@/domain/music';
import { MODE_NAMES, modeTitle } from '@/domain/music';
import { Button } from '@/components/ui/button';
import { KeyModeTrigger } from '@/components/music/KeyModeTrigger';
import { useSettings } from '@/store/settings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * One row per axis: the control that replaced the wildness dial. Used on the
 * exercise config page now, and by the routine builder for key and mode.
 */
export function AxisPolicyEditor({
  axes,
  policies,
  held,
  instrument,
  allowed,
  onChange,
}: {
  axes: AxisId[];
  policies: Partial<Record<AxisId, AxisPolicy>>;
  held: Record<string, string>;
  /** Positions are filtered by fret count and string sets come from the tuning. */
  instrument: Instrument;
  /** The exercise's own limits: nothing outside them is offered. */
  allowed?: AxisValueKeys | undefined;
  onChange: (axis: AxisId, policy: AxisPolicy) => void;
}) {
  const practice = useSettings((s) => s.settings.practice);
  const blocked: AxisValueKeys = { key: practice.blockedKeys ?? [], mode: practice.blockedModes ?? [] };
  // The key reads first: "G, in Dorian" is how a player says it. The roller
  // still resolves the mode first, for the spelling.
  const ordered =
    axes.includes('key') && axes.includes('mode')
      ? axes.flatMap((id) => (id === 'mode' ? [] : id === 'key' ? (['key', 'mode'] as AxisId[]) : [id]))
      : axes;

  // A key and a mode both settled — fixed, or held with a value — have a
  // reference to show. A rolled one has nothing to show until it rolls.
  const settled = (id: AxisId): string | undefined => {
    const policy = policyFor(policies, id);
    if (policy.mode === 'fixed') return policy.value;
    if (policy.mode === 'hold') return held[id];
    return undefined;
  };
  const tonic = axes.includes('key') ? settled('key') : undefined;
  const mode = axes.includes('mode') ? settled('mode') : undefined;
  const keyMode =
    tonic && mode && MODE_NAMES.includes(mode as ModeName)
      ? { tonic: tonic as PitchClass, mode: mode as ModeName }
      : null;

  return (
    <div className="sheet overflow-hidden empty:hidden">
      {ordered.map((id, index) => (
        <AxisRow
          key={id}
          id={id}
          first={index === 0}
          policy={policyFor(policies, id)}
          heldValue={held[id]}
          instrument={instrument}
          allowed={allowed}
          blocked={blocked[id]}
          onChange={(policy) => onChange(id, policy)}
        />
      ))}
      {ordered.some((id) => (blocked[id]?.length ?? 0) > 0) && (
        <p className="border-t border-rule px-3 py-2 text-[12px] text-ink/64" data-testid="blocked-note">
          Struck-out keys and modes are off in Settings: a roll never picks them. Fixed still can.
        </p>
      )}
      {keyMode && (
        <div className="border-t border-rule px-3 py-2 text-[13px] text-ink/70" data-testid="key-mode-reference">
          Notes and chords of{' '}
          <KeyModeTrigger keyMode={keyMode}>
            {keyMode.tonic} {modeTitle(keyMode.mode)}
          </KeyModeTrigger>
        </div>
      )}
    </div>
  );
}

/** How a held value reads, falling back to its raw key if it no longer exists. */
function heldLabel(definition: AxisDefinition, key: string, instrument: Instrument): string {
  const value = definition.parse(key, { instrument, resolved: {} });
  return value === null ? key : definition.format(value);
}

function AxisRow({
  id,
  first,
  policy,
  heldValue,
  instrument,
  allowed,
  blocked,
  onChange,
}: {
  id: AxisId;
  first: boolean;
  policy: AxisPolicy;
  heldValue: string | undefined;
  instrument: Instrument;
  allowed: AxisValueKeys | undefined;
  /** Struck out app-wide in Settings: never rolled, still pinnable. */
  blocked: readonly string[] | undefined;
  onChange: (policy: AxisPolicy) => void;
}) {
  const definition = axisDefinition(id);
  const candidates = useMemo(
    () =>
      definition
        .candidates({ instrument, resolved: {} })
        .map((c) => ({ key: definition.key(c), label: definition.format(c) }))
        .filter((c) => isAllowed(id, allowed, c.key)),
    [definition, instrument, id, allowed],
  );
  const keys = candidates.map((c) => c.key);

  return (
    <div
      className={`grid grid-cols-[140px_120px_1fr] items-start gap-3 px-3 py-2 ${
        first ? '' : 'border-t border-rule'
      }`}
    >
      <span className="pt-1.5 text-[13px] font-semibold">{definition.label}</span>

      <Select
        value={policy.mode}
        onValueChange={(mode) => {
          if (mode === 'fixed') onChange({ mode: 'fixed', value: keys[0] ?? '' });
          else if (mode === 'hold') onChange({ mode: 'hold' });
          else onChange({ mode: 'roll' });
        }}
      >
        <SelectTrigger size="sm" aria-label={`${definition.label} policy`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="roll">Roll</SelectItem>
          <SelectItem value="fixed">Fixed</SelectItem>
          <SelectItem value="hold">Hold</SelectItem>
        </SelectContent>
      </Select>

      {policy.mode === 'fixed' && candidates.length > 0 && (
        <Select value={policy.value} onValueChange={(value) => onChange({ mode: 'fixed', value })}>
          <SelectTrigger size="sm" aria-label={`${definition.label} value`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {policy.mode === 'roll' && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={`${definition.label} rolls from`}>
          {candidates.map((c) => {
            const on = !policy.from || policy.from.length === 0 || policy.from.includes(c.key);
            const off = includesValue(id, blocked, c.key);
            return (
              <Button
                key={c.key}
                size="xs"
                // Quiet on purpose: a row of accent chips on every axis is a wall of red.
                variant={on && !off ? 'secondary' : 'ghost'}
                className={on && !off ? '' : 'text-ink/35 line-through'}
                aria-pressed={on && !off}
                disabled={off}
                title={off ? 'Struck out in Settings — never rolled' : undefined}
                onClick={() => onChange(toggleSubset(keys, policy.from, c.key))}
              >
                {c.label}
              </Button>
            );
          })}
        </div>
      )}

      {policy.mode === 'hold' && (
        <span className="pt-1.5 text-[12px] text-ink/50" data-testid={`held-${id}`}>
          {heldValue === undefined
            ? 'Nothing held yet — rolls once, then stays'
            : `Holding ${heldLabel(definition, heldValue, instrument)}`}
        </span>
      )}
    </div>
  );
}
