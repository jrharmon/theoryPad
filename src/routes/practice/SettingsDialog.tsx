import { useState } from 'react';
import type { AnyExerciseDefinition } from '@/exercises/types';
import type { AxisId, AxisPolicies } from '@/domain/variation';
import type { TempoConfig } from '@/domain/tempo';
import { AxisPolicyEditor } from '@/components/variation/AxisPolicyEditor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { useSettings } from '@/store/settings';
import { ParamsEditor } from '../exercises/ParamsEditor';

export interface ExerciseSettings {
  tempo: TempoConfig;
  params: unknown;
  axisPolicies: AxisPolicies;
}

/**
 * An exercise's settings as a draft: tempo, its own params, and what varies.
 * Nothing is applied until the dialog closes, and then only what changed is
 * reported. Used by the practice view and by a routine's item editor.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  definition,
  initial,
  held,
  axes = definition.axes,
  hiddenParams,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  definition: AnyExerciseDefinition;
  initial: ExerciseSettings;
  held: Record<string, string>;
  /** Which axes to offer. A routine item leaves key and mode to the routine. */
  axes?: AxisId[];
  /** Params set somewhere else — a routine's theory item takes its question count from its reps. */
  hiddenParams?: string[];
  onApply: (changed: Partial<ExerciseSettings>) => void;
}) {
  // Mounted fresh on every open, so the draft always starts from what is saved.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <Draft
          title={title}
          description={description}
          definition={definition}
          initial={initial}
          held={held}
          axes={axes}
          {...(hiddenParams ? { hiddenParams } : {})}
          onApply={onApply}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function Draft({
  title,
  description,
  definition,
  initial,
  held,
  axes,
  hiddenParams,
  onApply,
  onClose,
}: {
  title: string;
  description: string;
  definition: AnyExerciseDefinition;
  initial: ExerciseSettings;
  held: Record<string, string>;
  axes: AxisId[];
  hiddenParams?: string[];
  onApply: (changed: Partial<ExerciseSettings>) => void;
  onClose: () => void;
}) {
  const instrument = useSettings((s) => s.settings.instrument);
  const [tempo, setTempo] = useState<TempoConfig>(initial.tempo);
  const [params, setParams] = useState<unknown>(initial.params);
  const [policies, setPolicies] = useState<AxisPolicies>(initial.axisPolicies);

  const apply = () => {
    const changed: Partial<ExerciseSettings> = {
      ...(tempo.targetTempo !== initial.tempo.targetTempo ? { tempo } : {}),
      ...(JSON.stringify(params) !== JSON.stringify(initial.params) ? { params } : {}),
      ...(JSON.stringify(policies) !== JSON.stringify(initial.axisPolicies)
        ? { axisPolicies: policies }
        : {}),
    };
    if (Object.keys(changed).length > 0) onApply(changed);
    onClose();
  };

  return (
    <DialogContent
      className="max-h-[85vh] overflow-y-auto sm:max-w-[860px]"
      // Not the tempo field: a stray keypress would change it.
      onOpenAutoFocus={(e) => e.preventDefault()}
      // Closing by Escape or the overlay applies too: the draft is what you meant.
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        apply();
      }}
      onPointerDownOutside={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="space-y-4">
          {tempo.targetTempo !== null && (
            <Field label="Target tempo" htmlFor="dialog-target-tempo">
              <Input
                id="dialog-target-tempo"
                type="number"
                min={30}
                max={300}
                className="tabular-nums"
                value={tempo.targetTempo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTempo({ ...tempo, targetTempo: Number(e.target.value) })
                }
              />
            </Field>
          )}
          <ParamsEditor
            definition={definition}
            stored={params}
            {...(hiddenParams ? { hidden: hiddenParams } : {})}
            onChange={(next) => setParams(next)}
          />
        </div>

        {axes.length > 0 && (
          <div>
            <Kicker>What varies</Kicker>
            <div className="mt-2">
              <AxisPolicyEditor
                axes={axes}
                policies={policies}
                held={held}
                instrument={instrument}
                allowed={definition.allowedValues}
                onChange={(axis, policy) => setPolicies({ ...policies, [axis]: policy })}
              />
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={apply}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}
