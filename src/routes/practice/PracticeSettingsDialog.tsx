import { useState } from 'react';
import type { Exercise } from '@/data';
import type { AnyExerciseDefinition } from '@/exercises/types';
import type { AxisPolicies } from '@/domain/variation';
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
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { ParamsEditor } from '../exercises/ParamsEditor';

/**
 * The exercise's settings, without leaving it. Changes are a draft until the
 * dialog closes, then applied in one go: the material is regenerated, and only
 * the axes whose policy changed are rolled again.
 */
export function PracticeSettingsDialog({
  open,
  onOpenChange,
  exercise,
  definition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise;
  definition: AnyExerciseDefinition;
}) {
  // Mounted fresh on every open, so the draft always starts from what is saved.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <Draft exercise={exercise} definition={definition} onClose={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}

function Draft({
  exercise,
  definition,
  onClose,
}: {
  exercise: Exercise;
  definition: AnyExerciseDefinition;
  onClose: () => void;
}) {
  const instrument = useSettings((s) => s.settings.instrument);
  const [tempo, setTempo] = useState<TempoConfig>(exercise.tempo);
  const [params, setParams] = useState<unknown>(exercise.params);
  const [policies, setPolicies] = useState<AxisPolicies>(exercise.axisPolicies);

  const apply = () => {
    const changed = {
      ...(tempo.targetTempo !== exercise.tempo.targetTempo ? { tempo } : {}),
      ...(JSON.stringify(params) !== JSON.stringify(exercise.params) ? { params } : {}),
      ...(JSON.stringify(policies) !== JSON.stringify(exercise.axisPolicies)
        ? { axisPolicies: policies }
        : {}),
    };
    if (Object.keys(changed).length > 0) void usePractice.getState().reconfigure(changed);
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
        <DialogTitle>{definition.name}</DialogTitle>
        <DialogDescription>
          Applied when you close this. Changing what varies rolls just that axis again.
        </DialogDescription>
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
            onChange={(next) => setParams(next)}
          />
        </div>

        <div>
          <Kicker>What varies</Kicker>
          <div className="mt-2">
            <AxisPolicyEditor
              axes={definition.axes}
              policies={policies}
              held={exercise.heldAxisValues}
              instrument={instrument}
              onChange={(axis, policy) => setPolicies({ ...policies, [axis]: policy })}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={apply}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}
