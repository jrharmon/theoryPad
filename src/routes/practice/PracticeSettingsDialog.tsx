import type { Exercise } from '@/data';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { usePractice } from '@/store/practice';
import { SettingsDialog } from './SettingsDialog';

/**
 * The exercise's settings, without leaving it. Applied when the dialog closes:
 * the material is regenerated, and only the axes whose policy changed are
 * rolled again. Saved to the exercise.
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
  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={definition.name}
      description="Applied when you close this. Changing what varies rolls just that axis again."
      definition={definition}
      initial={{
        tempo: exercise.tempo,
        params: exercise.params,
        axisPolicies: exercise.axisPolicies,
      }}
      held={exercise.heldAxisValues}
      onApply={(changed) => void usePractice.getState().reconfigure(changed)}
    />
  );
}
