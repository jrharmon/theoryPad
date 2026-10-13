import type { RoutineItem } from '@/data';
import type { ChordContext } from '@/components/backing/chordContext';
import { effectiveItem, visibleAxes } from '@/exercises/locks';
import { repsAreQuestions, resolveGeneratedBacking } from '@/exercises/params';
import { findExerciseDefinition } from '@/exercises/registry';
import { exerciseLabel, useExerciseLookup } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { SettingsDialog, type ExerciseSettings } from '../practice/SettingsDialog';

const NO_LOCKS = { params: [], axes: [] } as const;

/**
 * A routine item's own copy of its exercise's settings — opened from its row
 * in the builder, or from the transport while the routine plays it. Locked
 * settings are the exercise's, so they are read through and not offered.
 * `onApply` gets what changed, locked settings included as read.
 */
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  whilePlaying = false,
  chordsIn,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RoutineItem;
  /** On the practice screen, where closing it regenerates the item. */
  whilePlaying?: boolean;
  /** What the generated backing's custom chords are shown in. */
  chordsIn: ChordContext;
  onApply: (changed: Partial<ExerciseSettings>) => void;
}) {
  const playNotes = useSettings((s) => s.settings.audio.playNotes);
  const definition = findExerciseDefinition(item.definitionId);
  const exercise = useExerciseLookup()(item.exerciseId);
  if (!definition) return null;
  const effective = effectiveItem(item, exercise);
  const locks = exercise?.locked ?? NO_LOCKS;
  const questions = repsAreQuestions(definition);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={exercise ? exerciseLabel(exercise) : definition.name}
      description={`This copy only — the exercise in your library is left as it is. Key, scale and mode are the routine’s unless fixed here.${whilePlaying ? ' Applied when you close this; changing what varies rolls just that axis again.' : ''}`}
      definition={definition}
      initial={{
        tempo: effective.tempo,
        params: effective.params,
        axisPolicies: effective.axisPolicies,
        ...(definition.kind === 'played'
          ? {
              generatedBacking: resolveGeneratedBacking(definition, item.generatedBacking),
              playNotes: item.playNotes ?? playNotes,
            }
          : {}),
      }}
      held={effective.heldAxisValues}
      chordsIn={chordsIn}
      axes={visibleAxes(definition.axes, locks)}
      hiddenParams={[...locks.params, ...(questions ? ['questionCount'] : [])]}
      inRoutine
      onApply={onApply}
    />
  );
}
