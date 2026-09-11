import { useMemo } from 'react';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { paramFields, resolveParams } from '@/exercises/params';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The exercise's own settings, generated from its params schema. A change is
 * saved only if the whole set still validates, so nothing half-typed ever
 * reaches `generate`.
 */
export function ParamsEditor({
  definition,
  stored,
  onChange,
}: {
  definition: AnyExerciseDefinition;
  stored: unknown;
  onChange: (params: Record<string, unknown>) => void;
}) {
  const fields = useMemo(() => paramFields(definition.params), [definition]);
  const values = resolveParams(definition, stored) as Record<string, unknown>;

  if (fields.length === 0) return null;

  const set = (key: string, value: unknown) => {
    const next = { ...values, [key]: value };
    if (definition.params?.safeParse(next).success) onChange(next);
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const id = `param-${field.key}`;
        const value = values[field.key];
        return (
          <Field key={field.key} label={field.label} htmlFor={id} {...(field.hint ? { hint: field.hint } : {})}>
            {field.kind === 'choice' && (
              <Select
                value={String(value)}
                onValueChange={(v) =>
                  set(field.key, field.options.find((o) => String(o.value) === v)?.value)
                }
              >
                <SelectTrigger id={id} size="sm" aria-label={field.label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {field.kind === 'number' && (
              <Input
                id={id}
                type="number"
                className="tabular-nums"
                {...(field.min !== undefined ? { min: field.min } : {})}
                {...(field.max !== undefined ? { max: field.max } : {})}
                defaultValue={String(value)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set(field.key, Number(e.target.value))
                }
              />
            )}
            {field.kind === 'toggle' && (
              <input
                id={id}
                type="checkbox"
                checked={value === true}
                onChange={(e) => set(field.key, e.target.checked)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
