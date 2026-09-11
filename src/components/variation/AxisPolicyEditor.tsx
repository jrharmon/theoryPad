import { useMemo } from 'react';
import type { Instrument } from '@/domain/instrument';
import { axisDefinition, toggleSubset } from '@/domain/variation';
import type { AxisDefinition, AxisId, AxisPolicy } from '@/domain/variation';
import { Button } from '@/components/ui/button';
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
  onChange,
}: {
  axes: AxisId[];
  policies: Partial<Record<AxisId, AxisPolicy>>;
  held: Record<string, string>;
  /** Positions are filtered by fret count and string sets come from the tuning. */
  instrument: Instrument;
  onChange: (axis: AxisId, policy: AxisPolicy) => void;
}) {
  return (
    <div className="border border-divider">
      {axes.map((id, index) => (
        <AxisRow
          key={id}
          id={id}
          first={index === 0}
          policy={policies[id] ?? { mode: 'roll' }}
          heldValue={held[id]}
          instrument={instrument}
          onChange={(policy) => onChange(id, policy)}
        />
      ))}
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
  onChange,
}: {
  id: AxisId;
  first: boolean;
  policy: AxisPolicy;
  heldValue: string | undefined;
  instrument: Instrument;
  onChange: (policy: AxisPolicy) => void;
}) {
  const definition = axisDefinition(id);
  const candidates = useMemo(
    () =>
      definition
        .candidates({ instrument, resolved: {} })
        .map((c) => ({ key: definition.key(c), label: definition.format(c) })),
    [definition, instrument],
  );
  const keys = candidates.map((c) => c.key);

  return (
    <div
      className={`grid grid-cols-[140px_120px_1fr] items-start gap-3 px-3 py-2 ${
        first ? '' : 'border-t border-divider'
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
            return (
              <Button
                key={c.key}
                size="xs"
                // Quiet on purpose: a row of accent chips on every axis is a wall of red.
                variant={on ? 'secondary' : 'ghost'}
                className={on ? '' : 'text-ink/35 line-through'}
                aria-pressed={on}
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
