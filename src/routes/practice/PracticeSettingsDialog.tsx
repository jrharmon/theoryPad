import type { Exercise } from '@/data';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { resolveGeneratedBacking } from '@/exercises/params';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { sameName } from '@/domain/library';
import { SettingsDialog } from './SettingsDialog';

/**
 * The exercise's settings, without leaving it. Applied when the dialog closes:
 * the material is regenerated, and only the axes whose policy changed are
 * rolled again; a generated-backing change picks only the progression again.
 * Saved to the exercise.
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
  // The chords a custom progression names are spelled in this roll's key.
  const keyMode = usePractice((s) => s.snapshot?.keyMode);
  const playNotes = useSettings((s) => s.settings.audio.playNotes);
  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={exercise.name}
      description={`${sameName(exercise.name, definition.name) ? '' : `From ${definition.name}. `}Applied when you close this. Changing what varies rolls just that axis again.`}
      definition={definition}
      initial={{
        tempo: exercise.tempo,
        params: exercise.params,
        axisPolicies: exercise.axisPolicies,
        ...(definition.kind === 'played'
          ? {
              generatedBacking: resolveGeneratedBacking(definition, exercise.generatedBacking),
              playNotes: exercise.playNotes ?? playNotes,
            }
          : {}),
      }}
      held={exercise.heldAxisValues}
      chordsIn={keyMode ? { keyMode } : { mode: null }}
      onApply={(changed) => void usePractice.getState().reconfigure(changed)}
    />
  );
}
